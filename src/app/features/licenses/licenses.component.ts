import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LicenseService, CompanyService, SuperAdminService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import {
  License, Company,
  LicensePlanCode, LicenseStatus, BillingCycle,
} from '../../core/models';

type FormErrors = Record<string, string>;

const LICENSE_PLAN_OPTIONS: LicensePlanCode[]   = ['BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE'];
const LICENSE_STATUS_OPTIONS: LicenseStatus[]   = ['TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'];
const BILLING_CYCLE_OPTIONS: BillingCycle[]     = ['MONTHLY', 'YEARLY', 'LIFETIME'];

function validateRequired(form: any, fields: string[]): FormErrors {
  const errors: FormErrors = {};
  for (const f of fields) {
    if (!form[f] || form[f] === '') errors[f] = 'Ce champ est requis.';
  }
  return errors;
}

@Component({
  selector: 'app-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './licenses.component.html',
  styleUrls: ['./licenses.component.scss']
})
export class LicensesComponent implements OnInit {
  items: License[] = [];
  filtered: License[] = [];
  companies: Company[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  companyFilterId = '';
  showFilterPanel = false;
  pendingCompanyId = '';
  errors: FormErrors = {};
  queryCompanyId = '';

  readonly planOptions = LICENSE_PLAN_OPTIONS;
  readonly statusOptions = LICENSE_STATUS_OPTIONS;
  readonly billingOptions = BILLING_CYCLE_OPTIONS;

  form: any = this.emptyForm();

  constructor(
    private service: LicenseService,
    private companyService: CompanyService,
    private superAdminService: SuperAdminService,
    public auth: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.load();
    this.loadCompanies();
    this.route.queryParamMap.subscribe(params => {
      const companyId = params.get('companyId');
      if (companyId) {
        this.queryCompanyId = companyId;
        this.openCreate();
      }
    });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({
      next: (data) => { this.companies = data; },
      error: () => {}
    });
  }

  companyName(id: string): string {
    return this.companies.find(c => c.id === id)?.name ?? id;
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { 
        this.items = this.updateExpiredLicenses(data); 
        this.applyFilters(); 
        this.loading = false; 
      },
      error: () => { this.loading = false; }
    });
  }

  /**
   * Vérifie et met à jour le statut des licences expirées
   */
  private updateExpiredLicenses(licenses: License[]): License[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Début de la journée pour comparaison
    
    return licenses.map(license => {
      // Si la licence a une date de fin et n'est pas déjà expirée
      if (license.endsAt && license.status !== 'EXPIRED' && license.status !== 'CANCELLED') {
        const endDate = new Date(license.endsAt);
        endDate.setHours(0, 0, 0, 0); // Début de la journée pour comparaison
        
        // Si la date de fin est avant aujourd'hui
        if (endDate < today) {
          // Mettre à jour le statut côté backend
          this.updateLicenseStatus(license.id, 'EXPIRED');
          
          // Retourner la licence avec le statut mis à jour pour l'affichage
          return { ...license, status: 'EXPIRED' };
        }
      }
      return license;
    });
  }

  /**
   * Met à jour le statut d'une licence dans la base de données
   */
  private updateLicenseStatus(licenseId: string, newStatus: LicenseStatus) {
    this.service.update(licenseId, { status: newStatus }).subscribe({
      next: () => {
        console.log(`Licence ${licenseId} mise à jour: ${newStatus}`);
      },
      error: (err) => {
        console.error(`Erreur lors de la mise à jour de la licence ${licenseId}:`, err);
      }
    });
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = `${this.companyName(i.companyId)} ${i.planCode} ${i.status} ${i.billingCycle}`
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

  get isSuperAdmin(): boolean { return this.auth.isSuperAdmin(); }
  get currentCompanyId(): string { return this.auth.currentUser()?.companyId ?? ''; }
  get currentCompanyName(): string {
    const id = this.currentCompanyId;
    return this.companies.find(c => c.id === id)?.name ?? 'Entreprise assignée automatiquement';
  }

  openCreate() {
    this.form = this.emptyForm();
    if (this.queryCompanyId && this.isSuperAdmin) {
      this.form.companyId = this.queryCompanyId;
    }
    if (!this.isSuperAdmin) {
      this.form.companyId = this.currentCompanyId;
    }
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: License) {
    this.form = {
      companyId:       item.companyId,
      planCode:        item.planCode,
      status:          item.status,
      billingCycle:    item.billingCycle,
      startsAt:        item.startsAt?.slice(0, 10) ?? '',
      endsAt:          item.endsAt?.slice(0, 10)   ?? '',
      maxUsers:        item.maxUsers        ?? null,
      maxEmployees:    item.maxEmployees    ?? null,
      maxStorageMb:    item.maxStorageMb    ?? null,
      payrollEnabled:  item.payrollEnabled,
      rhEnabled:       item.rhEnabled,
      cnssEnabled:     item.cnssEnabled,
      taxEnabled:      item.taxEnabled,
      damancomEnabled: item.damancomEnabled,
      notes:           item.notes ?? '',
    };
    this.editing = true; this.editingId = item.id; this.errors = {};
    this.showModal = true;
  }

  save() {
    if (!this.isSuperAdmin) {
      this.form.companyId = this.currentCompanyId;
    }

    this.errors = validateRequired(this.form, ['companyId', 'planCode', 'startsAt']);
    if (Object.keys(this.errors).length) return;

    const next = () => { 
      this.showModal = false; 
      this.load(); // Recharge avec vérification des licences expirées
    };
    const error = (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; };

    if (this.editing) {
      this.service.update(this.editingId, this.form).subscribe({ next, error });
    } else {
      this.superAdminService.createOrUpdateLicense(this.form).subscribe({ next, error });
    }
  }

  delete(id: string) {
    if (!confirm('Supprimer cette licence ?')) return;
    this.service.delete(id).subscribe({ next: () => this.load() });
  }

  close() { this.showModal = false; }
  hasError(f: string) { return !!this.errors[f]; }

  getPlanBadgeClass(planCode: string): string {
    const map: Record<string, string> = {
      'BASIC': 'bg-secondary', 'PRO': 'bg-info',
      'BUSINESS': 'bg-warning text-dark', 'ENTERPRISE': 'bg-danger'
    };
    return map[planCode] || 'bg-secondary';
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'TRIAL': 'bg-warning text-dark', 'ACTIVE': 'bg-success',
      'EXPIRED': 'bg-danger', 'SUSPENDED': 'bg-secondary', 'CANCELLED': 'bg-dark'
    };
    return map[status] || 'bg-secondary';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'TRIAL': 'bi-clock', 'ACTIVE': 'bi-check-circle-fill',
      'EXPIRED': 'bi-x-circle-fill', 'SUSPENDED': 'bi-pause-circle-fill',
      'CANCELLED': 'bi-x-octagon-fill'
    };
    return map[status] || 'bi-question-circle';
  }

  private emptyForm(): any {
    return {
      companyId: '', planCode: 'BASIC', status: 'TRIAL',
      billingCycle: 'MONTHLY', startsAt: '', endsAt: '',
      maxUsers: null, maxEmployees: null, maxStorageMb: null,
      payrollEnabled: true, rhEnabled: true,
      cnssEnabled: false, taxEnabled: false, damancomEnabled: false,
      notes: '',
    };
  }
}