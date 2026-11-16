import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type NotificationStatus = 'default' | 'granted' | 'denied' | 'unsupported';

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  readonly isInstallable = signal<boolean>(false);
  readonly isInstalled = signal<boolean>(false);
  readonly isIOS = signal<boolean>(false);
  readonly isAndroid = signal<boolean>(false);
  readonly isOnline = signal<boolean>(true);
  readonly showInstallGuide = signal<boolean>(false);
  readonly notificationStatus = signal<NotificationStatus>('default');

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initPwa();
  }

  private initPwa(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    this.isOnline.set(navigator.onLine);
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));

    // Detect standalone installed mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    this.isInstalled.set(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    this.isIOS.set(/iphone|ipad|ipod/.test(ua));
    this.isAndroid.set(/android/.test(ua));

    // Check notification support
    if ('Notification' in window) {
      this.notificationStatus.set(Notification.permission as NotificationStatus);
    } else {
      this.notificationStatus.set('unsupported');
    }

    // Register Service Worker for Android PWA & Notification Alerts
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          this.swRegistration = reg;
        })
        .catch(() => {
          // Ignore registration error in restricted preview frames
        });
    }

    // Listen for Android / Chromium install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.isInstallable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.isInstallable.set(false);
      this.deferredPrompt = null;
      this.showInstallGuide.set(false);
    });
  }

  async promptInstall(): Promise<boolean> {
    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.isInstalled.set(true);
        this.isInstallable.set(false);
        this.deferredPrompt = null;
        return true;
      }
      return false;
    }

    // Show guided install modal for Android Chrome / iOS Safari / Desktop
    this.showInstallGuide.set(true);
    return false;
  }

  closeInstallGuide(): void {
    this.showInstallGuide.set(false);
  }

  async enableNotifications(): Promise<NotificationStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.notificationStatus.set('unsupported');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      this.notificationStatus.set(result as NotificationStatus);
      if (result === 'granted') {
        await this.sendAlert(
          'Watchman Alerts Enabled',
          'You will receive prayer and word watch notifications on this device.'
        );
      }
      return result as NotificationStatus;
    } catch {
      return this.notificationStatus();
    }
  }

  async sendAlert(title: string, body: string): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      if (this.swRegistration) {
        await this.swRegistration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });
        return;
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });
        return;
      }
    } catch {
      // Fallback to standard Notification constructor
    }

    try {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    } catch {
      // Ignore if blocked
    }
  }
}
