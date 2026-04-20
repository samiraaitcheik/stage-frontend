import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts: Toast[] = [];
  private toastSubject = new BehaviorSubject<Toast[]>([]);
  private toastCounter = 0;
  private toastTimers: Map<string, number> = new Map();

  getToasts(): Observable<Toast[]> {
    return this.toastSubject.asObservable();
  }

  show(message: string, type: Toast['type'] = 'info', duration = 5000): string {
    const toast: Toast = {
      id: `toast-${++this.toastCounter}`,
      message,
      type,
      duration
    };

    this.toasts.push(toast);
    this.toastSubject.next([...this.toasts]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.remove(toast.id);
      }, duration);
      this.toastTimers.set(toast.id, timer as any);
    }

    return toast.id;
  }

  // Show loading/modifying toast that persists (duration 0 = no auto-dismiss)
  loading(message: string): string {
    return this.show(message, 'loading', 0);
  }

  success(message: string, duration = 5000): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000): string {
    return this.show(message, 'error', duration);
  }

  warning(message: string, duration = 5000): string {
    return this.show(message, 'warning', duration);
  }

  info(message: string, duration = 5000): string {
    return this.show(message, 'info', duration);
  }

  // Update an existing toast message
  update(id: string, newMessage: string, newType?: Toast['type'], newDuration = 5000): void {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast) return;

    // Clear existing timer if any
    const existingTimer = this.toastTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.toastTimers.delete(id);
    }

    // Update the toast
    toast.message = newMessage;
    if (newType) toast.type = newType;
    toast.duration = newDuration;

    this.toastSubject.next([...this.toasts]);

    // Set new timer if duration > 0
    if (newDuration > 0) {
      const timer = setTimeout(() => {
        this.remove(id);
      }, newDuration);
      this.toastTimers.set(id, timer as any);
    }
  }

  remove(id: string): void {
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toastSubject.next([...this.toasts]);
  }

  clear(): void {
    this.toastTimers.forEach(timer => clearTimeout(timer));
    this.toastTimers.clear();
    this.toasts = [];
    this.toastSubject.next([]);
  }
}