import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService, EmployeeService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { CONTRACT_TYPE_OPTIONS, CONTRACT_STATUS_OPTIONS } from '../../core/models';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contracts.component.html',
  styleUrls: ['./contracts.component.scss']
})
export class ContractsComponent implements OnInit {
  items: any[] = [];
  filtered: any[] = [];
  employees: any[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  error = '';

  readonly typeOptions = CONTRACT_TYPE_OPTIONS;
  readonly statusOptions = CONTRACT_STATUS_OPTIONS;

  form: any = {
    employeeId: '',
    contractType: 'CDI',
    status: 'DRAFT',
    startDate: '',
    endDate: '',
    baseSalary: 0,
    hoursPerMonth: null,
    workingDaysPerMonth: null,
    transportAllowance: null,
    notes: ''
  };

  constructor(
    private service: ContractService,
    private employeeService: EmployeeService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.load();
    this.loadEmployees();
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({ next: (d) => { this.employees = d; }, error: () => {} });
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
          this.getEmployeeName(i.employeeId).toLowerCase().includes(q) ||
          i.contractType?.toLowerCase().includes(q) ||
          i.status?.toLowerCase().includes(q)
        )
      : [...this.items];
  }

  onSearch() { this.applySearch(); }

  getEmployeeName(id: string): string {
    const e = this.employees.find(e => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  }

  emptyForm() {
    return {
      employeeId: '', contractType: 'CDI', status: 'DRAFT',
      startDate: '', endDate: '', baseSalary: 0,
      hoursPerMonth: null, workingDaysPerMonth: null,
      transportAllowance: null, notes: ''
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
      contractType: item.contractType,
      status: item.status,
      startDate: item.startDate?.slice(0, 10),
      endDate: item.endDate?.slice(0, 10) ?? '',
      baseSalary: item.baseSalary,
      hoursPerMonth: item.hoursPerMonth ?? null,
      workingDaysPerMonth: item.workingDaysPerMonth ?? null,
      transportAllowance: item.transportAllowance ?? null,
      notes: item.notes ?? ''
    };
    this.editing = true; this.editingId = item.id; this.error = '';
    this.showModal = true;
  }

  save() {
    if (!this.form.employeeId || !this.form.contractType || !this.form.startDate || !this.form.baseSalary) {
      this.error = 'Employé, type, date de début et salaire de base sont obligatoires.';
      return;
    }
    const payload: any = {
      companyId: this.auth.currentUser()?.companyId,
      employeeId: this.form.employeeId,
      contractType: this.form.contractType,
      status: this.form.status,
      startDate: this.form.startDate,
      baseSalary: +this.form.baseSalary,
    };
    if (this.form.endDate) payload.endDate = this.form.endDate;
    if (this.form.hoursPerMonth) payload.hoursPerMonth = +this.form.hoursPerMonth;
    if (this.form.workingDaysPerMonth) payload.workingDaysPerMonth = +this.form.workingDaysPerMonth;
    if (this.form.transportAllowance) payload.transportAllowance = +this.form.transportAllowance;
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
    if (!confirm('Supprimer ce contrat ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; }

  statusClass(s: string): string {
    const m: any = { ACTIVE: 'badge-success', DRAFT: 'badge-secondary', ENDED: 'badge-danger', SUSPENDED: 'badge-warning', TERMINATED: 'badge-danger' };
    return m[s] ?? 'badge-secondary';
  }

  typeClass(t: string): string {
    const m: any = { CDI: 'badge-success', CDD: 'badge-info', STAGE: 'badge-warning', INTERIM: 'badge-purple', FREELANCE: 'badge-secondary', OTHER: 'badge-secondary' };
    return m[t] ?? 'badge-secondary';
  }
}