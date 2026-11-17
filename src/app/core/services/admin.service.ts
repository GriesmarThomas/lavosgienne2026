import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Question } from '../models/question.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly authUrl = '/api/admin/auth';
  private readonly questionsUrl = '/api/admin/questions';

  constructor(private readonly http: HttpClient) {}

  getAuthenticationStatus(): Observable<{ authenticated: boolean }> {
    return this.http.get<{ authenticated: boolean }>(this.authUrl);
  }

  login(username: string, password: string): Observable<{ authenticated: boolean }> {
    return this.http.post<{ authenticated: boolean }>(this.authUrl, { username, password });
  }

  logout(): Observable<{ authenticated: boolean }> {
    return this.http.delete<{ authenticated: boolean }>(this.authUrl);
  }

  getQuestions(): Observable<Question[]> {
    return this.http.get<Question[]>(this.questionsUrl);
  }

  addQuestion(question: Omit<Question, 'id'>, photoUploads: string[] = []): Observable<Question> {
    return this.http.post<Question>(this.questionsUrl, { ...question, photoUploads });
  }

  updateQuestion(question: Question): Observable<Question> {
    return this.http.put<Question>(this.questionsUrl, question);
  }

  deleteQuestion(id: number): Observable<{ deletedId: number }> {
    return this.http.delete<{ deletedId: number }>(`${this.questionsUrl}?id=${id}`);
  }
}
