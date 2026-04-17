import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, EmployeeService, CompanyService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { ATTENDANCE_STATUS_OPTIONS, Company } from '../../core/models';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss']
})
export class AttendanceComponent implements OnInit {
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

  readonly statusOptions = ATTENDANCE_STATUS_OPTIONS;

  form: any = this.emptyForm();

  constructor(
    private service: AttendanceService,
    private employeeService: EmployeeService,
    private companyService: CompanyService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef // Bach l-modal t-reagi de suite
  ) {}

  ngOnInit() {
    this.load();
    this.loadEmployees();
    if (this.auth.isSuperAdmin()) {
      this.loadCompanies();
    }
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({
      next: (data) => {
        this.employees = data;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({ next: (data) => { this.companies = data; } });
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { 
        this.items = data; 
        this.applySearch(); 
        this.loading = false; 
        this.cdr.detectChanges();
      },
      error: () => { 
        this.loading = false; 
        this.cdr.detectChanges();
      }
    });
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = q
        ? this.getEmployeeName(i.employeeId).toLowerCase().includes(q) ||
          i.status?.toLowerCase().includes(q) ||
          i.date?.slice(0,10).includes(q)
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
    return e ? `${e.firstName} ${e.lastName}` : 'Employé inconnu';
  }

  companyName(id: string): string {
    return this.companies.find(c => c.id === id)?.name ?? '—';
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  emptyForm() {
    return {
      employeeId: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'PRESENT',
      workedHours: null,
      overtimeHours: null,
      lateMinutes: null,
      notes: ''
    };
  }

  openCreate() {
    this.form = this.emptyForm();
    this.editing = false; 
    this.editingId = ''; 
    this.error = '';
    this.showModal = true;
    this.cdr.detectChanges(); // Force display
  }

  openEdit(item: any) {
    this.form = {
      employeeId: item.employeeId,
      date: item.date?.slice(0, 10),
      status: item.status,
      workedHours: item.workedHours ?? null,
      overtimeHours: item.overtimeHours ?? null,
      lateMinutes: item.lateMinutes ?? null,
      notes: item.notes ?? ''
    };
    this.editing = true; 
    this.editingId = item.id; 
    this.error = '';
    this.showModal = true;
    this.cdr.detectChanges(); // Force display
  }

  save() {
    if (!this.form.employeeId || !this.form.date || !this.form.status) {
      this.error = 'Employé, date et statut sont obligatoires.';
      this.cdr.detectChanges();
      return;
    }

    const employee = this.employees.find(e => e.id === this.form.employeeId);
    const payload: any = {
      companyId: employee?.companyId ?? this.auth.currentUser()?.companyId,
      employeeId: this.form.employeeId,
      date: this.form.date,
      status: this.form.status,
    };

    if (this.form.workedHours !== null && this.form.workedHours !== '') payload.workedHours = +this.form.workedHours;
    if (this.form.overtimeHours !== null && this.form.overtimeHours !== '') payload.overtimeHours = +this.form.overtimeHours;
    if (this.form.lateMinutes !== null && this.form.lateMinutes !== '') payload.lateMinutes = +this.form.lateMinutes;
    if (this.form.notes) payload.notes = this.form.notes;

    const obs = this.editing
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);

    obs.subscribe({
      next: () => { 
        this.showModal = false; 
        this.load(); 
        this.cdr.detectChanges();
      },
      error: (e) => { 
        this.error = e?.error?.error || 'Erreur serveur'; 
        this.cdr.detectChanges();
      }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette présence ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { 
    this.showModal = false; 
    this.cdr.detectChanges();
  }

  statusLabel(s: string): string {
    const map: any = {
      PRESENT: 'Présent', ABSENT: 'Absent', SICK_LEAVE: 'Congé maladie',
      PAID_LEAVE: 'Congé payé', UNPAID_LEAVE: 'Congé non payé',
      HOLIDAY: 'Jour férié', OTHER: 'Autre'
    };
    return map[s] ?? s;
  }

  statusClass(s: string): string {
    const map: any = {
      PRESENT: 'badge-success', ABSENT: 'badge-danger',
      SICK_LEAVE: 'badge-warning', PAID_LEAVE: 'badge-info',
      UNPAID_LEAVE: 'badge-secondary', HOLIDAY: 'badge-purple', OTHER: 'badge-secondary'
    };
    return map[s] ?? 'badge-secondary';
  }
}