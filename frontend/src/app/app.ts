import { Component, signal } from '@angular/core';
import { MenuComponent } from './components/shared/menu/menu';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [MenuComponent],
  standalone: true,
  styleUrl: './app.css'

})
export class App {
  protected readonly title = signal('frontend');
}
``
