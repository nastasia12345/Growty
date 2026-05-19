import { Component, signal } from '@angular/core';
import { MenuComponent } from './components/shared/menu/menu';
import { PlantRunnerComponent } from './components/plant-runner/plant-runner';
import { MiniPlantComponent } from './components/mini-plant/mini-plant';
import { NotificationToastComponent } from './components/notification-toast/notification-toast';
import { WellbeingSurveyComponent } from './components/wellbeing/wellbeing-survey';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [MenuComponent, PlantRunnerComponent, MiniPlantComponent, NotificationToastComponent, WellbeingSurveyComponent],
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}
