import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AuthModalComponent } from '../auth/auth-modal';

@Component({
  selector: 'app-auth-required',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule, AuthModalComponent],
  templateUrl: './auth-required.html',
  styleUrl:    './auth-required.css',
})
export class AuthRequiredComponent {
  showModal  = false;
  activeTab: 'login' | 'register' = 'login';

  constructor(private router: Router) {}

  openLogin()    { this.activeTab = 'login';    this.showModal = true; }
  openRegister() { this.activeTab = 'register'; this.showModal = true; }
  closeModal()   { this.showModal = false; }

  goHome() { this.router.navigate(['/']); }
}
