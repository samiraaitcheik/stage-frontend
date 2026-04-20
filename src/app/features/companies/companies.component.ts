import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService, LicenseService, UserService, SuperAdminService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Company, CreateCompanyPayload, UpdateCompanyPayload,
  CreateCompanyWithLicenseAndUsersPayload, CreateLicensePayload, CreateUserPayload,
  COMPANY_STATUS_OPTIONS, LICENSE_PLAN_OPTIONS, LICENSE_STATUS_OPTIONS, BILLING_CYCLE_OPTIONS,
  FormErrors, validateRequired
} from '../../core/models';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './companies.component.html',
  styleUrls: ['./companies.component.scss']
})
export class CompaniesComponent implements OnInit {
  items: Company[] = [];
  filtered: Company[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  selectedCompanyIds: string[] = [];
  selectedStatuses: string[] = [];
  errors: FormErrors = {};
  createMode: 'simple' | 'combined' = 'combined';

  selectedCompany?: Company;
  selectedLicense: any = null;
  selectedCompanyUsers: any[] = [];
  showDetailsModal = false;
  activeDetailsTab: 'company' | 'license' | 'users' = 'company';
  detailEditSection: 'company' | 'license' | 'users' = 'company';

  readonly statusOptions = COMPANY_STATUS_OPTIONS;
  readonly planOptions = LICENSE_PLAN_OPTIONS;
  readonly licenseStatusOptions = LICENSE_STATUS_OPTIONS;
  readonly billingOptions = BILLING_CYCLE_OPTIONS;

  readonly USER_ROLES = ['ADMIN', 'HR_MANAGER', 'PAYROLL_MANAGER', 'EMPLOYEE', 'VIEWER'];
  readonly PERMISSIONS = [
    { key: 'dashboard', label: 'Tableau de bord' },
    { key: 'employees', label: 'Employés' },
    { key: 'payroll', label: 'Paie' },
    { key: 'organisation', label: 'Organisation' },
    { key: 'attendance', label: 'Présences' },
    { key: 'contracts', label: 'Contrats' },
    { key: 'reports', label: 'Rapports CNSS' },
    { key: 'licenses', label: 'Licences' },
    { key: 'users', label: 'Utilisateurs' },
  ];

  readonly ROLE_PRESETS: Record<string, string[]> = {
    ADMIN: [
      'dashboard', 'employees', 'organisation', 'attendance',
      'contracts', 'payroll', 'reports', 'licenses', 'users',
    ],
    HR_MANAGER: ['dashboard', 'employees', 'attendance', 'contracts', 'reports', 'users'],
    PAYROLL_MANAGER: ['dashboard', 'payroll', 'attendance', 'users'],
    EMPLOYEE: ['dashboard', 'users'],
    VIEWER: ['dashboard', 'users'],
  };

  combinedForm: CreateCompanyWithLicenseAndUsersPayload = this.emptyCombinedForm();
  form: CreateCompanyPayload = this.emptyForm();

  showPassword: { [key: number]: boolean } = {};
  showFilterPanel = false;
  filterPanelTab: 'company' | 'status' = 'company';
  pendingCompanyIds: string[] = [];
  pendingStatuses: string[] = [];

  constructor(
    private service: CompanyService,
    private licenseService: LicenseService,
    private userService: UserService,
    private superAdminService: SuperAdminService,
    public auth: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.filtered = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  // ─── Filter Panel ───────────────────────────────────────────────────────────

  openFilterPanel() {
    this.pendingCompanyIds = [...this.selectedCompanyIds];
    this.pendingStatuses = [...this.selectedStatuses];
    this.showFilterPanel = true;
  }

  closeFilterPanel() {
    this.pendingCompanyIds = [...this.selectedCompanyIds];
    this.pendingStatuses = [...this.selectedStatuses];
    this.showFilterPanel = false;
  }

  setFilterPanelTab(tab: 'company' | 'status') {
    this.filterPanelTab = tab;
  }

  togglePendingCompanySelection(companyId: string) {
    const index = this.pendingCompanyIds.indexOf(companyId);
    index >= 0 ? this.pendingCompanyIds.splice(index, 1) : this.pendingCompanyIds.push(companyId);
  }

  isPendingCompanySelected(companyId: string): boolean {
    return this.pendingCompanyIds.includes(companyId);
  }

  togglePendingStatusSelection(status: string) {
    const index = this.pendingStatuses.indexOf(status);
    index >= 0 ? this.pendingStatuses.splice(index, 1) : this.pendingStatuses.push(status);
  }

  isPendingStatusSelected(status: string): boolean {
    return this.pendingStatuses.includes(status);
  }

  applyPendingFilters() {
    this.selectedCompanyIds = [...this.pendingCompanyIds];
    this.selectedStatuses = [...this.pendingStatuses];
    this.applyFilters();
    this.showFilterPanel = false;
  }

  resetPendingFilters() {
    this.pendingCompanyIds = [];
    this.pendingStatuses = [];
  }

  removeSelectedCompany(companyId: string) {
    const index = this.selectedCompanyIds.indexOf(companyId);
    if (index >= 0) { this.selectedCompanyIds.splice(index, 1); this.applyFilters(); }
  }

  removeSelectedStatus(status: string) {
    const index = this.selectedStatuses.indexOf(status);
    if (index >= 0) { this.selectedStatuses.splice(index, 1); this.applyFilters(); }
  }

  onSearch() { this.applyFilters(); }

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter((item) => {
      const matchSearch = `${item.name} ${item.legalName ?? ''} ${item.email ?? ''} ${item.phone ?? ''} ${item.city ?? ''}`
        .toLowerCase().includes(q);
      const matchCompany = this.selectedCompanyIds.length === 0 || this.selectedCompanyIds.includes(item.id);
      const matchStatus  = this.selectedStatuses.length === 0   || this.selectedStatuses.includes(item.status);
      return matchSearch && matchCompany && matchStatus;
    });
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  openCreate() {
    this.createMode = 'combined';
    this.form = this.emptyForm();
    this.combinedForm = this.emptyCombinedForm();
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Company) {
    this.form = {
      name:          item.name,
      legalName:     item.legalName      ?? '',
      taxIdentifier: item.taxIdentifier  ?? '',
      rcNumber:      item.rcNumber       ?? '',
      iceNumber:     item.iceNumber      ?? '',
      cnssNumber:    item.cnssNumber     ?? '',
      email:         item.email          ?? '',
      phone:         item.phone          ?? '',
      address:       item.address        ?? '',
      city:          item.city           ?? '',
      country:       item.country        ?? 'Maroc',
      timezone:      item.timezone       ?? 'Africa/Casablanca',
      currency:      item.currency       ?? 'MAD',
      status:        item.status,
    };
    this.editing = true; this.editingId = item.id; this.errors = {};
    this.showModal = true;
  }

  save() {
    if (this.editing) {
      this.errors = validateRequired(this.form as any, ['name']);
      if (Object.keys(this.errors).length) return;

      this.service.update(this.editingId, this.form as UpdateCompanyPayload).subscribe({
        next: () => {
          this.showModal = false;
          this.load();
          this.toastService.success('Entreprise modifiée avec succès');
        },
        error: (e: any) => {
          this.errors['api'] = e?.error?.error || 'Erreur serveur';
          this.toastService.error('Erreur lors de la modification');
        }
      });

    } else {
      if (this.createMode === 'simple') {
        this.errors = validateRequired(this.form as any, ['name']);
        if (Object.keys(this.errors).length) return;

        this.superAdminService.createCompany(this.form).subscribe({
          next: () => {
            this.showModal = false;
            this.load();
            this.toastService.success('Entreprise créée avec succès');
          },
          error: (e: any) => {
            this.errors['api'] = e?.error?.error || 'Erreur serveur';
            this.toastService.error('Erreur lors de la création');
          }
        });

      } else {
        this.errors = this.validateCombinedForm();
        if (Object.keys(this.errors).length) return;

        this.superAdminService.createCompanyWithLicenseAndUsers(this.combinedForm).subscribe({
          next: () => {
            this.showModal = false;
            this.load();
            this.toastService.success('Entreprise, licence et utilisateurs créés avec succès');
          },
          error: (e: any) => {
            this.errors['api'] = e?.error?.error || 'Erreur serveur';
            this.toastService.error('Erreur lors de la création');
          }
        });
      }
    }
  }

  delete(id: string) {
    if (!confirm('Supprimer cette entreprise ?')) return;
    this.service.delete(id).subscribe({
      next: () => { this.load(); this.toastService.success('Entreprise supprimée'); },
      error: () => { this.toastService.error('Erreur lors de la suppression'); }
    });
  }

  // ─── Details Modal ──────────────────────────────────────────────────────────

  viewDetails(company: Company) {
    this.selectedCompany = company;
    this.activeDetailsTab = 'company';
    this.detailEditSection = 'company';
    this.showDetailsModal = true;
    this.loadCompanyLicense(company.id);
    this.loadCompanyUsers(company.id);
  }

  loadCompanyLicense(companyId: string) {
    this.selectedLicense = null;
    this.licenseService.getByCompany(companyId).subscribe({
      next: (license) => { this.selectedLicense = license; },
      error: () => { this.selectedLicense = null; }
    });
  }

  loadCompanyUsers(companyId: string) {
    this.selectedCompanyUsers = [];
    this.superAdminService.getCompanyUsers(companyId).subscribe({
      next: (response) => { this.selectedCompanyUsers = response.users; },
      error: () => { this.selectedCompanyUsers = []; }
    });
  }

  saveCompanyDetails() {
    if (!this.selectedCompany) return;

    const loadingId = this.toastService.loading('Modification en cours...');

    const payload: UpdateCompanyPayload = {
      name:          this.selectedCompany.name ?? undefined,
      legalName:     this.selectedCompany.legalName ?? undefined,
      taxIdentifier: this.selectedCompany.taxIdentifier ?? undefined,
      rcNumber:      this.selectedCompany.rcNumber ?? undefined,
      iceNumber:     this.selectedCompany.iceNumber ?? undefined,
      cnssNumber:    this.selectedCompany.cnssNumber ?? undefined,
      email:         this.selectedCompany.email ?? undefined,
      phone:         this.selectedCompany.phone ?? undefined,
      address:       this.selectedCompany.address ?? undefined,
      city:          this.selectedCompany.city ?? undefined,
      country:       this.selectedCompany.country ?? undefined,
      timezone:      this.selectedCompany.timezone ?? undefined,
      currency:      this.selectedCompany.currency ?? undefined,
      status:        this.selectedCompany.status ?? undefined,
    };

    this.service.update(this.selectedCompany.id, payload).subscribe({
      next: () => {
        this.toastService.update(loadingId, 'Entreprise modifiée avec succès', 'success', 4000);
        this.detailEditSection = '' as any;
        this.load();
      },
      error: (e: any) => {
        this.toastService.update(loadingId, 'Erreur lors de la modification', 'error', 4000);
        this.errors['api'] = e?.error?.error || 'Erreur serveur';
      }
    });
  }

  saveLicenseDetails() {
    if (!this.selectedCompany) return;

    const loadingId = this.toastService.loading('Modification de la licence en cours...');

    const payload = {
      ...(this.selectedLicense || {}),
      companyId: this.selectedCompany.id,
    };

    const onNext = () => {
      this.toastService.update(loadingId, 'Licence mise à jour avec succès', 'success', 4000);
      this.detailEditSection = '' as any;
      this.load();
    };
    const onError = (e: any) => {
      this.toastService.update(loadingId, 'Erreur lors de la mise à jour de la licence', 'error', 4000);
      this.errors['api'] = e?.error?.error || 'Erreur serveur';
    };

    if (this.selectedLicense?.id) {
      this.licenseService.update(this.selectedLicense.id, payload).subscribe({ next: onNext, error: onError });
    } else {
      this.licenseService.create(payload).subscribe({ next: onNext, error: onError });
    }
  }

  cancelCompanyEdit() {
    console.log('Annulation des modifications entreprise');
    // Fermer le panneau d'édition
    this.detailEditSection = '' as any;
    // Afficher un message de succès pour l'annulation
    this.toastService.success('Modifications annulées avec succès', 3000);
  }

  cancelLicenseEdit() {
    console.log('Annulation des modifications licence');
    // Fermer le panneau d'édition
    this.detailEditSection = '' as any;
    // Afficher un message de succès pour l'annulation
    this.toastService.success('Modifications de la licence annulées avec succès', 3000);
  }

  onDetailsUsers() {
    if (!this.selectedCompany) return;
    this.router.navigate(['/users'], { queryParams: { companyId: this.selectedCompany.id } });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  close() { this.showModal = false; }
  hasError(f: string) { return !!this.errors[f]; }

  get isSuperAdmin(): boolean { return this.auth.isSuperAdmin(); }

  private emptyForm(): CreateCompanyPayload {
    return {
      name: '', legalName: '', taxIdentifier: '', rcNumber: '',
      iceNumber: '', cnssNumber: '', email: '', phone: '',
      address: '', city: '', country: 'Maroc',
      timezone: 'Africa/Casablanca', currency: 'MAD', status: 'ACTIVE',
    };
  }

  private emptyCombinedForm(): CreateCompanyWithLicenseAndUsersPayload {
    return {
      company: this.emptyForm(),
      license: {
        planCode: 'BASIC',
        status: 'TRIAL',
        billingCycle: 'MONTHLY',
        startsAt: new Date().toISOString().split('T')[0],
        endsAt: '',
        maxUsers: undefined,
        maxEmployees: undefined,
        maxStorageMb: undefined,
        payrollEnabled: true,
        rhEnabled: true,
        cnssEnabled: false,
        taxEnabled: false,
        damancomEnabled: false,
        notes: '',
      },
      users: [{
        firstName: '', lastName: '', email: '', password: '',
        phone: '', role: 'ADMIN', status: 'ACTIVE',
        permissions: ['dashboard', 'employees', 'organisation', 'attendance', 'contracts', 'payroll', 'reports', 'users'],
      }],
    };
  }

  private validateCombinedForm(): FormErrors {
    const errors: FormErrors = {};

    if (!this.combinedForm.company.name?.trim()) {
      errors['company.name'] = 'Le nom de l\'entreprise est obligatoire';
    }
    if (!this.combinedForm.license.planCode) {
      errors['license.planCode'] = 'Le plan de licence est obligatoire';
    }
    if (!this.combinedForm.license.startsAt) {
      errors['license.startsAt'] = 'La date de début de licence est obligatoire';
    }
    if (!this.combinedForm.users?.length) {
      errors['users'] = 'Au moins un utilisateur doit être ajouté';
    } else {
      this.combinedForm.users.forEach((user, i) => {
        if (!user.firstName?.trim()) errors[`users.${i}.firstName`] = 'Le prénom est obligatoire';
        if (!user.lastName?.trim())  errors[`users.${i}.lastName`]  = 'Le nom est obligatoire';
        if (!user.email?.trim())     errors[`users.${i}.email`]     = 'L\'email est obligatoire';
        if (!user.password?.trim())  errors[`users.${i}.password`]  = 'Le mot de passe est obligatoire';
        if (!user.role)              errors[`users.${i}.role`]      = 'Le rôle est obligatoire';
      });
    }

    return errors;
  }

  // ─── Permissions ────────────────────────────────────────────────────────────

  isUserPermChecked(user: any, key: string): boolean {
    return Array.isArray(user.permissions) && user.permissions.includes(key);
  }

  toggleUserPermission(user: any, key: string) {
    if (!Array.isArray(user.permissions)) user.permissions = [];
    const idx = user.permissions.indexOf(key);
    idx >= 0 ? user.permissions.splice(idx, 1) : user.permissions.push(key);
  }

  onUserRoleChange(user: any) {
    if (user.role && this.ROLE_PRESETS[user.role]) {
      user.permissions = [...this.ROLE_PRESETS[user.role]];
    }
  }

  // ─── Users (formulaire combiné) ─────────────────────────────────────────────

  addUser() {
    this.combinedForm.users.push({
      firstName: '', lastName: '', email: '', password: '',
      phone: '', role: 'ADMIN', status: 'ACTIVE',
      permissions: ['dashboard', 'employees', 'organisation', 'attendance', 'contracts', 'payroll', 'reports', 'users'],
    });
  }

  removeUser(index: number) {
    if (this.combinedForm.users.length > 1) {
      this.combinedForm.users.splice(index, 1);
    }
  }

  // ─── Password ───────────────────────────────────────────────────────────────

  generatePassword(userIndex: number, strength: 'basic' | 'strong') {
    const chars = {
      basic:  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      strong: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    const length = strength === 'strong' ? 16 : 10;
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[strength][Math.floor(Math.random() * chars[strength].length)];
    }
    this.combinedForm.users[userIndex].password = password;
  }

  togglePasswordVisibility(userIndex: number) {
    this.showPassword[userIndex] = !this.showPassword[userIndex];
  }
}