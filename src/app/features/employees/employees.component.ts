import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CompanyService, EmployeeService, DepartmentService,
  PositionService
} from '../../core/services/domain.services';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Employee, Department, Position, Company,
  CreateEmployeePayload, UpdateEmployeePayload,
  EMPLOYEE_STATUS_OPTIONS, GENDER_OPTIONS,
  FormErrors, validateRequired
} from '../../core/models';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent implements OnInit {
  items: Employee[]         = [];
  filtered: Employee[]      = [];
  companies: Company[]      = [];
  departments: Department[] = [];
  positions: Position[]     = [];

  loading   = true;
  showModal = false;
  editing   = false;
  editingId = '';
  search    = '';
  companyFilterId = '';
  showFilterPanel = false;
  pendingCompanyId = '';
  errors: FormErrors = {};

  readonly statusOptions = EMPLOYEE_STATUS_OPTIONS;
  readonly genderOptions = GENDER_OPTIONS;

  form: any = this.emptyForm();

  constructor(
    private service:  EmployeeService,
    private deptSvc:  DepartmentService,
    private posSvc:   PositionService,
    private companyService: CompanyService,
    private api:      ApiService,
    public  auth:      AuthService,
    private cdr:      ChangeDetectorRef,
  ) {}

  ngOnInit() {
    forkJoin({
      employees:   this.service.getAll().pipe(catchError(() => of([]))),
      companies:   this.companyService.getAll().pipe(catchError(() => of([]))),
      departments: this.deptSvc.getAll().pipe(catchError(() => of([]))),
      positions:   this.posSvc.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: (d) => {
        this.items       = d.employees;
        this.filtered    = d.employees;
        this.companies   = d.companies;
        this.departments = d.departments;
        this.positions   = d.positions;
        this.loading     = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => {
        this.items = data;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = `${i.firstName} ${i.lastName} ${i.email ?? ''} ${i.cin ?? ''} ${i.matricule ?? ''}`
        .toLowerCase().includes(q);
      const matchesCompany = this.companyFilterId ? i.companyId === this.companyFilterId : true;
      return matchesSearch && matchesCompany;
    });
  }

  clearCompanyFilter() {
    this.companyFilterId = '';
    this.applyFilters();
  }

  openFilterPanel() {
    this.pendingCompanyId = this.companyFilterId;
    this.showFilterPanel = true;
  }

  closeFilterPanel() {
    this.showFilterPanel = false;
  }

  togglePendingCompanySelection(companyId: string) {
    this.pendingCompanyId = this.pendingCompanyId === companyId ? '' : companyId;
  }

  isPendingCompanySelected(companyId: string): boolean {
    return this.pendingCompanyId === companyId;
  }

  applyPendingFilters() {
    this.companyFilterId = this.pendingCompanyId;
    this.applyFilters();
    this.showFilterPanel = false;
  }

  resetPendingFilters() {
    this.pendingCompanyId = '';
  }

  openCreate() {
    this.form = this.emptyForm();
    this.form.companyId = this.auth.currentUser()?.companyId ?? '';
    this.editing = false;
    this.editingId = '';
    this.errors = {};
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEdit(item: Employee) {
    this.form = {
      companyId:         item.companyId,
      employeeCode:      item.employeeCode      ?? '',
      firstName:         item.firstName,
      lastName:          item.lastName,
      cin:               item.cin               ?? '',
      cnssNumber:        item.cnssNumber         ?? '',
      matricule:         item.matricule          ?? '',
      gender:            item.gender             ?? '',
      birthDate:         item.birthDate?.slice(0, 10) ?? '',
      phone:             item.phone               ?? '',
      email:             item.email               ?? '',
      address:           item.address             ?? '',
      city:              item.city               ?? '',
      hireDate:          item.hireDate?.slice(0, 10) ?? '',
      status:            item.status,
      departmentId:      item.departmentId       ?? '',
      positionId:        item.positionId         ?? '',
      baseSalary:        item.baseSalary         ?? null,
      paymentMode:       item.paymentMode        ?? '',
      bankName:          item.bankName           ?? '',
      bankAccountNumber: item.bankAccountNumber  ?? '',
    };
    this.editing = true;
    this.editingId = item.id;
    this.errors = {};
    this.showModal = true;
    this.cdr.detectChanges();
  }

  save() {
    this.errors = validateRequired(this.form, ['firstName', 'lastName', 'hireDate']);
    if (Object.keys(this.errors).length) return;

    const payload: any = { ...this.form };
    if (!this.auth.isSuperAdmin()) {
      payload.companyId = this.auth.currentUser()?.companyId;
    }
    if (!payload.gender)       delete payload.gender;
    if (!payload.departmentId) delete payload.departmentId;
    if (!payload.positionId)   delete payload.positionId;
    if (!payload.birthDate)    delete payload.birthDate;
    if (!payload.baseSalary)   delete payload.baseSalary;

    const obs = this.editing
      ? this.service.update(this.editingId, payload as UpdateEmployeePayload)
      : this.service.create(payload as CreateEmployeePayload);

    obs.subscribe({
      next: () => {
        this.showModal = false;
        this.cdr.detectChanges();
        this.load();
      },
      error: (e: any) => {
        this.errors['api'] = e?.error?.error || 'Erreur serveur';
        this.cdr.detectChanges();
      }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cet employé ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  get filteredPositions(): Position[] {
    if (!this.form.departmentId) return this.positions;
    return this.positions.filter(p => p.departmentId === this.form.departmentId);
  }

  get filteredDepartments(): Department[] {
    if (!this.form.companyId) return this.departments;
    return this.departments.filter(d => d.companyId === this.form.companyId);
  }

  get currentCompanyName(): string {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return 'Entreprise assignée automatiquement';
    return this.companies.find(c => c.id === companyId)?.name ?? 'Entreprise assignée automatiquement';
  }

  companyName(id: string)              { return this.companies.find(c => c.id === id)?.name ?? '—'; }
  departmentName(id?: string | null)   { return id ? (this.departments.find(d => d.id === id)?.name ?? '—') : '—'; }
  positionName(id?: string | null)     { return id ? (this.positions.find(p => p.id === id)?.name ?? '—') : '—'; }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  onCompanyChange()    { this.form.departmentId = ''; this.form.positionId = ''; }
  onDepartmentChange() { this.form.positionId = ''; }
  close()              { this.showModal = false; this.cdr.detectChanges(); }
  hasError(f: string)  { return !!this.errors[f]; }

  private emptyForm(): any {
    return {
      companyId: '', employeeCode: '', firstName: '', lastName: '',
      cin: '', cnssNumber: '', matricule: '', gender: '',
      birthDate: '', phone: '', email: '', address: '', city: '',
      hireDate: '', status: 'ACTIVE', departmentId: '', positionId: '',
      baseSalary: null, paymentMode: '', bankName: '', bankAccountNumber: '',
    };
  }
}