import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {
  constructor(private router: Router) {}

  goToBoards() {
    this.router.navigate(['/boards']);
  }

  features = [
    { icon: 'dashboard',      titleKey: 'home.feature1Title', descKey: 'home.feature1Desc' },
    { icon: 'auto_awesome',   titleKey: 'home.feature2Title', descKey: 'home.feature2Desc' },
    { icon: 'alarm',          titleKey: 'home.feature3Title', descKey: 'home.feature3Desc' },
    { icon: 'drag_indicator', titleKey: 'home.feature4Title', descKey: 'home.feature4Desc' },
    { icon: 'filter_list',    titleKey: 'home.feature5Title', descKey: 'home.feature5Desc' },
    { icon: 'devices',        titleKey: 'home.feature6Title', descKey: 'home.feature6Desc' }
  ];
}
