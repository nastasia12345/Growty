import {
  Component, EventEmitter, OnInit, Output,
  ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ProfileService, UserProfile } from '../../services/profile.service';

export const GENDER_OPTIONS = ['female', 'male', 'nonbinary', 'preferNotToSay'] as const;
export type GenderOption = typeof GENDER_OPTIONS[number];

@Component({
  selector: 'app-profile-settings-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './profile-settings-modal.html',
  styleUrls:  ['./profile-settings-modal.css'],
})
export class ProfileSettingsModalComponent implements OnInit {

  @Output() closed = new EventEmitter<void>();
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // ── Current user read-only info ────────────────────────────────────────────
  displayName = '';
  email       = '';

  // ── Editable profile fields ────────────────────────────────────────────────
  avatarDataUrl = '';
  phone         = '';
  gender        = '';
  happyThings   = '';

  // Hobbies tag-input
  hobbies:     string[] = [];
  hobbyInput   = '';

  // ── UI state ───────────────────────────────────────────────────────────────
  saving   = false;
  saved    = false;
  imgError = false;

  readonly genderOptions = GENDER_OPTIONS;

  constructor(
    public  auth:      AuthService,
    private profile:   ProfileService,
    private translate: TranslateService,
    private cdr:       ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const u = this.auth.currentUser();
    this.displayName = u?.displayName ?? '';
    this.email       = u?.email       ?? '';

    const p = this.profile.profile;
    this.avatarDataUrl = p.avatarDataUrl ?? '';
    this.phone         = p.phone         ?? '';
    this.gender        = p.gender        ?? '';
    this.hobbies       = p.hobbies       ? [...p.hobbies] : [];
    this.happyThings   = p.happyThings   ?? '';
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────

  triggerFileInput() {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.imgError = true; return; }
    this.imgError = false;

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarDataUrl = reader.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  removeAvatar() {
    this.avatarDataUrl = '';
    this.fileInputRef.nativeElement.value = '';
  }

  // ── Hobbies chip input ─────────────────────────────────────────────────────

  addHobby() {
    const v = this.hobbyInput.trim();
    if (v && !this.hobbies.includes(v)) {
      this.hobbies = [...this.hobbies, v];
    }
    this.hobbyInput = '';
  }

  onHobbyKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.addHobby(); }
    if (e.key === 'Backspace' && !this.hobbyInput && this.hobbies.length) {
      this.hobbies = this.hobbies.slice(0, -1);
    }
  }

  removeHobby(i: number) {
    this.hobbies = this.hobbies.filter((_, idx) => idx !== i);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  save() {
    this.saving = true;
    const payload: UserProfile = {
      avatarDataUrl: this.avatarDataUrl || undefined,
      phone:         this.phone.trim()  || undefined,
      gender:        this.gender        || undefined,
      hobbies:       this.hobbies.length ? this.hobbies : undefined,
      happyThings:   this.happyThings.trim() || undefined,
    };
    this.profile.save(payload);
    this.saving = false;
    this.saved  = true;
    this.cdr.markForCheck();
    setTimeout(() => { this.saved = false; this.cdr.markForCheck(); }, 2200);
  }

  close() { this.closed.emit(); }

  genderLabel(g: string): string {
    return this.translate.instant(`profile.gender_${g}`);
  }

  get initials(): string {
    return this.auth.initials;
  }
}
