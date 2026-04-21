import { Injectable } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable } from 'rxjs';

export const API_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string, options?: any): Observable<any> {
    return this.http.get<any>(`${API_URL}${path}`, options);
  }
  post<T>(path: string, body: any, options?: any): Observable<any> {
    return this.http.post<any>(`${API_URL}${path}`, body, options);
  }
  put<T>(path: string, body: any, options?: any): Observable<any> {
    return this.http.put<any>(`${API_URL}${path}`, body, options);
  }
  delete<T>(path: string, options?: any): Observable<any> {
    return this.http.delete<any>(`${API_URL}${path}`, options);
  }
}
