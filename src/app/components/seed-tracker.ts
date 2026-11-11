import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';
import { AuthorityFigureSeed, SeedGivingRecord } from '../models/prayer.model';

interface AuthorityCardView {
  authority: AuthorityFigureSeed;
  givenAmount: number;
  remainingAmount: number;
  targetAmountGhs: number;
  givenAmountGhs: number;
  remainingAmountGhs: number;
  rateToGhs: number;
  isForeignCurrency: boolean;
  progressPct: number;
  records: SeedGivingRecord[];
}

@Component({
  selector: 'app-seed-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Seed Altar
          </span>
          <h1 class="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
            Annual Seed Tracker
          </h1>
          <p class="text-xs text-stone-400 mt-0.5">
            Track annual seed targets and offerings in GHS (with live FX conversion).
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="openAuthorityForm()"
            class="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700 transition-all"
          >
            <mat-icon style="font-size: 16px;">person_add</mat-icon>
            <span>Add Target</span>
          </button>

          @if (firebaseService.authorities().length > 0) {
            <button
              type="button"
              (click)="openSeedForm()"
              class="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all shadow-md"
            >
              <mat-icon style="font-size: 18px;">volunteer_activism</mat-icon>
              <span>Log Seed</span>
            </button>
          }
        </div>
      </div>

      <!-- Annual Seed Summary in GHS (with Live FX Conversion) -->
      @let seedSummary = firebaseService.seedTotalsSummary();
      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Total Seed Target Within the Year (GHS) -->
          <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Annual Target (GHS)
            </span>
            <div class="text-2xl sm:text-3xl font-serif font-bold text-stone-100 tabular-nums">
              GHS {{ firebaseService.formatOneDecimal(seedSummary.totalTarget) }}
            </div>
            <span class="text-[11px] text-stone-500 font-mono tabular-nums">
              {{ firebaseService.formatInteger(seedSummary.authoritiesCount) }} specified {{ seedSummary.authoritiesCount === 1 ? 'target' : 'targets' }}
            </span>
          </div>

          <!-- Total Seed Given (GHS) -->
          <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Total Given (GHS)
            </span>
            <div class="text-2xl sm:text-3xl font-serif font-bold text-emerald-400 tabular-nums">
              GHS {{ firebaseService.formatOneDecimal(seedSummary.totalGiven) }}
            </div>
            <span class="text-[11px] text-stone-500 font-mono tabular-nums">
              {{ firebaseService.formatOneDecimal(seedSummary.progressPct) }}% complete ({{ firebaseService.formatInteger(seedSummary.seedsCount) }} seeds)
            </span>
          </div>

          <!-- Left to be Given (GHS) -->
          <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Left to Give (GHS)
            </span>
            <div class="text-2xl sm:text-3xl font-serif font-bold text-amber-400 tabular-nums">
              GHS {{ firebaseService.formatOneDecimal(seedSummary.totalRemaining) }}
            </div>
            <span class="text-[11px] text-stone-500 font-mono tabular-nums">
              {{ seedSummary.totalRemaining <= 0 && seedSummary.totalTarget > 0 ? 'Target completed' : 'Remaining balance' }}
            </span>
          </div>
        </div>

        <!-- Live Currency Conversion Breakdown to GHS -->
        @if (seedSummary.hasForeignCurrency) {
          <div class="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-stone-900/70 border border-stone-800 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-amber-400 font-semibold flex items-center gap-1">
                <mat-icon style="font-size: 14px;">currency_exchange</mat-icon>
                <span>Live FX to GHS:</span>
              </span>
              @for (curr of seedSummary.byCurrency; track curr.currency) {
                <span class="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 font-mono tabular-nums text-stone-200">
                  <strong>{{ curr.currency }}</strong>:
                  Given {{ firebaseService.formatOneDecimal(curr.given) }} / {{ firebaseService.formatOneDecimal(curr.target) }}
                  @if (curr.currency !== 'GHS') {
                    <span class="text-amber-400 ml-1">
                      (≈ GHS {{ firebaseService.formatOneDecimal(curr.givenGhs) }} / {{ firebaseService.formatOneDecimal(curr.targetGhs) }} &#64; {{ firebaseService.formatOneDecimal(curr.rateToGhs) }})
                    </span>
                  }
                </span>
              }
            </div>
            <button
              type="button"
              (click)="firebaseService.refreshLiveExchangeRates()"
              class="text-[11px] text-stone-400 hover:text-amber-400 flex items-center gap-1"
              title="Refresh live exchange rates"
            >
              <mat-icon style="font-size: 13px;">sync</mat-icon>
              <span>Refresh FX</span>
            </button>
          </div>
        }
      </div>

      <!-- Form 1: Add / Edit Authority Figure & Year-End Seed Target -->
      @if (showAuthorityForm()) {
        <div class="rounded-2xl bg-stone-900 border border-amber-500/40 p-5 sm:p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Annual Commitment
              </span>
              <h2 class="text-base font-serif font-bold text-stone-100">
                {{ editingAuthority() ? 'Edit Seed Target' : 'New Seed Target' }}
              </h2>
            </div>
            <button
              type="button"
              (click)="showAuthorityForm.set(false)"
              class="text-stone-400 hover:text-stone-100 p-1 rounded-lg hover:bg-stone-800"
            >
              <mat-icon style="font-size: 18px;">close</mat-icon>
            </button>
          </div>

          <form [formGroup]="authorityForm" (ngSubmit)="submitAuthority()" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="authName" class="block text-xs font-medium text-stone-300 mb-1">
                  Authority Name
                </label>
                <input
                  id="authName"
                  type="text"
                  formControlName="authorityName"
                  placeholder="Name"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label for="authRole" class="block text-xs font-medium text-stone-300 mb-1">
                  Role (optional)
                </label>
                <input
                  id="authRole"
                  type="text"
                  formControlName="roleTitle"
                  placeholder="Role or title"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label for="authCurrency" class="block text-xs font-medium text-stone-300 mb-1">
                  Currency
                </label>
                <select
                  id="authCurrency"
                  formControlName="currency"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="GHS">GHS (₵)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="NGN">NGN (₦)</option>
                </select>
              </div>

              <div>
                <label for="authTarget" class="block text-xs font-medium text-stone-300 mb-1">
                  Annual Target
                </label>
                <input
                  id="authTarget"
                  type="number"
                  step="0.1"
                  min="1"
                  formControlName="yearTargetAmount"
                  placeholder="1000.0"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label for="authYear" class="block text-xs font-medium text-stone-300 mb-1">
                  Year
                </label>
                <input
                  id="authYear"
                  type="text"
                  formControlName="targetYear"
                  placeholder="2026"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <span class="block text-xs font-medium text-stone-300 mb-1">
                  Mode
                </span>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    (click)="authorityForm.controls.mode.setValue('individual')"
                    class="py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    [class]="
                      authorityForm.controls.mode.value === 'individual'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    "
                  >
                    <mat-icon style="font-size: 14px;">person</mat-icon>
                    <span>Alone</span>
                  </button>
                  <button
                    type="button"
                    (click)="authorityForm.controls.mode.setValue('partner')"
                    class="py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    [class]="
                      authorityForm.controls.mode.value === 'partner'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    "
                  >
                    <mat-icon style="font-size: 14px;">groups</mat-icon>
                    <span>Partner</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                (click)="showAuthorityForm.set(false)"
                class="py-2 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="isSaving()"
                class="flex items-center gap-1.5 py-2 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 shadow-md"
              >
                <mat-icon style="font-size: 16px;">check</mat-icon>
                <span>{{ editingAuthority() ? 'Update' : 'Save Target' }}</span>
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Form 2: Record Seed Given -->
      @if (showSeedForm()) {
        <div class="rounded-2xl bg-stone-900 border border-emerald-500/40 p-5 sm:p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Seed Record
              </span>
              <h2 class="text-base font-serif font-bold text-stone-100">
                Log Seed Given
              </h2>
            </div>
            <button
              type="button"
              (click)="showSeedForm.set(false)"
              class="text-stone-400 hover:text-stone-100 p-1 rounded-lg hover:bg-stone-800"
            >
              <mat-icon style="font-size: 18px;">close</mat-icon>
            </button>
          </div>

          <form [formGroup]="seedForm" (ngSubmit)="submitSeed()" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label for="seedAuth" class="block text-xs font-medium text-stone-300 mb-1">
                  Authority Figure
                </label>
                <select
                  id="seedAuth"
                  formControlName="authorityId"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  @for (a of firebaseService.authorities(); track a.id) {
                    <option [value]="a.id">{{ a.authorityName }} ({{ a.currency }})</option>
                  }
                </select>
              </div>

              <div>
                <label for="seedAmt" class="block text-xs font-medium text-stone-300 mb-1">
                  Amount Given
                </label>
                <input
                  id="seedAmt"
                  type="number"
                  step="0.1"
                  min="0.1"
                  formControlName="amount"
                  placeholder="100.0"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label for="seedDate" class="block text-xs font-medium text-stone-300 mb-1">
                  Date
                </label>
                <input
                  id="seedDate"
                  type="date"
                  formControlName="date"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <span class="block text-xs font-medium text-stone-300 mb-1">
                  Mode
                </span>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    (click)="seedForm.controls.mode.setValue('individual')"
                    class="py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    [class]="
                      seedForm.controls.mode.value === 'individual'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    "
                  >
                    <mat-icon style="font-size: 14px;">person</mat-icon>
                    <span>Alone</span>
                  </button>
                  <button
                    type="button"
                    (click)="seedForm.controls.mode.setValue('partner')"
                    class="py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    [class]="
                      seedForm.controls.mode.value === 'partner'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    "
                  >
                    <mat-icon style="font-size: 14px;">groups</mat-icon>
                    <span>Partner</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label for="seedNote" class="block text-xs font-medium text-stone-300 mb-1">
                Note (optional)
              </label>
              <input
                id="seedNote"
                type="text"
                formControlName="notes"
                placeholder="Brief note"
                class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                (click)="showSeedForm.set(false)"
                class="py-2 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="isSaving()"
                class="flex items-center gap-1.5 py-2 px-5 rounded-xl text-xs font-semibold bg-emerald-500 text-stone-950 hover:bg-emerald-400 disabled:opacity-50 shadow-md"
              >
                <mat-icon style="font-size: 16px;">volunteer_activism</mat-icon>
                <span>Save Seed</span>
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Filter & Sort Bar -->
      @if (firebaseService.authorities().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-stone-900 border border-stone-800">
          <div>
            <label for="seedSearch" class="block text-[11px] font-medium text-stone-400 mb-1">Search</label>
            <input
              id="seedSearch"
              type="text"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              placeholder="Search name or note..."
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label for="seedModeFilter" class="block text-[11px] font-medium text-stone-400 mb-1">Mode</label>
            <select
              id="seedModeFilter"
              [value]="filterMode()"
              (change)="filterMode.set($any($event.target).value)"
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Modes</option>
              <option value="individual">Alone</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          <div>
            <label for="seedCurrFilter" class="block text-[11px] font-medium text-stone-400 mb-1">Currency</label>
            <select
              id="seedCurrFilter"
              [value]="filterCurrency()"
              (change)="filterCurrency.set($any($event.target).value)"
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Currencies</option>
              <option value="GHS">GHS (₵)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="NGN">NGN (₦)</option>
            </select>
          </div>

          <div>
            <label for="seedSort" class="block text-[11px] font-medium text-stone-400 mb-1">Sort</label>
            <select
              id="seedSort"
              [value]="sortBy()"
              (change)="sortBy.set($any($event.target).value)"
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highestGiven">Highest Given (GHS)</option>
              <option value="highestTarget">Highest Target (GHS)</option>
            </select>
          </div>
        </div>
      }

      <!-- Authority Figures & Seed Progress Cards -->
      @if (authorityCards().length === 0) {
        <div class="text-center py-12 px-4 rounded-2xl bg-stone-900/50 border border-stone-800 space-y-3">
          <mat-icon class="text-stone-600" style="font-size: 40px;">volunteer_activism</mat-icon>
          <h3 class="text-base font-semibold text-stone-300">
            {{ firebaseService.authorities().length === 0 ? 'No seed targets yet' : 'No matching seed targets' }}
          </h3>
          <p class="text-xs text-stone-500 max-w-sm mx-auto">
            {{ firebaseService.authorities().length === 0 ? 'Add an authority figure and annual seed target to begin.' : 'Try adjusting your search or filter options.' }}
          </p>
          @if (firebaseService.authorities().length === 0) {
            <button
              type="button"
              (click)="openAuthorityForm()"
              class="py-2 px-4 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400"
            >
              Add First Target
            </button>
          }
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          @for (card of authorityCards(); track card.authority.id) {
            <div class="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4 flex flex-col justify-between">
              <div class="space-y-4">
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-3 border-b border-stone-800/80 pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span
                        class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        [class]="
                          card.authority.mode === 'partner'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        "
                      >
                        {{ card.authority.mode === 'partner' ? 'With Partner' : 'Individual' }}
                      </span>
                      <span class="text-xs font-mono text-stone-400">
                        {{ card.authority.targetYear }}
                      </span>
                    </div>
                    <h2 class="text-lg font-serif font-bold text-stone-100 mt-1">
                      {{ card.authority.authorityName }}
                    </h2>
                    @if (card.authority.roleTitle) {
                      <span class="text-xs text-stone-400 block">{{ card.authority.roleTitle }}</span>
                    }
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      (click)="openSeedFormForAuthority(card.authority.id, card.authority.mode)"
                      class="py-1 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <mat-icon style="font-size: 14px;">add</mat-icon>
                      <span>Give</span>
                    </button>
                    <button
                      type="button"
                      (click)="editAuthority(card.authority)"
                      class="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800"
                      title="Edit Target"
                    >
                      <mat-icon style="font-size: 16px;">edit</mat-icon>
                    </button>
                    <button
                      type="button"
                      (click)="deleteAuthority(card.authority.id)"
                      class="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800"
                      title="Remove Target and All Saved Seeds"
                    >
                      <mat-icon style="font-size: 16px;">delete</mat-icon>
                    </button>
                  </div>
                </div>

                <!-- Seed Given vs Year-End Target Numbers -->
                <div class="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-xs">
                  <div>
                    <span class="text-stone-500 block">Given</span>
                    <span class="text-sm sm:text-base font-mono font-bold text-emerald-400 tabular-nums block">
                      {{ card.authority.currency }} {{ firebaseService.formatOneDecimal(card.givenAmount) }}
                    </span>
                    @if (card.isForeignCurrency) {
                      <span class="text-[10px] font-mono text-stone-400 tabular-nums block">
                        ≈ GHS {{ firebaseService.formatOneDecimal(card.givenAmountGhs) }}
                      </span>
                    }
                  </div>
                  <div>
                    <span class="text-stone-500 block">Target</span>
                    <span class="text-sm sm:text-base font-mono font-bold text-stone-100 tabular-nums block">
                      {{ card.authority.currency }} {{ firebaseService.formatOneDecimal(card.authority.yearTargetAmount) }}
                    </span>
                    @if (card.isForeignCurrency) {
                      <span class="text-[10px] font-mono text-stone-400 tabular-nums block">
                        ≈ GHS {{ firebaseService.formatOneDecimal(card.targetAmountGhs) }}
                      </span>
                    }
                  </div>
                  <div>
                    <span class="text-stone-500 block">Left</span>
                    <span class="text-sm sm:text-base font-mono font-bold text-amber-400 tabular-nums block">
                      {{ card.authority.currency }} {{ firebaseService.formatOneDecimal(card.remainingAmount) }}
                    </span>
                    @if (card.isForeignCurrency) {
                      <span class="text-[10px] font-mono text-stone-400 tabular-nums block">
                        ≈ GHS {{ firebaseService.formatOneDecimal(card.remainingAmountGhs) }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-stone-400">
                      Progress:
                      <strong class="text-amber-400 font-mono tabular-nums">{{ firebaseService.formatOneDecimal(card.progressPct) }}%</strong>
                    </span>
                    <span class="text-stone-500 font-mono tabular-nums">
                      {{ firebaseService.formatInteger(card.records.length) }} {{ card.records.length === 1 ? 'entry' : 'entries' }}
                    </span>
                  </div>
                  <div class="h-2.5 w-full bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                    <div
                      class="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                      [style.width.%]="card.progressPct"
                    ></div>
                  </div>
                </div>

                <!-- Seed History List (Newest on top) -->
                @if (card.records.length > 0) {
                  <div class="space-y-2 pt-2 border-t border-stone-800/70">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                        History (Newest First)
                      </span>
                    </div>
                    <div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      @for (s of card.records; track s.id) {
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 text-xs">
                          <div class="space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="font-mono font-bold text-emerald-400 tabular-nums">
                                +{{ card.authority.currency }} {{ firebaseService.formatOneDecimal(s.amount) }}
                              </span>
                              @if (card.isForeignCurrency) {
                                <span class="text-[10px] font-mono text-stone-400 tabular-nums">
                                  (≈ GHS {{ firebaseService.formatOneDecimal(firebaseService.convertToGhs(s.amount, card.authority.currency)) }})
                                </span>
                              }
                              <span class="text-stone-500 font-mono">{{ s.date }}</span>
                              <span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                                {{ s.mode === 'partner' ? 'Partner' : 'Alone' }}
                              </span>
                            </div>
                            @if (s.notes) {
                              <p class="text-[11px] text-stone-400">{{ s.notes }} · {{ s.authorName }}</p>
                            } @else {
                              <p class="text-[11px] text-stone-500">{{ s.authorName }}</p>
                            }
                          </div>
                          <button
                            type="button"
                            (click)="deleteSeed(s.id)"
                            class="p-1 text-stone-500 hover:text-red-400 rounded"
                            title="Delete Seed"
                          >
                            <mat-icon style="font-size: 15px;">delete</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SeedTracker {
  readonly firebaseService = inject(FirebaseService);
  readonly saved = output<string>();

  readonly showAuthorityForm = signal(false);
  readonly showSeedForm = signal(false);
  readonly isSaving = signal(false);
  readonly editingAuthority = signal<AuthorityFigureSeed | null>(null);

  // Filter & Sort state
  readonly searchQuery = signal('');
  readonly filterMode = signal<'all' | 'individual' | 'partner'>('all');
  readonly filterCurrency = signal<string>('all');
  readonly sortBy = signal<'newest' | 'oldest' | 'highestGiven' | 'highestTarget'>('newest');

  readonly authorityForm = new FormGroup({
    authorityName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    roleTitle: new FormControl<string>('', { nonNullable: true }),
    currency: new FormControl<string>('GHS', { nonNullable: true }),
    yearTargetAmount: new FormControl<number>(1000, { nonNullable: true, validators: [Validators.min(1)] }),
    targetYear: new FormControl<string>(String(new Date().getFullYear()), { nonNullable: true }),
    mode: new FormControl<'individual' | 'partner'>('individual', { nonNullable: true }),
  });

  readonly seedForm = new FormGroup({
    authorityId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number>(100, { nonNullable: true, validators: [Validators.min(0.1)] }),
    date: new FormControl<string>(this.firebaseService.getTodayDateString(), { nonNullable: true }),
    mode: new FormControl<'individual' | 'partner'>('individual', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  readonly authorityCards = computed<AuthorityCardView[]>(() => {
    const authorities = this.firebaseService.authorities();
    const seeds = this.firebaseService.seeds();
    const rates = this.firebaseService.fxToGhs();
    const query = this.searchQuery().trim().toLowerCase();
    const mode = this.filterMode();
    const currFilter = this.filterCurrency();
    const sort = this.sortBy();

    let cards = authorities.map((authItem) => {
      const curr = (authItem.currency || 'GHS').toUpperCase();
      const rate = curr === 'GHS' ? 1 : rates[curr] || 1;
      const matchingSeeds = seeds
        .filter((s) => s.authorityId === authItem.id)
        .sort(
          (a, b) =>
            (b.date || '').localeCompare(a.date || '') ||
            (b.createdAt || '').localeCompare(a.createdAt || '') ||
            (b.id || '').localeCompare(a.id || '')
        );
      const given = matchingSeeds.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const target = Math.max(0.1, Number(authItem.yearTargetAmount) || 0);
      const remaining = Math.max(0, target - given);
      const pct = Math.min(100, Math.round((given / target) * 1000) / 10);

      return {
        authority: authItem,
        givenAmount: given,
        remainingAmount: remaining,
        targetAmountGhs: target * rate,
        givenAmountGhs: given * rate,
        remainingAmountGhs: remaining * rate,
        rateToGhs: rate,
        isForeignCurrency: curr !== 'GHS',
        progressPct: pct,
        records: matchingSeeds,
      };
    });

    if (mode !== 'all') {
      cards = cards.filter((c) => c.authority.mode === mode);
    }

    if (currFilter !== 'all') {
      cards = cards.filter((c) => (c.authority.currency || 'GHS').toUpperCase() === currFilter);
    }

    if (query) {
      cards = cards.filter(
        (c) =>
          c.authority.authorityName.toLowerCase().includes(query) ||
          (c.authority.roleTitle && c.authority.roleTitle.toLowerCase().includes(query)) ||
          c.records.some(
            (r) =>
              (r.notes && r.notes.toLowerCase().includes(query)) ||
              r.authorName.toLowerCase().includes(query)
          )
      );
    }

    return [...cards].sort((a, b) => {
      if (sort === 'oldest') {
        return (
          (a.authority.createdAt || '').localeCompare(b.authority.createdAt || '') ||
          (a.authority.id || '').localeCompare(b.authority.id || '')
        );
      }
      if (sort === 'highestGiven') {
        return b.givenAmountGhs - a.givenAmountGhs;
      }
      if (sort === 'highestTarget') {
        return b.targetAmountGhs - a.targetAmountGhs;
      }
      // Default: 'newest'
      const aLatest = a.records[0]?.date || a.authority.createdAt || '';
      const bLatest = b.records[0]?.date || b.authority.createdAt || '';
      return (
        bLatest.localeCompare(aLatest) ||
        (b.authority.createdAt || '').localeCompare(a.authority.createdAt || '') ||
        (b.authority.id || '').localeCompare(a.authority.id || '')
      );
    });
  });

  openAuthorityForm() {
    this.editingAuthority.set(null);
    this.authorityForm.reset({
      authorityName: '',
      roleTitle: '',
      currency: 'GHS',
      yearTargetAmount: 1000,
      targetYear: String(new Date().getFullYear()),
      mode: 'individual',
    });
    this.showSeedForm.set(false);
    this.showAuthorityForm.set(true);
  }

  editAuthority(authItem: AuthorityFigureSeed) {
    this.editingAuthority.set(authItem);
    this.authorityForm.reset({
      authorityName: authItem.authorityName,
      roleTitle: authItem.roleTitle || '',
      currency: authItem.currency || 'GHS',
      yearTargetAmount: authItem.yearTargetAmount,
      targetYear: authItem.targetYear || String(new Date().getFullYear()),
      mode: authItem.mode || 'individual',
    });
    this.showSeedForm.set(false);
    this.showAuthorityForm.set(true);
  }

  openSeedForm() {
    const first = this.firebaseService.authorities()[0];
    if (!first) return;
    this.openSeedFormForAuthority(first.id, first.mode);
  }

  openSeedFormForAuthority(authorityId: string, defaultMode: 'individual' | 'partner') {
    this.seedForm.reset({
      authorityId,
      amount: 100,
      date: this.firebaseService.getTodayDateString(),
      mode: defaultMode,
      notes: '',
    });
    this.showAuthorityForm.set(false);
    this.showSeedForm.set(true);
  }

  async submitAuthority() {
    const val = this.authorityForm.getRawValue();
    if (!val.authorityName.trim()) return;
    this.isSaving.set(true);

    try {
      const existing = this.editingAuthority();
      if (existing) {
        await this.firebaseService.updateAuthorityFigure({
          ...existing,
          authorityName: val.authorityName.trim(),
          roleTitle: val.roleTitle.trim(),
          currency: val.currency,
          yearTargetAmount: Number(val.yearTargetAmount) || 0,
          targetYear: val.targetYear.trim() || String(new Date().getFullYear()),
          mode: val.mode,
        });
        this.saved.emit('Seed target updated.');
      } else {
        await this.firebaseService.addAuthorityFigure({
          authorityName: val.authorityName.trim(),
          roleTitle: val.roleTitle.trim(),
          currency: val.currency,
          yearTargetAmount: Number(val.yearTargetAmount) || 0,
          targetYear: val.targetYear.trim() || String(new Date().getFullYear()),
          mode: val.mode,
        });
        this.saved.emit('Seed target saved.');
      }
      this.isSaving.set(false);
      this.showAuthorityForm.set(false);
    } catch {
      this.isSaving.set(false);
    }
  }

  async submitSeed() {
    const val = this.seedForm.getRawValue();
    const authItem = this.firebaseService.authorities().find((a) => a.id === val.authorityId);
    if (!authItem || (Number(val.amount) || 0) <= 0) return;

    this.isSaving.set(true);
    try {
      await this.firebaseService.addSeedRecord({
        authorityId: authItem.id,
        authorityName: authItem.authorityName,
        amount: Number(val.amount) || 0,
        date: val.date,
        mode: val.mode,
        notes: val.notes.trim(),
      });
      this.isSaving.set(false);
      this.showSeedForm.set(false);
      this.saved.emit('Seed recorded.');
    } catch {
      this.isSaving.set(false);
    }
  }

  async deleteAuthority(id: string) {
    await this.firebaseService.deleteAuthorityFigure(id);
    this.saved.emit('Target and saved seeds removed.');
  }

  async deleteSeed(id: string) {
    await this.firebaseService.deleteSeedRecord(id);
    this.saved.emit('Seed removed.');
  }
}
