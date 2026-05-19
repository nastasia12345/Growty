import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { App } from './app/app';

import { HomeComponent }        from './app/components/home/home';
import { BoardsComponent }      from './app/components/boards/boards';
import { BoardDetailComponent } from './app/components/board-detail/board-detail';
import { AnalyticsComponent }   from './app/analytics/analytics';
import { PlantComponent }       from './app/components/plant/plant';
import { CalendarComponent }    from './app/components/calendar/calendar';
import { AuthRequiredComponent} from './app/components/auth-required/auth-required';
import { authGuard }            from './app/guards/auth.guard';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(),
    provideTranslateService({ defaultLanguage: 'en' }),
    ...provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
    provideRouter([
      // Public
      { path: '',       component: HomeComponent },
      { path: 'sign-in', component: AuthRequiredComponent },

      // Protected — require login
      { path: 'boards',    component: BoardsComponent,      canActivate: [authGuard] },
      { path: 'board/:id', component: BoardDetailComponent, canActivate: [authGuard] },
      { path: 'analytics', component: AnalyticsComponent,   canActivate: [authGuard] },
      { path: 'plant',     component: PlantComponent,       canActivate: [authGuard] },
      { path: 'calendar',  component: CalendarComponent,    canActivate: [authGuard] },

      { path: '**', redirectTo: '' }
    ])
  ]
}).catch(err => console.error(err));
