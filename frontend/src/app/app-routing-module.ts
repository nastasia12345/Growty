import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { BoardsComponent } from './components/boards/boards';
import { BoardDetailComponent } from './components/board-detail/board-detail';
import { AnalyticsComponent } from './analytics/analytics';
import { PlantComponent } from './components/plant/plant';

const routes: Routes = [
  { path: '',           component: HomeComponent },
  { path: 'boards',    component: BoardsComponent },
  { path: 'board/:id', component: BoardDetailComponent },
  { path: 'analytics', component: AnalyticsComponent },
  { path: 'plant',     component: PlantComponent },
  { path: '**',        redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
