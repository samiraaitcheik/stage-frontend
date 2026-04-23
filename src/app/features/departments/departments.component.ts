import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DepartmentService, CompanyService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import {
  Department, Company,
  CreateDepartmentPayload, UpdateDepartmentPayload,
  FormErrors, validateRequired
} from '../../core/models';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './departments.component.html',
  styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent implements OnInit {
  items: Department[]    = [];
  filtered: Department[] = [];
  companies: Company[]   = [];
  loading   = true;
  showModal = false;
  editing   = false;
  editingId = '';
  search    = '';
  selectedCompanyId = '';
  pendingCompanyId = '';
  showFilterPanel = false;
  errors: FormErrors = {};

  form: CreateDepartmentPayload = {
    companyId: '', name: '', code: '', description: '', isActive: true,
  };

  constructor(
    private service: DepartmentService,
    private companyService: CompanyService,
    private auth: AuthService,
  ) {}

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  get currentCompanyId(): string {
    return this.auth.currentUser()?.companyId ?? '';
  }

  get currentCompanyName(): string {
    const id = this.currentCompanyId;
    return this.companies.find(c => c.id === id)?.name ?? 'Entreprise';
  }

  ngOnInit() {

    const departments = this.service.getAll();
    console.log(departments);
    forkJoin({
      departments: this.service.getAll(),
      companies:   this.companyService.getAll(),
    }).subscribe({
      next: (d) => {
        this.items     = d.departments;
        this.filtered  = d.departments;
        this.companies = d.companies;
        this.loading   = false;
      },
      error: () => { this.loading = false; }
    });
  }

  load() {
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.applyFilters(); },
    });
  }

  onSearch() {
    this.applyFilters();
  }

  openFilterPanel() {
    this.pendingCompanyId = this.selectedCompanyId;
    this.showFilterPanel = true;
  }

  closeFilterPanel() {
    this.pendingCompanyId = this.selectedCompanyId;
    this.showFilterPanel = false;
  }

  togglePendingCompanySelection(companyId: string) {
    this.pendingCompanyId = this.pendingCompanyId === companyId ? '' : companyId;
  }

  isPendingCompanySelected(companyId: string): boolean {
    return this.pendingCompanyId === companyId;
  }

  applyPendingFilters() {
    this.selectedCompanyId = this.pendingCompanyId;
    this.applyFilters();
    this.closeFilterPanel();
  }

  resetPendingFilters() {
    this.pendingCompanyId = '';
  }

  removePendingCompanies() {
    this.resetPendingFilters();
  }

  removeSelectedCompany() {
    this.selectedCompanyId = '';
    this.applyFilters();
  }

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = `${i.name} ${i.code ?? ''} ${i.description ?? ''}`
        .toLowerCase().includes(q);
      const matchesCompany = this.selectedCompanyId ? i.companyId === this.selectedCompanyId : true;
      return matchesSearch && matchesCompany;
    });
  }

  openCreate() {
    this.form = {
      companyId: this.isSuperAdmin ? '' : this.currentCompanyId,
      name: '',
      code: '',
      description: '',
      isActive: true,
    };
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Department) {
    this.form = {
      companyId:   item.companyId,
      name:        item.name,
      code:        item.code        ?? '',
      description: item.description ?? '',
      isActive:    item.isActive,
    };
    this.editing = true; this.editingId = item.id; this.errors = {};
    this.showModal = true;
  }

  save() {
    if (!this.isSuperAdmin) {
      this.form.companyId = this.currentCompanyId;
    }

    this.errors = validateRequired(this.form as any, ['companyId', 'name']);
    if (Object.keys(this.errors).length) return;

    const obs = this.editing
      ? this.service.update(this.editingId, this.form as UpdateDepartmentPayload)
      : this.service.create(this.form);

    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce département ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  companyName(id: string): string {
    return this.companies.find(c => c.id === id)?.name ?? id;
  }

  close()             { this.showModal = false; }
  hasError(f: string) { return !!this.errors[f]; }
}