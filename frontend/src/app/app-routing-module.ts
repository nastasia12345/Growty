import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BoardsComponent } from './components/boards/boards';//розділити завтра модельки на два файлми, щоб не було циклічної залежності
import { BoardDetailComponent } from './components/board-detail/board-detail';
/*import { TaskDetailComponent } from './task-details/task-details';*/
/*import { AnalyticsComponent } from './analytics/analytics';  */

const routes: Routes = [
  { path: 'boards', component: BoardsComponent },
  { path: 'board/:id', component: BoardDetailComponent },
  /* { path: 'task/:id', component: TaskDetailComponent },*/
/*  { path: 'analytics', component: AnalyticsComponent },*/
  { path: '', redirectTo: 'boards', pathMatch: 'full' },
  { path: '**', redirectTo: 'boards' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
  exports: [RouterModule]
