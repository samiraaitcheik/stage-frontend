import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayrollRunService, PayrollPeriodService } from '../../../core/services/domain.services';
import { AuthService } from '../../../core/services/auth.service';
import { PAYROLL_RUN_STATUS_OPTIONS } from '../../../core/models';

@Component({
  selector: 'app-runs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './runs.component.html',
  styleUrls: ['./runs.component.scss']
})
export class RunsComponent implements OnInit {
  items: any[] = [];
  filtered: any[] = [];
  periods: any[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  error = '';

  readonly statusOptions = PAYROLL_RUN_STATUS_OPTIONS;

  form: any = {
    payrollPeriodId: '',
    status: 'DRAFT',
    runNumber: 1,
    notes: ''
  };

  constructor(
    private service: PayrollRunService,
    private periodService: PayrollPeriodService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.load();
    this.periodService.getAll().subscribe({ next: (d) => { this.periods = d; }, error: () => {} });
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.applySearch(); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = q
      ? this.items.filter(i =>
          this.getPeriodLabel(i.payrollPeriodId).toLowerCase().includes(q) ||
          i.status?.toLowerCase().includes(q)
        )
      : [...this.items];
  }

  onSearch() { this.applySearch(); }

  getPeriodLabel(id: string): string {
    const p = this.periods.find(p => p.id === id);
    return p ? `${p.month}/${p.year}` : id;
  }

  openCreate() {
    this.form = { payrollPeriodId: '', status: 'DRAFT', runNumber: 1, notes: '' };
    this.editing = false; this.editingId = ''; this.error = '';
    this.showModal = true;
  }

  openEdit(item: any) {
    this.form = {
      payrollPeriodId: item.payrollPeriodId,
      status: item.status,
      runNumber: item.runNumber ?? 1,
      notes: item.notes ?? ''
    };
    this.editing = true; this.editingId = item.id; this.error = '';
    this.showModal = true;
  }

  save() {
    if (!this.form.payrollPeriodId) { this.error = 'La période de paie est obligatoire.'; return; }
    const payload: any = {
      companyId: this.auth.currentUser()?.companyId,
      payrollPeriodId: this.form.payrollPeriodId,
      status: this.form.status,
      runNumber: +this.form.runNumber || 1,
    };
    if (this.form.notes) payload.notes = this.form.notes;

    const obs = this.editing
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.error = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette exécution ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; }

  statusClass(s: string): string {
    const m: any = { DRAFT: 'badge-secondary', PROCESSING: 'badge-warning', COMPLETED: 'badge-success', CANCELLED: 'badge-danger' };
    return m[s] ?? 'badge-secondary';
  }
}