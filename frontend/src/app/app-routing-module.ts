import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { BoardsComponent } from './components/boards/boards';
import { BoardDetailComponent } from './components/board-detail/board-detail';
import { AnalyticsComponent } from './analytics/analytics';
import { PlantComponent } from './components/plant/plant';
import { SettingsComponent } from './components/settings/settings';
import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '',           component: HomeComponent },
  { path: 'boards',    component: BoardsComponent,      canActivate: [authGuard] },
  { path: 'board/:id', component: BoardDetailComponent, canActivate: [authGuard] },
  { path: 'analytics', component: AnalyticsComponent,  canActivate: [authGuard] },
  { path: 'plant',     component: PlantComponent,       canActivate: [authGuard] },
  { path: 'settings',  component: SettingsComponent,    canActivate: [authGuard] },
  { path: '**',        redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
