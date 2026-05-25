import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatInputModule,
    MatFormFieldModule, MatSnackBarModule, MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css'],
})
export class SettingsComponent implements OnInit {
  displayName = '';
  email       = '';
  saving      = false;

  constructor(
    public  auth:      AuthService,
    private snackBar:  MatSnackBar,
    private translate: TranslateService,
    private cdr:       ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const u = this.auth.currentUser();
    this.displayName = u?.displayName ?? '';
    this.email       = u?.email       ?? '';
  }

  save() {
    // Placeholder — wire to a PATCH /api/auth/profile endpoint when ready
    this.snackBar.open(
      this.translate.instant('settings.savedMessage'),
      'OK',
      { duration: 2500 }
    );
  }
}
