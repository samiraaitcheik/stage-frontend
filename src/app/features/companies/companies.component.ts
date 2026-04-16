import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService, SuperAdminService } from '../../core/services/domain.services';
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
  errors: FormErrors = {};
  createMode: 'simple' | 'combined' = 'simple';

  readonly statusOptions = COMPANY_STATUS_OPTIONS;
  readonly planOptions = LICENSE_PLAN_OPTIONS;
  readonly licenseStatusOptions = LICENSE_STATUS_OPTIONS;
  readonly billingOptions = BILLING_CYCLE_OPTIONS;

  // Nouveau: formulaire combiné
  combinedForm: CreateCompanyWithLicenseAndUsersPayload = this.emptyCombinedForm();

  form: CreateCompanyPayload = this.emptyForm();

  constructor(
    private service: CompanyService,
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
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i =>
      `${i.name} ${i.legalName ?? ''} ${i.email ?? ''} ${i.phone ?? ''} ${i.city ?? ''}`.toLowerCase().includes(q)
    );
  }

  openCreate() {
    this.createMode = 'simple';
    this.form = this.emptyForm();
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

  createLicense(companyId: string) {
    this.router.navigate(['/licenses'], { queryParams: { companyId } });
  }

  createUser(companyId: string) {
    this.router.navigate(['/users'], { queryParams: { companyId } });
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
      });
    }

    return errors;
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

