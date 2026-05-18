import { Component, signal } from '@angular/core';
import { MenuComponent } from './components/shared/menu/menu';
import { PlantRunnerComponent } from './components/plant-runner/plant-runner';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [MenuComponent, PlantRunnerComponent],
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}
