import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService, EmployeeService, CompanyService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { CONTRACT_TYPE_OPTIONS, CONTRACT_STATUS_OPTIONS, Company } from '../../core/models';

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
  companies: Company[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  companyFilterId = '';
  error = '';

  readonly typeOptions = CONTRACT_TYPE_OPTIONS;
  readonly statusOptions = CONTRACT_STATUS_OPTIONS;

  form: any = this.emptyForm();

  constructor(
    private service: ContractService,
    private employeeService: EmployeeService,
    private companyService: CompanyService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    this.loadEmployees();
    if (this.auth.isSuperAdmin()) {
      this.loadCompanies();
    }
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({ next: (d) => { this.employees = d; this.cdr.detectChanges(); } });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({ next: (data) => { this.companies = data; } });
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.applySearch(); this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = q
        ? this.getEmployeeName(i.employeeId).toLowerCase().includes(q) ||
          i.contractType?.toLowerCase().includes(q) ||
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
    return e ? `${e.firstName} ${e.lastName}` : 'Chargement...';
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  emptyForm() {
    return {
      employeeId: '', contractType: 'CDI', status: 'ACTIVE',
      startDate: new Date().toISOString().slice(0, 10), endDate: '', baseSalary: null,
      hoursPerMonth: 191, workingDaysPerMonth: 26,
      transportAllowance: null, notes: ''
    };
  }

  openCreate() {
    this.form = this.emptyForm();
    this.editing = false; this.editingId = ''; this.error = '';
    this.showModal = true;
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  save() {
    if (!this.form.employeeId || !this.form.contractType || !this.form.startDate || !this.form.baseSalary) {
      this.error = 'Champs obligatoires manquants.';
      this.cdr.detectChanges();
      return;
    }
    const employee = this.employees.find(e => e.id === this.form.employeeId);
    const payload: any = {
      companyId: employee?.companyId ?? this.auth.currentUser()?.companyId,
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

    const obs = this.editing ? this.service.update(this.editingId, payload) : this.service.create(payload);
    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.error = e?.error?.error || 'Erreur serveur'; this.cdr.detectChanges(); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; this.cdr.detectChanges(); }

  statusClass(s: string): string {
    const m: any = { ACTIVE: 'badge-success', DRAFT: 'badge-secondary', ENDED: 'badge-danger', SUSPENDED: 'badge-warning', TERMINATED: 'badge-danger' };
    return m[s] ?? 'badge-secondary';
  }

  typeClass(t: string): string {
    const m: any = { CDI: 'badge-success', CDD: 'badge-info', STAGE: 'badge-warning', INTERIM: 'badge-purple', FREELANCE: 'badge-secondary' };
    return m[t] ?? 'badge-secondary';
  }
}