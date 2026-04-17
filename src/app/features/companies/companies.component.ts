import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService, LicenseService, UserService, SuperAdminService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
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
  companyFilterId = '';
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

  // Nouveau: formulaire combiné
  combinedForm: CreateCompanyWithLicenseAndUsersPayload = this.emptyCombinedForm();

  form: CreateCompanyPayload = this.emptyForm();

  constructor(
    private service: CompanyService,
    private licenseService: LicenseService,
    private userService: UserService,
    private superAdminService: SuperAdminService,
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.filtered = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter((item) => {
      const matchSearch = `${item.name} ${item.legalName ?? ''} ${item.email ?? ''} ${item.phone ?? ''} ${item.city ?? ''}`
        .toLowerCase().includes(q);
      const matchCompany = this.companyFilterId ? item.id === this.companyFilterId : true;
      return matchSearch && matchCompany;
    });
  }

  openCreate() {
    this.createMode = 'combined';
    this.form = this.emptyForm();
    this.combinedForm = this.emptyCombinedForm();
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Company) {
    this.form = {
      name:           item.name,
      legalName:      item.legalName      ?? '',
      taxIdentifier:  item.taxIdentifier   ?? '',
      rcNumber:       item.rcNumber       ?? '',
      iceNumber:      item.iceNumber      ?? '',
      cnssNumber:     item.cnssNumber     ?? '',
      email:          item.email          ?? '',
      phone:          item.phone          ?? '',
      address:        item.address        ?? '',
      city:           item.city           ?? '',
      country:        item.country        ?? 'Maroc',
      timezone:       item.timezone       ?? 'Africa/Casablanca',
      currency:       item.currency       ?? 'MAD',
      status:         item.status,
    };
    this.editing = true; this.editingId = item.id; this.errors = {};
    this.showModal = true;
  }

  save() {
    if (this.editing) {
      // Mode édition (simple)
      this.errors = validateRequired(this.form as any, ['name']);
      if (Object.keys(this.errors).length) return;

      const next = () => { this.showModal = false; this.load(); };
      const error = (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; };

      this.service.update(this.editingId, this.form as UpdateCompanyPayload).subscribe({ next, error });
    } else {
      // Mode création
      if (this.createMode === 'simple') {
        // Création simple d'entreprise
        this.errors = validateRequired(this.form as any, ['name']);
        if (Object.keys(this.errors).length) return;

        const next = () => { this.showModal = false; this.load(); };
        const error = (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; };

        this.superAdminService.createCompany(this.form).subscribe({ next, error });
      } else {
        // Création combinée
        this.errors = this.validateCombinedForm();
        if (Object.keys(this.errors).length) return;

        const next = () => { this.showModal = false; this.load(); };
        const error = (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; };

        this.superAdminService.createCompanyWithLicenseAndUsers(this.combinedForm).subscribe({ next, error });
      }
    }
  }

  delete(id: string) {
    if (!confirm('Supprimer cette entreprise ?')) return;
    this.service.delete(id).subscribe({ next: () => this.load() });
  }

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
    const payload = {
      name: this.selectedCompany.name,
      legalName: this.selectedCompany.legalName,
      taxIdentifier: this.selectedCompany.taxIdentifier,
      rcNumber: this.selectedCompany.rcNumber,
      iceNumber: this.selectedCompany.iceNumber,
      cnssNumber: this.selectedCompany.cnssNumber,
      email: this.selectedCompany.email,
      phone: this.selectedCompany.phone,
      address: this.selectedCompany.address,
      city: this.selectedCompany.city,
      country: this.selectedCompany.country,
      timezone: this.selectedCompany.timezone,
      currency: this.selectedCompany.currency,
      status: this.selectedCompany.status,
    };
    const next = () => { this.showDetailsModal = false; this.load(); };
    const error = (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; };

    this.service.update(this.selectedCompany.id, payload as UpdateCompanyPayload).subscribe({ next, error });
  }

  saveLicenseDetails() {
    if (!this.selectedCompany) return;
    const payload = {
      ...(this.selectedLicense || {}),
      companyId: this.selectedCompany.id,
    };
    const next = () => { this.showDetailsModal = false; this.load(); };
    const error = (e: any) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; };

    if (this.selectedLicense?.id) {
      this.licenseService.update(this.selectedLicense.id, payload).subscribe({ next, error });
    } else {
      this.licenseService.create(payload).subscribe({ next, error });
    }
  }

  onDetailsUsers() {
    if (!this.selectedCompany) return;
    this.router.navigate(['/users'], { queryParams: { companyId: this.selectedCompany.id } });
  }

  close() { this.showModal = false; }
  hasError(f: string) { return !!this.errors[f]; }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

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
        startsAt: new Date().toISOString().split('T')[0], // Aujourd'hui
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
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        role: 'ADMIN',
        status: 'ACTIVE',
        permissions: [
          "dashboard", "employees", "organisation", "attendance",
          "contracts", "payroll", "reports", "users",
        ],
      }],
    };
  }

  private validateCombinedForm(): FormErrors {
    const errors: FormErrors = {};

    // Validation entreprise
    if (!this.combinedForm.company.name || this.combinedForm.company.name.trim() === '') {
      errors['company.name'] = 'Le nom de l\'entreprise est obligatoire';
    }

    // Validation licence
    if (!this.combinedForm.license.planCode) {
      errors['license.planCode'] = 'Le plan de licence est obligatoire';
    }
    if (!this.combinedForm.license.startsAt) {
      errors['license.startsAt'] = 'La date de début de licence est obligatoire';
    }

    // Validation utilisateurs
    if (!this.combinedForm.users || this.combinedForm.users.length === 0) {
      errors['users'] = 'Au moins un utilisateur doit être ajouté';
    } else {
      this.combinedForm.users.forEach((user, index) => {
        if (!user.firstName || user.firstName.trim() === '') {
          errors[`users.${index}.firstName`] = 'Le prénom est obligatoire';
        }
        if (!user.lastName || user.lastName.trim() === '') {
          errors[`users.${index}.lastName`] = 'Le nom est obligatoire';
        }
        if (!user.email || user.email.trim() === '') {
          errors[`users.${index}.email`] = 'L\'email est obligatoire';
        }
        if (!user.password || user.password.trim() === '') {
          errors[`users.${index}.password`] = 'Le mot de passe est obligatoire';
        }
        if (!user.role) {
          errors[`users.${index}.role`] = 'Le rôle est obligatoire';
        }
      });
    }

    return errors;
  }

  isUserPermChecked(user: any, key: string): boolean {
    return Array.isArray(user.permissions) && user.permissions.includes(key);
  }

  toggleUserPermission(user: any, key: string) {
    if (!Array.isArray(user.permissions)) {
      user.permissions = [];
    }
    const idx = user.permissions.indexOf(key);
    if (idx >= 0) {
      user.permissions.splice(idx, 1);
    } else {
      user.permissions.push(key);
    }
  }

  onUserRoleChange(user: any) {
    if (user.role && this.ROLE_PRESETS[user.role]) {
      user.permissions = [...this.ROLE_PRESETS[user.role]];
    }
  }

  // Méthodes pour gérer les utilisateurs dans le formulaire combiné
  addUser() {
    this.combinedForm.users.push({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: [
        "dashboard", "employees", "organisation", "attendance",
        "contracts", "payroll", "reports", "users",
      ],
    });
  }

  removeUser(index: number) {
    if (this.combinedForm.users.length > 1) {
      this.combinedForm.users.splice(index, 1);
    }
  }
}

