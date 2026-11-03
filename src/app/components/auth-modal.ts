import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-auth-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        class="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-8"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/50">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <mat-icon style="font-size: 20px;">account_circle</mat-icon>
            </div>
            <div>
              <h2 id="auth-modal-title" class="text-base font-serif font-semibold text-stone-100">
                Sign In to Watchman Altar
              </h2>
              <p class="text-xs text-stone-400">
                Access your shared prayer circle &amp; records
              </p>
            </div>
          </div>
          <button
            type="button"
            (click)="dismiss.emit()"
            class="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition-colors"
            aria-label="Close"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          <!-- Diagnostic Alert when Google OAuth fails on Render (e.g., auth/unauthorized-domain) -->
          @if (firebaseService.lastAuthError(); as authErr) {
            <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2.5 text-xs">
              <div class="flex items-start gap-2 text-amber-300 font-semibold">
                <mat-icon class="shrink-0 text-amber-400" style="font-size: 18px;">info</mat-icon>
                <span>{{ authErr.message }}</span>
              </div>

              @if (authErr.code === 'auth/unauthorized-domain' || authErr.domain) {
                <div class="pl-6 space-y-2 text-stone-300 leading-relaxed">
                  <p class="text-[11px] text-stone-400">
                    To enable Google Popup on Render, add your domain in Firebase Console
                    (<strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>):
                  </p>
                  <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-stone-950 border border-stone-800 font-mono text-[11px] text-amber-300">
                    <span class="truncate">{{ authErr.domain || currentDomain }}</span>
                    <button
                      type="button"
                      (click)="copyDomain(authErr.domain || currentDomain)"
                      class="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-sans font-semibold flex items-center gap-1 shrink-0"
                    >
                      <mat-icon style="font-size: 13px;">{{ copiedDomain() ? 'check' : 'content_copy' }}</mat-icon>
                      <span>{{ copiedDomain() ? 'Copied' : 'Copy' }}</span>
                    </button>
                  </div>
                  <p class="text-[11px] text-emerald-400 font-medium">
                    Or sign in below with your Google email to enter your altar right now!
                  </p>
                </div>
              }
            </div>
          }

          <!-- SECTION 1: Instant Partner Email Sign-In (Works on Render immediately) -->
          <form [formGroup]="partnerForm" (ngSubmit)="submitPartnerEmail()" class="space-y-3.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <mat-icon style="font-size: 16px;">bolt</mat-icon>
                <span>Direct Partner Sign-In</span>
              </span>
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                Works on Render
              </span>
            </div>

            <div>
              <label for="partner-email-input" class="block text-xs font-medium text-stone-300 mb-1">
                Google / Partner Email *
              </label>
              <input
                id="partner-email-input"
                type="email"
                formControlName="email"
                placeholder="you@gmail.com"
                class="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label for="partner-name-input" class="block text-xs font-medium text-stone-300 mb-1">
                Your Name *
              </label>
              <input
                id="partner-name-input"
                type="text"
                formControlName="displayName"
                placeholder="Your name"
                class="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            @if (formError()) {
              <p class="text-xs text-red-400">{{ formError() }}</p>
            }

            <button
              type="submit"
              [disabled]="partnerForm.invalid || isSubmitting()"
              class="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 shadow-lg"
            >
              <mat-icon style="font-size: 18px;">login</mat-icon>
              <span>{{ isSubmitting() ? 'Signing in...' : 'Sign In with Email' }}</span>
            </button>
          </form>

          <!-- Divider -->
          <div class="relative flex items-center py-1">
            <div class="flex-grow border-t border-stone-800"></div>
            <span class="shrink-0 mx-3 text-[11px] uppercase tracking-wider text-stone-500">Or Google OAuth</span>
            <div class="flex-grow border-t border-stone-800"></div>
          </div>

          <!-- SECTION 2: Google Popup & Redirect Buttons -->
          <div class="space-y-2.5">
            <button
              type="button"
              (click)="tryGooglePopup()"
              [disabled]="isSubmitting()"
              class="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-950 hover:bg-stone-800 text-stone-100 border border-stone-700 transition-colors flex items-center justify-center gap-2"
            >
              <mat-icon class="text-amber-400" style="font-size: 18px;">account_circle</mat-icon>
              <span>Sign In with Google Popup</span>
            </button>

            <button
              type="button"
              (click)="tryGoogleRedirect()"
              [disabled]="isSubmitting()"
              class="w-full py-2 px-4 rounded-xl text-[11px] font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <mat-icon style="font-size: 15px;">open_in_new</mat-icon>
              <span>Popup blocked? Use Google Redirect</span>
            </button>
          </div>

          <!-- Render Domain Setup Helper Accordion -->
          <div class="pt-2 border-t border-stone-800/80">
            <button
              type="button"
              (click)="showDomainGuide.set(!showDomainGuide())"
              class="w-full flex items-center justify-between text-[11px] text-stone-400 hover:text-stone-200 py-1"
            >
              <span class="flex items-center gap-1.5">
                <mat-icon style="font-size: 14px;" class="text-amber-400">help_outline</mat-icon>
                <span>How to authorize Render domain for Google Popup</span>
              </span>
              <mat-icon style="font-size: 16px;">{{ showDomainGuide() ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>

            @if (showDomainGuide()) {
              <div class="mt-2 p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400 space-y-2 leading-relaxed">
                <p>
                  1. Copy your current Render domain:
                </p>
                <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-stone-900 border border-stone-800 font-mono text-amber-300">
                  <span class="truncate">{{ currentDomain }}</span>
                  <button
                    type="button"
                    (click)="copyDomain(currentDomain)"
                    class="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-sans font-semibold flex items-center gap-1 shrink-0"
                  >
                    <mat-icon style="font-size: 12px;">{{ copiedDomain() ? 'check' : 'content_copy' }}</mat-icon>
                    <span>{{ copiedDomain() ? 'Copied' : 'Copy' }}</span>
                  </button>
                </div>
                <p>
                  2. In Firebase Console (Project: <code class="text-stone-200">{{ firebaseService.firebaseProjectId }}</code>), open
                  <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong> and click <strong>Add domain</strong>.
                </p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AuthModal {
  readonly firebaseService = inject(FirebaseService);
  private fb = inject(FormBuilder);

  readonly dismiss = output<void>();
  readonly signedIn = output<string>();

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly copiedDomain = signal(false);
  readonly showDomainGuide = signal(false);

  readonly currentDomain = this.firebaseService.getCurrentDomain();

  readonly partnerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.minLength(2)]],
  });

  async submitPartnerEmail() {
    if (this.partnerForm.invalid || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.formError.set(null);

    const { email, displayName } = this.partnerForm.getRawValue();
    try {
      await this.firebaseService.loginWithPartnerEmail(email, displayName);
      this.signedIn.emit('Welcome to the Secret Place altar!');
      this.dismiss.emit();
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async tryGooglePopup() {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.formError.set(null);
    try {
      const user = await this.firebaseService.loginWithGoogle();
      if (user) {
        this.signedIn.emit('Signed in with Google!');
        this.dismiss.emit();
      }
    } catch {
      // Error is captured in firebaseService.lastAuthError() and shown in the diagnostic banner
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async tryGoogleRedirect() {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    try {
      await this.firebaseService.loginWithGoogleRedirect();
    } catch {
      this.isSubmitting.set(false);
    }
  }

  copyDomain(domain: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && domain) {
      navigator.clipboard.writeText(domain);
      this.copiedDomain.set(true);
      setTimeout(() => this.copiedDomain.set(false), 2500);
    }
  }
}
