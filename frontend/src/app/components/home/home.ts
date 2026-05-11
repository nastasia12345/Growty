import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {
  constructor(private router: Router) {}

  goToBoards() {
    this.router.navigate(['/boards']);
  }

  features = [
    {
      icon: 'dashboard',
      title: 'Kanban дошки',
      description: 'Організуй завдання по колонках: To Do, In Progress, Done. Перетягуй картки між колонками.'
    },
    {
      icon: 'auto_awesome',
      title: 'AI помічник',
      description: 'Покращуй описи завдань за допомогою штучного інтелекту та отримуй підзавдання автоматично.'
    },
    {
      icon: 'alarm',
      title: 'Дедлайни',
      description: 'Встановлюй дедлайни, фільтруй завдання за часом та ніколи не пропускай важливе.'
    },
    {
      icon: 'drag_indicator',
      title: 'Drag & Drop',
      description: 'Зручне перетягування задач між колонками для швидкого оновлення статусу.'
    },
    {
      icon: 'filter_list',
      title: 'Фільтрація',
      description: 'Фільтруй завдання за пріоритетом, статусом та дедлайном — знаходь потрібне миттєво.'
    },
    {
      icon: 'devices',
      title: 'Адаптивний дизайн',
      description: 'Зручний інтерфейс на будь-якому пристрої — комп\'ютері, планшеті або телефоні.'
    }
  ];
}
