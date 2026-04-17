import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PositionService, CompanyService, DepartmentService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import {
  Position, Company, Department,
  CreatePositionPayload, UpdatePositionPayload,
  FormErrors, validateRequired
} from '../../core/models';

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './positions.component.html',
  styleUrls: ['./positions.component.scss']
})
export class PositionsComponent implements OnInit {
  items: Position[]      = [];
  filtered: Position[]   = [];
  companies: Company[]   = [];
  departments: Department[] = [];
  loading   = true;
  showModal = false;
  editing   = false;
  editingId = '';
  search    = '';
  companyFilterId = '';
  errors: FormErrors = {};

  form: CreatePositionPayload = {
    companyId: '', name: '', departmentId: '',
    code: '', description: '', isActive: true,
  };

  constructor(
    private service: PositionService,
    private companyService: CompanyService,
    private deptService: DepartmentService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    forkJoin({
      positions:   this.service.getAll(),
      companies:   this.companyService.getAll(),
      departments: this.deptService.getAll(),
    }).subscribe({
      next: (d) => {
        this.items       = d.positions;
        this.filtered    = d.positions;
        this.companies   = d.companies;
        this.departments = d.departments;
        this.loading     = false;
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

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = `${i.name} ${i.code ?? ''} ${i.description ?? ''}`
        .toLowerCase().includes(q);
      const matchesCompany = this.companyFilterId ? i.companyId === this.companyFilterId : true;
      return matchesSearch && matchesCompany;
    });
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  get currentCompanyId(): string {
    return this.auth.currentUser()?.companyId ?? '';
  }

  get currentCompanyName(): string {
    const companyId = this.currentCompanyId;
    return this.companies.find(c => c.id === companyId)?.name ?? 'Entreprise assignée automatiquement';
  }

  openCreate() {
    this.form = {
      companyId: this.isSuperAdmin ? '' : this.currentCompanyId,
      name: '', departmentId: '', code: '', description: '', isActive: true
    };
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Position) {
    this.form = {
      companyId:    item.companyId,
      name:         item.name,
      departmentId: item.departmentId ?? '',
      code:         item.code         ?? '',
      description:  item.description  ?? '',
      isActive:     item.isActive,
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

    const payload = { ...this.form };
    if (!payload.departmentId) delete payload.departmentId;

    const obs = this.editing
      ? this.service.update(this.editingId, payload as UpdatePositionPayload)
      : this.service.create(payload);

    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce poste ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  /** Départements filtrés selon la company sélectionnée dans le formulaire */
  get filteredDepts(): Department[] {
    if (!this.form.companyId) return this.departments;
    return this.departments.filter(d => d.companyId === this.form.companyId);
  }

  /** Réinitialise le département si on change d'entreprise */
  onCompanyChange() { this.form.departmentId = ''; }

  companyName(id: string)    { return this.companies.find(c => c.id === id)?.name    ?? id; }
  departmentName(id: string) { return this.departments.find(d => d.id === id)?.name  ?? '—'; }

  close()             { this.showModal = false; }
  hasError(f: string) { return !!this.errors[f]; }
}