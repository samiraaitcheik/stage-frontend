import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, EmployeeService, CompanyService, DepartmentService } from '../../core/services/domain.services';
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
  filteredEmployees: any[] = [];
  companies: Company[] = [];
  departments: any[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  showFilterPanel = false;
  search = '';
  companyFilterId = '';
  pendingCompanyFilterId = '';
  statusFilter = '';
  pendingStatusFilter = '';
  error = '';

  readonly statusOptions = ATTENDANCE_STATUS_OPTIONS;

  form: any = this.emptyForm();

  constructor(
    private service: AttendanceService,
    private employeeService: EmployeeService,
    private companyService: CompanyService,
    private departmentService: DepartmentService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef // Bach l-modal t-reagi de suite
  ) {}

  ngOnInit() {
    this.load();
    this.loadEmployees();
    this.loadDepartments();
    if (this.auth.isSuperAdmin()) {
      this.loadCompanies();
    }
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({
      next: (data) => {
        this.employees = data;
        this.filteredEmployees = [...this.employees];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({ next: (data) => { this.companies = data; } });
  }

  loadDepartments() {
    this.departmentService.getAll().subscribe({
      next: (data: any) => {
        this.departments = data;
      },
      error: () => {
        console.error('Error loading departments');
      }
    });
  }

  onDepartmentChange() {
    // Filter employees based on selected department
    if (this.form.departmentId) {
      this.filteredEmployees = this.employees.filter(emp => emp.departmentId === this.form.departmentId);
      console.log('Filtered employees by department:', this.form.departmentId, this.filteredEmployees.length);
    } else {
      this.filteredEmployees = [...this.employees];
      console.log('All employees shown');
    }
    
    // Clear employee selection if it doesn't match the filtered list
    if (this.form.employeeId && !this.filteredEmployees.find(emp => emp.id === this.form.employeeId)) {
      this.form.employeeId = '';
    }
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
      const matchesStatus = this.statusFilter
        ? i.status === this.statusFilter
        : true;
      return matchesSearch && matchesCompany && matchesStatus;
    });
  }

  onSearch() { this.applySearch(); }

  openFilterPanel() {
    this.pendingCompanyFilterId = this.companyFilterId;
    this.pendingStatusFilter = this.statusFilter;
    this.showFilterPanel = true;
  }

  closeFilterPanel() {
    this.showFilterPanel = false;
  }

  togglePendingCompanySelection(companyId: string) {
    this.pendingCompanyFilterId = this.pendingCompanyFilterId === companyId ? '' : companyId;
  }

  togglePendingStatusSelection(status: string) {
    this.pendingStatusFilter = this.pendingStatusFilter === status ? '' : status;
  }

  applyPendingFilters() {
    this.companyFilterId = this.pendingCompanyFilterId;
    this.statusFilter = this.pendingStatusFilter;
    this.showFilterPanel = false;
    this.applySearch();
  }

  resetPendingFilters() {
    this.pendingCompanyFilterId = '';
    this.pendingStatusFilter = '';
  }

  clearCompanyFilter() {
    this.companyFilterId = '';
    this.applySearch();
  }

  clearStatusFilter() {
    this.statusFilter = '';
    this.applySearch();
  }

  getEmployeeName(id: string): string {
    const e = this.employees.find(e => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : 'Employé inconnu';
  }

  companyName(id: string): string {
    return this.companies.find(c => c.id === id)?.name ?? 'â';
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  emptyForm() {
    return {
      employeeId: '',
      departmentId: '',
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
    this.filteredEmployees = [...this.employees]; // Reset filtered employees
    this.cdr.detectChanges(); // Force display
  }

  openEdit(item: any) {
    const employee = this.employees.find(e => e.id === item.employeeId);
    this.form = {
      employeeId: item.employeeId,
      departmentId: employee?.departmentId || '',
      date: item.date?.slice(0, 10),
      status: item.status,
      workedHours: item.workedHours ?? null,
      overtimeHours: item.overtimeHours ?? null,
      lateMinutes: item.lateMinutes ?? null,
      notes: item.notes ?? ''
    };
    this.onDepartmentChange(); // Apply department filter
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
      date: this.formatDateToISO(this.form.date),
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

  formatDateToISO(dateString: string): string {
    // Convert from DD/MM/YYYY to YYYY-MM-DD format
    if (!dateString) return '';
    
    // Check if already in ISO format
    if (dateString.includes('-')) {
      return new Date(dateString).toISOString();
    }
    
    // Parse DD/MM/YYYY format
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const isoDate = `${year}-${month}-${day}`;
      return new Date(isoDate).toISOString();
    }
    
    return new Date(dateString).toISOString();
  }
}
