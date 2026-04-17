import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VariableItemService, EmployeeService, CompanyService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { VARIABLE_ITEM_TYPE_OPTIONS, VARIABLE_VALUE_TYPE_OPTIONS, VARIABLE_ITEM_STATUS_OPTIONS, Company } from '../../core/models';

@Component({
  selector: 'app-variable-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variable-items.component.html',
  styleUrls: ['./variable-items.component.scss']
})
export class VariableItemsComponent implements OnInit {
  items: any[] = [];
  filtered: any[] = [];
  employees: any[] = [];
  companies: Company[] = [];
  periods: any[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  companyFilterId = '';
  error = '';

  readonly typeOptions = VARIABLE_ITEM_TYPE_OPTIONS;
  readonly valueTypeOptions = VARIABLE_VALUE_TYPE_OPTIONS;
  readonly statusOptions = VARIABLE_ITEM_STATUS_OPTIONS;

  form: any = {
    employeeId: '',
    type: 'ALLOWANCE',
    valueType: 'FIXED',
    label: '',
    amount: 0,
    effectiveDate: '',
    payrollPeriodId: '',
    status: 'PENDING',
    notes: ''
  };

  constructor(
    private service: VariableItemService,
    private employeeService: EmployeeService,
    private companyService: CompanyService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.load();
    this.employeeService.getAll().subscribe({ next: (d) => { this.employees = d; }, error: () => {} });
    if (this.auth.isSuperAdmin()) {
      this.loadCompanies();
    }
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.applySearch(); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({ next: (data) => { this.companies = data; } });
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = q
        ? this.getEmployeeName(i.employeeId).toLowerCase().includes(q) ||
          i.type?.toLowerCase().includes(q) ||
          i.label?.toLowerCase().includes(q) ||
          i.status?.toLowerCase().includes(q)
        : true;
      const employee = this.employees.find(e => e.id === i.employeeId);
      const matchesCompany = this.companyFilterId
        ? employee?.companyId === this.companyFilterId
        : true;
      return matchesSearch && matchesCompany;
    });
  }

  onSearch() { this.applySearch(); }

  getEmployeeName(id: string): string {
    const e = this.employees.find(e => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  getPeriodLabel(id: string): string {
    const p = this.periods.find(p => p.id === id);
    return p ? `${p.month}/${p.year}` : '—';
  }

  emptyForm() {
    return {
      employeeId: '', type: 'ALLOWANCE', valueType: 'FIXED',
      label: '', amount: 0,
      effectiveDate: new Date().toISOString().slice(0, 10),
      payrollPeriodId: '', status: 'PENDING', notes: ''
    };
  }

  openCreate() {
    this.form = this.emptyForm();
    this.editing = false; this.editingId = ''; this.error = '';
    this.showModal = true;
  }

  openEdit(item: any) {
    this.form = {
      employeeId: item.employeeId,
      type: item.type,
      valueType: item.valueType ?? 'FIXED',
      label: item.label,
      amount: item.amount,
      effectiveDate: item.effectiveDate?.slice(0, 10),
      payrollPeriodId: item.payrollPeriodId ?? '',
      status: item.status,
      notes: item.notes ?? ''
    };
    this.editing = true; this.editingId = item.id; this.error = '';
    this.showModal = true;
  }

  save() {
    if (!this.form.employeeId || !this.form.type || !this.form.label || !this.form.effectiveDate) {
      this.error = 'Employé, type, libellé et date effective sont obligatoires.';
      return;
    }
    const payload: any = {
      companyId: this.auth.currentUser()?.companyId,
      employeeId: this.form.employeeId,
      type: this.form.type,
      valueType: this.form.valueType,
      label: this.form.label,
      amount: +this.form.amount,
      effectiveDate: this.form.effectiveDate,
      status: this.form.status,
    };
    if (this.form.payrollPeriodId) payload.payrollPeriodId = this.form.payrollPeriodId;
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
    if (!confirm('Supprimer cet élément variable ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; }

  typeClass(t: string): string {
    const m: any = { ALLOWANCE: 'badge-success', BONUS: 'badge-info', DEDUCTION: 'badge-danger', ADVANCE: 'badge-warning', OVERTIME: 'badge-purple', OTHER: 'badge-secondary' };
    return m[t] ?? 'badge-secondary';
  }

  statusClass(s: string): string {
    const m: any = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger', APPLIED: 'badge-info', CANCELLED: 'badge-secondary' };
    return m[s] ?? 'badge-secondary';
  }
}