import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AISuggestion {
  suggestionId: number;
  improvedText: string;
  subtasks: string[];
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private apiUrl = 'https://localhost:5001/api/ai';

  constructor(private http: HttpClient) { }

  improveTask(taskId: number): Observable<AISuggestion> {
    return this.http.post<AISuggestion>(`${this.apiUrl}/improve-task/${taskId}`, {});
  }
}
