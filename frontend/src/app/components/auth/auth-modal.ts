import {
  Component, EventEmitter, Input, OnInit, Output,
  ChangeDetectionStrategy, ChangeDetectorRef, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

type Tab = 'login' | 'register' | 'reset';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, TranslateModule],
  templateUrl: './auth-modal.html',
  styleUrls: ['./auth-modal.css']
})
export class AuthModalComponent implements OnInit {
  @Input()  initialTab: Tab = 'login';
  @Output() closed = new EventEmitter<void>();

  tab: Tab = 'login';

  ngOnInit() { this.tab = this.initialTab; }

  // Login form
  loginEmail    = '';
  loginPassword = '';

  // Register form
  regEmail    = '';
  regName     = '';
  regPassword = '';
  regConfirm  = '';

  loading = false;
  error   = '';
  success = '';

  showLoginPwd    = false;
  showRegPwd      = false;
  showRegConfirm  = false;

  // Reset-password form
  resetEmail    = '';
  resetPassword = '';
  resetConfirm  = '';
  showResetPwd  = false;
  showResetConf = false;

  constructor(
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  switchTab(t: Tab) {
    this.tab          = t;
    this.error        = '';
    this.success      = '';
    this.resetEmail   = '';
    this.resetPassword = '';
    this.resetConfirm = '';
    this.cdr.markForCheck();
  }

  submitReset() {
    this.error = '';
    if (!this.resetEmail) {
      this.error = 'Please enter your email.'; return;
    }
    if (!this.resetPassword) {
      this.error = 'Please enter a new password.'; return;
    }
    if (this.resetPassword.length < 6) {
      this.error = 'Password must be at least 6 characters.'; return;
    }
    if (this.resetPassword !== this.resetConfirm) {
      this.error = 'Passwords do not match.'; return;
    }
    this.loading = true;
    this.cdr.markForCheck();

    this.auth.resetPassword(this.resetEmail, this.resetPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Password changed! You can now sign in.';
        this.cdr.markForCheck();
        setTimeout(() => this.switchTab('login'), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.error   = err?.error?.error ?? 'Something went wrong. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  submitLogin() {
    this.error = '';
    if (!this.loginEmail || !this.loginPassword) {
      this.error = 'Please fill in all fields.'; return;
    }
    this.loading = true;
    this.cdr.markForCheck();

    this.auth.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = `Welcome back, ${this.auth.currentUser()?.displayName}!`;
        this.cdr.markForCheck();
        setTimeout(() => this.closed.emit(), 900);
      },
      error: (err) => {
        this.loading = false;
        this.error   = err?.error?.error ?? 'Login failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  submitRegister() {
    this.error = '';
    if (!this.regEmail || !this.regName || !this.regPassword) {
      this.error = 'Please fill in all fields.'; return;
    }
    if (this.regPassword.length < 6) {
      this.error = 'Password must be at least 6 characters.'; return;
    }
    if (this.regPassword !== this.regConfirm) {
      this.error = 'Passwords do not match.'; return;
    }
    this.loading = true;
    this.cdr.markForCheck();

    this.auth.register(this.regEmail, this.regName, this.regPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = `Account created! Welcome, ${this.auth.currentUser()?.displayName}!`;
        this.cdr.markForCheck();
        setTimeout(() => this.closed.emit(), 900);
      },
      error: (err) => {
        this.loading = false;
        this.error   = err?.error?.error ?? 'Registration failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  close() { this.closed.emit(); }
}
