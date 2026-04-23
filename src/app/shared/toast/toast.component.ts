import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let toast of toasts"
        class="toast toast-{{ toast.type }}"
        (click)="remove(toast.id)"
      >
        <span class="toast-icon">
          <i class="bi" [ngClass]="{
            'bi-check-circle-fill': toast.type === 'success',
            'bi-x-circle-fill':    toast.type === 'error',
            'bi-exclamation-triangle-fill': toast.type === 'warning',
            'bi-info-circle-fill': toast.type === 'info',
            'bi-arrow-repeat spin': toast.type === 'loading'
          }"></i>
        </span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" (click)="remove(toast.id)">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 380px;
      width: 100%;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      animation: slideIn 0.25s cubic-bezier(.16,1,.3,1);
      border: 1px solid transparent;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(30px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .toast-success {
      background: #f0fdf4;
      color: #166534;
      border-color: #bbf7d0;
    }
    .toast-error {
      background: #fef2f2;
      color: #991b1b;
      border-color: #fecaca;
    }
    .toast-warning {
      background: #fffbeb;
      color: #92400e;
      border-color: #fde68a;
    }
    .toast-info {
      background: #eff6ff;
      color: #1e40af;
      border-color: #bfdbfe;
    }
    .toast-loading {
      background: #f8fafc;
      color: #334155;
      border-color: #e2e8f0;
    }

    .toast-icon { font-size: 1rem; flex-shrink: 0; }
    .toast-message { flex: 1; line-height: 1.4; }

    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      opacity: 0.5;
      font-size: 0.9rem;
      color: inherit;
      padding: 0;
      line-height: 1;
      flex-shrink: 0;
      &:hover { opacity: 1; }
    }

    .spin {
      display: inline-block;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub!: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.sub = this.toastService.getToasts().subscribe(t => this.toasts = t);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  remove(id: string) {
    this.toastService.remove(id);
  }
}