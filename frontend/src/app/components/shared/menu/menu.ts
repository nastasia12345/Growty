import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AuthModalComponent } from '../../auth/auth-modal';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatTooltipModule,
    TranslateModule,
    AuthModalComponent,
  ],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class MenuComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  showAuthModal    = false;
  showUserDropdown = false;

  constructor(
    public  auth:   AuthService,
    public  lang:   LanguageService,
    private router: Router,
  ) {}

  openAuth()  { this.showAuthModal = true;  this.showUserDropdown = false; }
  closeAuth() { this.showAuthModal = false; }

  toggleDropdown() { this.showUserDropdown = !this.showUserDropdown; }
  closeDropdown()  { this.showUserDropdown = false; }

  logout() {
    this.auth.logout();
    this.showUserDropdown = false;
    this.router.navigate(['/']);
  }
}
