import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, EmployeeService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { ATTENDANCE_STATUS_OPTIONS } from '../../core/models';

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
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  error = '';

  readonly statusOptions = ATTENDANCE_STATUS_OPTIONS;

  form: any = {
    employeeId: '',
    date: '',
    status: 'PRESENT',
    workedHours: null,
    overtimeHours: null,
    lateMinutes: null,
    notes: ''
  };

  constructor(
    private service: AttendanceService,
    private employeeService: EmployeeService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.load();
    this.loadEmployees();
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({
      next: (data) => { this.employees = data; },
      error: () => {}
    });
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
          i.status?.toLowerCase().includes(q) ||
          i.date?.slice(0,10).includes(q)
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
    this.editing = false; this.editingId = ''; this.error = '';
    this.showModal = true;
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
    this.editing = true; this.editingId = item.id; this.error = '';
    this.showModal = true;
  }

  save() {
    if (!this.form.employeeId || !this.form.date || !this.form.status) {
      this.error = 'Employé, date et statut sont obligatoires.';
      return;
    }
    const payload: any = {
      companyId: this.auth.currentUser()?.companyId,
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
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.error = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette présence ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; }

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