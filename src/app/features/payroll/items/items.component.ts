import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayrollItemService, PayrollRunService, EmployeeService } from '../../../core/services/domain.services';
import { AuthService } from '../../../core/services/auth.service';
import { PAYROLL_ITEM_TYPE_OPTIONS } from '../../../core/models';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
  styleUrls: ['./items.component.scss']
})
export class ItemsComponent implements OnInit {
  items: any[] = [];
  filtered: any[] = [];
  employees: any[] = [];
  runs: any[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  error = '';

  readonly itemTypeOptions = PAYROLL_ITEM_TYPE_OPTIONS;

  form: any = {
    payrollRunId: '', employeeId: '',
    itemType: 'BASE_SALARY', label: '', amount: 0,
    taxable: false, cnssApplicable: false
  };

  constructor(
    private service: PayrollItemService,
    private runService: PayrollRunService,
    private employeeService: EmployeeService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.load();
    this.employeeService.getAll().subscribe({ next: (d) => { this.employees = d; }, error: () => {} });
    this.runService.getAll().subscribe({ next: (d) => { this.runs = d; }, error: () => {} });
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
          i.label?.toLowerCase().includes(q) ||
          i.itemType?.toLowerCase().includes(q) ||
          this.getEmployeeName(i.employeeId).toLowerCase().includes(q)
        )
      : [...this.items];
  }

  onSearch() { this.applySearch(); }

  getEmployeeName(id: string): string {
    const e = this.employees.find(e => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  }

  getRunLabel(id: string): string {
    const r = this.runs.find(r => r.id === id);
    return r ? `Run #${r.runNumber} (${r.status})` : id;
  }

  openCreate() {
    this.form = { payrollRunId: '', employeeId: '', itemType: 'BASE_SALARY', label: '', amount: 0, taxable: false, cnssApplicable: false };
    this.editing = false; this.editingId = ''; this.error = '';
    this.showModal = true;
  }

  openEdit(item: any) {
    this.form = {
      payrollRunId: item.payrollRunId, employeeId: item.employeeId,
      itemType: item.itemType, label: item.label, amount: item.amount,
      taxable: item.taxable, cnssApplicable: item.cnssApplicable
    };
    this.editing = true; this.editingId = item.id; this.error = '';
    this.showModal = true;
  }

  save() {
    if (!this.form.payrollRunId || !this.form.employeeId || !this.form.label) {
      this.error = 'Exécution, employé et libellé sont obligatoires.'; return;
    }
    const payload: any = {
      companyId: this.auth.currentUser()?.companyId,
      payrollRunId: this.form.payrollRunId,
      employeeId: this.form.employeeId,
      itemType: this.form.itemType,
      label: this.form.label,
      amount: +this.form.amount,
      taxable: this.form.taxable,
      cnssApplicable: this.form.cnssApplicable,
    };
    const obs = this.editing
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.error = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette ligne de paie ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; }

  itemTypeClass(t: string): string {
    const m: any = { BASE_SALARY: 'badge-info', ALLOWANCE: 'badge-success', BONUS: 'badge-purple', OVERTIME: 'badge-warning', DEDUCTION: 'badge-danger', ADVANCE: 'badge-warning', TAX: 'badge-danger', CNSS: 'badge-secondary', AMO: 'badge-secondary', OTHER: 'badge-secondary' };
    return m[t] ?? 'badge-secondary';
  }
}