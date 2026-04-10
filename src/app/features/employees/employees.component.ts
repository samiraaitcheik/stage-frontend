import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EmployeeService, DepartmentService,
  PositionService, CompanyService
} from '../../core/services/domain.services';
import {
  Employee, Department, Position, Company,
  CreateEmployeePayload, UpdateEmployeePayload,
  EMPLOYEE_STATUS_OPTIONS, GENDER_OPTIONS,
  FormErrors, validateRequired
} from '../../core/models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent implements OnInit {
  items: Employee[]     = [];
  filtered: Employee[]  = [];
  companies: Company[]  = [];
  departments: Department[] = [];
  positions: Position[] = [];

  loading   = true;
  showModal = false;
  editing   = false;
  editingId = '';
  search    = '';
  errors: FormErrors = {};

  readonly statusOptions = EMPLOYEE_STATUS_OPTIONS;
  readonly genderOptions = GENDER_OPTIONS;

  form: any = this.emptyForm();

  constructor(
    private service:     EmployeeService,
    private compSvc:     CompanyService,
    private deptSvc:     DepartmentService,
    private posSvc:      PositionService,
  ) {}

  ngOnInit() {
    forkJoin({
      employees:   this.service.getAll(),
      companies:   this.compSvc.getAll(),
      departments: this.deptSvc.getAll(),
      positions:   this.posSvc.getAll(),
    }).subscribe({
      next: (d) => {
        this.items       = d.employees;
        this.filtered    = d.employees;
        this.companies   = d.companies;
        this.departments = d.departments;
        this.positions   = d.positions;
        this.loading     = false;
      },
      error: () => { this.loading = false; }
    });
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.filtered = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onSearch() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i =>
      `${i.firstName} ${i.lastName} ${i.email ?? ''} ${i.cin ?? ''} ${i.matricule ?? ''}`
        .toLowerCase().includes(q)
    );
  }

  openCreate() {
    this.form = this.emptyForm();
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Employee) {
    this.form = {
      companyId:          item.companyId,
      employeeCode:       item.employeeCode       ?? '',
      firstName:          item.firstName,
      lastName:           item.lastName,
      cin:                item.cin                ?? '',
      cnssNumber:         item.cnssNumber         ?? '',
      matricule:          item.matricule           ?? '',
      gender:             item.gender              ?? '',
      birthDate:          item.birthDate?.slice(0, 10) ?? '',
      phone:              item.phone               ?? '',
      email:              item.email               ?? '',
      address:            item.address             ?? '',
      city:               item.city                ?? '',
      hireDate:           item.hireDate?.slice(0, 10) ?? '',
      status:             item.status,
      departmentId:       item.departmentId        ?? '',
      positionId:         item.positionId          ?? '',
      baseSalary:         item.baseSalary          ?? null,
      paymentMode:        item.paymentMode         ?? '',
      bankName:           item.bankName            ?? '',
      bankAccountNumber:  item.bankAccountNumber   ?? '',
    };
    this.editing = true; this.editingId = item.id; this.errors = {};
    this.showModal = true;
  }

  save() {
    this.errors = validateRequired(this.form, ['companyId', 'firstName', 'lastName', 'hireDate']);
    if (Object.keys(this.errors).length) return;

    const payload: any = { ...this.form };
    // Nettoyer les champs vides
    if (!payload.gender)       delete payload.gender;
    if (!payload.departmentId) delete payload.departmentId;
    if (!payload.positionId)   delete payload.positionId;
    if (!payload.birthDate)    delete payload.birthDate;
    if (!payload.baseSalary)   delete payload.baseSalary;

    const obs = this.editing
      ? this.service.update(this.editingId, payload as UpdateEmployeePayload)
      : this.service.create(payload as CreateEmployeePayload);

    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cet employé ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  // ✅ Positions filtrées selon le département sélectionné
  get filteredPositions(): Position[] {
    if (!this.form.departmentId) return this.positions;
    return this.positions.filter(p => p.departmentId === this.form.departmentId);
  }

  // ✅ Departments filtrés selon la company sélectionnée
  get filteredDepartments(): Department[] {
    if (!this.form.companyId) return this.departments;
    return this.departments.filter(d => d.companyId === this.form.companyId);
  }

  // Helpers affichage table
  companyName(id: string)    { return this.companies.find(c => c.id === id)?.name ?? '—'; }
  departmentName(id?: string | null) { return id ? (this.departments.find(d => d.id === id)?.name ?? '—') : '—'; }
  positionName(id?: string | null)   { return id ? (this.positions.find(p => p.id === id)?.name ?? '—') : '—'; }

  onCompanyChange() {
    // Reset département et poste si on change d'entreprise
    this.form.departmentId = '';
    this.form.positionId   = '';
  }

  onDepartmentChange() {
    // Reset poste si on change de département
    this.form.positionId = '';
  }

  close()              { this.showModal = false; }
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