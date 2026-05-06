import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TaskFeedback {
  id: number;
  taskId: number;
  comment: string;
  difficultyRating: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private apiUrl = 'https://localhost:5001/api/feedback';

  constructor(private http: HttpClient) { }

  addFeedback(taskId: number, comment: string, rating: number): Observable<TaskFeedback> {
    return this.http.post<TaskFeedback>(`${this.apiUrl}/task/${taskId}`, { comment, rating });
  }

  getFeedback(taskId: number): Observable<TaskFeedback> {
    return this.http.get<TaskFeedback>(`${this.apiUrl}/task/${taskId}`);
  }
}
