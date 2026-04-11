import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { API_URL } from './api.service';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
    status: string;
    permissions: string[];
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string;
  iat: number;
  exp: number;
}

const TOKEN_KEY = 'hrm_token';
const USER_KEY  = 'hrm_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthResponse['user'] | null>(this.loadUser());
  private _token = signal<string | null>(this.loadToken());

  // Public signals
  readonly currentUser = this._user.asReadonly();
  readonly token       = this._token.asReadonly();
  readonly isLoggedIn  = computed(() => !!this._token() && !this.isExpired());
  readonly isAdmin     = computed(() => this._user()?.role === 'ADMIN');
  readonly userRole    = computed(() => this._user()?.role ?? null);

  hasPermission(permission: string): boolean {
    const user = this._user();
    if (!user) return false;
    if (user.role === 'ADMIN') return true; // Admin a tout
    return (user.permissions ?? []).includes(permission);
  }

  getPermissions(): string[] {
    return this._user()?.permissions ?? [];
  }

  constructor(private http: HttpClient, private router: Router) {}

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, payload).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._token.set(res.token);
        this._user.set(res.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this._token();
  }

  /** Decode JWT payload (sans vérification signature — faite côté serveur) */
  decodeToken(): JwtPayload | null {
    const token = this._token();
    if (!token) return null;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64)) as JwtPayload;
    } catch {
      return null;
    }
  }

  isExpired(): boolean {
    const payload = this.decodeToken();
    if (!payload) return true;
    return Date.now() / 1000 > payload.exp;
  }

  private loadToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): AuthResponse['user'] | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}