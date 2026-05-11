import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { App } from './app/app';

import { HomeComponent } from './app/components/home/home';
import { BoardsComponent } from './app/components/boards/boards';
import { BoardDetailComponent } from './app/components/board-detail/board-detail';
import { AnalyticsComponent } from './app/analytics/analytics';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(),
    provideRouter([
      { path: '',           component: HomeComponent },
      { path: 'boards',    component: BoardsComponent },
      { path: 'board/:id', component: BoardDetailComponent },
      { path: 'analytics', component: AnalyticsComponent },
      { path: '**',        redirectTo: '' }
    ])
  ]
}).catch(err => console.error(err));
