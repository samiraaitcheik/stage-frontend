import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CompanyService,
  LicenseService,
  UserService,
  SuperAdminService,
} from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Company,
  CreateCompanyPayload,
  UpdateCompanyPayload,
  CreateCompanyWithLicenseAndUsersPayload,
  CreateLicensePayload,
  CreateUserPayload,
  COMPANY_STATUS_OPTIONS,
  LICENSE_PLAN_OPTIONS,
  LICENSE_STATUS_OPTIONS,
  BILLING_CYCLE_OPTIONS,
  FormErrors,
  validateRequired,
} from '../../core/models';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './companies.component.html',
  styleUrls: ['./companies.component.scss'],
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
  
  // Pour l'édition avec licence et utilisateurs
  editModalTab: 'company' | 'license' | 'users' = 'company';
  editingLicense: any = null;
  editingUsers: any[] = [];
  newLicenseForm: any = null;

  selectedCompany?: Company;
  selectedLicense: any = null;
  selectedCompanyUsers: any[] = [];
  selectedEditableUser: any = null;
  userEditForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'ADMIN',
    status: 'ACTIVE',
  };
  showDetailsModal = false;
  activeDetailsTab: 'company' | 'license' | 'users' = 'company';
  detailEditSection: 'company' | 'license' | 'users' = 'company';

  readonly statusOptions = COMPANY_STATUS_OPTIONS;
  readonly planOptions = LICENSE_PLAN_OPTIONS;
  readonly licenseStatusOptions = LICENSE_STATUS_OPTIONS;
  readonly billingOptions = BILLING_CYCLE_OPTIONS;

  readonly USER_ROLES = ['ADMIN', 'HR_MANAGER', 'PAYROLL_MANAGER', 'EMPLOYEE', 'VIEWER'];
  readonly LICENSE_STATUS_OPTIONS = ['ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'];
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
      'dashboard',
      'employees',
      'organisation',
      'attendance',
      'contracts',
      'payroll',
      'reports',
      'licenses',
      'users',
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
    private toastService: ToastService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => {
        this.items = data;
        this.filtered = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
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
    if (index >= 0) {
      this.selectedCompanyIds.splice(index, 1);
      this.applyFilters();
    }
  }

  removeSelectedStatus(status: string) {
    const index = this.selectedStatuses.indexOf(status);
    if (index >= 0) {
      this.selectedStatuses.splice(index, 1);
      this.applyFilters();
    }
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter((item) => {
      const matchSearch =
        `${item.name} ${item.legalName ?? ''} ${item.email ?? ''} ${item.phone ?? ''} ${item.city ?? ''}`
          .toLowerCase()
          .includes(q);
      const matchCompany =
        this.selectedCompanyIds.length === 0 || this.selectedCompanyIds.includes(item.id);
      const matchStatus =
        this.selectedStatuses.length === 0 || this.selectedStatuses.includes(item.status);
      return matchSearch && matchCompany && matchStatus;
    });
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  openCreate() {
    this.createMode = 'combined';
    this.form = this.emptyForm();
    this.combinedForm = this.emptyCombinedForm();
    this.editing = false;
    this.editingId = '';
    this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Company) {
    this.form = {
      name: item.name,
      legalName: item.legalName ?? '',
      taxIdentifier: item.taxIdentifier ?? '',
      rcNumber: item.rcNumber ?? '',
      iceNumber: item.iceNumber ?? '',
      cnssNumber: item.cnssNumber ?? '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      address: item.address ?? '',
      city: item.city ?? '',
      country: item.country ?? 'Maroc',
      timezone: item.timezone ?? 'Africa/Casablanca',
      currency: item.currency ?? 'MAD',
      status: item.status,
    };
    
    // Charger la licence et les utilisateurs
    this.editingId = item.id;
    this.editing = true;
    this.editModalTab = 'company';
    this.errors = {};
    this.showModal = true;
    
    // Charger la licence
    this.licenseService.getByCompany(item.id).subscribe({
      next: (license) => {
        this.editingLicense = license;
        if (!license) {
          // Créer un formulaire de licence vide si aucune licence n'existe
          this.editingLicense = {
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
          };
        }
      },
      error: () => {
        this.editingLicense = null;
      }
    });
    
    // Charger les utilisateurs
    this.superAdminService.getCompanyUsers(item.id).subscribe({
      next: (response) => {
        this.editingUsers = response.users || [];
      },
      error: () => {
        this.editingUsers = [];
      }
    });
  }

  save() {
    console.log('Save method called');
    console.log('Editing:', this.editing);
    console.log('Create mode:', this.createMode);
    console.log('Show modal:', this.showModal);
    
    if (this.editing) {
      console.log('Editing mode - validating form');
      this.errors = validateRequired(this.form as any, ['name']);
      console.log('Form errors:', this.errors);
      if (Object.keys(this.errors).length) {
        console.log('Form validation failed');
        return;
      }

      this.service.update(this.editingId, this.form as UpdateCompanyPayload).subscribe({
        next: () => {
          console.log('Company updated successfully');
          this.showModal = false;
          this.load();
          this.toastService.success('Entreprise modifiée avec succès');
        },
        error: (e: any) => {
          console.error('Update error:', e);
          this.errors['api'] = e?.error?.error || 'Erreur serveur';
          this.toastService.error('Erreur lors de la modification');
        },
      });
    } else {
      console.log('Create mode - createMode:', this.createMode);
      if (this.createMode === 'simple') {
        console.log('Simple creation mode');
        this.errors = validateRequired(this.form as any, ['name']);
        console.log('Form errors:', this.errors);
        if (Object.keys(this.errors).length) {
          console.log('Form validation failed');
          return;
        }

        this.superAdminService.createCompany(this.form).subscribe({
          next: () => {
            console.log('Company created successfully');
            this.showModal = false;
            this.load();
            this.toastService.success('Entreprise créée avec succès');
          },
          error: (e: any) => {
            console.error('Create error:', e);
            this.errors['api'] = e?.error?.error || 'Erreur serveur';
            this.toastService.error('Erreur lors de la création');
          },
        });
      } else {
        console.log('Combined creation mode');
        console.log('Combined form:', this.combinedForm);
        this.errors = this.validateCombinedForm();
        console.log('Combined form errors:', this.errors);
        if (Object.keys(this.errors).length) {
          console.log('Combined form validation failed');
          return;
        }

        console.log('Sending to API...');
        this.superAdminService.createCompanyWithLicenseAndUsers(this.combinedForm).subscribe({
          next: () => {
            console.log('Company with license and users created successfully');
            this.showModal = false;
            this.load();
            this.toastService.success('Entreprise, licence et utilisateurs créés avec succès');
          },
          error: (e: any) => {
            console.error('Combined create error:', e);
            this.errors['api'] = e?.error?.error || 'Erreur serveur';
            this.toastService.error('Erreur lors de la création');
          },
        });
      }
    }
  }

  delete(id: string) {
    if (!confirm('Supprimer cette entreprise ?')) return;
    this.service.delete(id).subscribe({
      next: () => {
        this.load();
        this.toastService.success('Entreprise supprimée');
      },
      error: () => {
        this.toastService.error('Erreur lors de la suppression');
      },
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
      next: (license) => {
        this.selectedLicense = license;
      },
      error: () => {
        this.selectedLicense = null;
      },
    });
  }

  loadCompanyUsers(companyId: string) {
    this.selectedCompanyUsers = [];
    this.superAdminService.getCompanyUsers(companyId).subscribe({
      next: (response) => {
        this.selectedCompanyUsers = response.users;
      },
      error: () => {
        this.selectedCompanyUsers = [];
      },
    });
  }

  saveCompanyDetails() {
    if (!this.selectedCompany) return;

    const loadingId = this.toastService.loading('Modification en cours...');

    const payload: UpdateCompanyPayload = {
      name: this.selectedCompany.name ?? undefined,
      legalName: this.selectedCompany.legalName ?? undefined,
      taxIdentifier: this.selectedCompany.taxIdentifier ?? undefined,
      rcNumber: this.selectedCompany.rcNumber ?? undefined,
      iceNumber: this.selectedCompany.iceNumber ?? undefined,
      cnssNumber: this.selectedCompany.cnssNumber ?? undefined,
      email: this.selectedCompany.email ?? undefined,
      phone: this.selectedCompany.phone ?? undefined,
      address: this.selectedCompany.address ?? undefined,
      city: this.selectedCompany.city ?? undefined,
      country: this.selectedCompany.country ?? undefined,
      timezone: this.selectedCompany.timezone ?? undefined,
      currency: this.selectedCompany.currency ?? undefined,
      status: this.selectedCompany.status ?? undefined,
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
      },
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
      this.toastService.update(
        loadingId,
        'Erreur lors de la mise à jour de la licence',
        'error',
        4000,
      );
      this.errors['api'] = e?.error?.error || 'Erreur serveur';
    };

    if (this.selectedLicense?.id) {
      this.licenseService
        .update(this.selectedLicense.id, payload)
        .subscribe({ next: onNext, error: onError });
    } else {
      this.licenseService.create(payload).subscribe({ next: onNext, error: onError });
    }
  }

  // Méthodes pour l'édition dans le modal principal
  saveEditLicense() {
    if (!this.editingLicense || !this.editingId) return;

    const loadingId = this.toastService.loading('Modification de la licence en cours...');

    const payload = {
      ...this.editingLicense,
      companyId: this.editingId,
    };

    const onNext = () => {
      this.toastService.update(loadingId, 'Licence mise à jour avec succès', 'success', 4000);
      this.load();
    };
    const onError = (e: any) => {
      this.toastService.update(
        loadingId,
        'Erreur lors de la mise à jour de la licence',
        'error',
        4000,
      );
      this.errors['api'] = e?.error?.error || 'Erreur serveur';
    };

    if (this.editingLicense.id) {
      this.licenseService.update(this.editingLicense.id, payload).subscribe({ next: onNext, error: onError });
    } else {
      this.licenseService.create(payload).subscribe({ next: onNext, error: onError });
    }
  }

  addEditUser() {
    this.editingUsers.push({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: [
        'dashboard',
        'employees',
        'organisation',
        'attendance',
        'contracts',
        'payroll',
        'reports',
        'users',
      ],
    });
  }

  removeEditUser(index: number) {
    if (this.editingUsers.length > 0) {
      this.editingUsers.splice(index, 1);
    }
  }

  saveEditUsers() {
    if (!this.editingId) return;

    const loadingId = this.toastService.loading('Modification des utilisateurs en cours...');
    
    // Valider les utilisateurs
    const validUsers = this.editingUsers.filter(user => 
      user.firstName?.trim() && 
      user.lastName?.trim() && 
      user.email?.trim()
    );

    if (validUsers.length === 0) {
      this.toastService.update(loadingId, 'Aucun utilisateur valide à sauvegarder', 'error', 4000);
      return;
    }

    // Créer ou mettre à jour chaque utilisateur
    let completed = 0;
    const total = validUsers.length;

    validUsers.forEach(user => {
      const payload = {
        ...user,
        companyId: this.editingId,
      };

      if (user.id) {
        // Mettre à jour l'utilisateur existant
        this.userService.update(user.id, payload).subscribe({
          next: () => {
            completed++;
            if (completed === total) {
              this.toastService.update(loadingId, 'Utilisateurs mis à jour avec succès', 'success', 4000);
              this.load();
            }
          },
          error: () => {
            completed++;
            if (completed === total) {
              this.toastService.update(loadingId, 'Erreur lors de la mise à jour des utilisateurs', 'error', 4000);
            }
          }
        });
      } else {
        // Créer un nouvel utilisateur
        this.userService.create(payload).subscribe({
          next: () => {
            completed++;
            if (completed === total) {
              this.toastService.update(loadingId, 'Utilisateurs créés avec succès', 'success', 4000);
              this.load();
            }
          },
          error: () => {
            completed++;
            if (completed === total) {
              this.toastService.update(loadingId, 'Erreur lors de la création des utilisateurs', 'error', 4000);
            }
          }
        });
      }
    });
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
    this.activeDetailsTab = 'users';
  }

  editCompanyUser(user: any) {
    this.selectedEditableUser = user;
    this.userEditForm = {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role ?? 'ADMIN',
      status: user.status ?? 'ACTIVE',
    };
  }

  cancelUserEdit() {
    this.selectedEditableUser = null;
  }

  saveCompanyUser() {
    if (!this.selectedEditableUser) return;
    const payload: any = {
      firstName: this.userEditForm.firstName,
      lastName: this.userEditForm.lastName,
      email: this.userEditForm.email,
      phone: this.userEditForm.phone || undefined,
      role: this.userEditForm.role,
      status: this.userEditForm.status,
    };
    this.userService.update(this.selectedEditableUser.id, payload).subscribe({
      next: () => {
        if (this.selectedCompany) {
          this.loadCompanyUsers(this.selectedCompany.id);
        }
        this.toastService.success('Utilisateur modifié avec succès');
        this.selectedEditableUser = null;
      },
      error: () => {
        this.toastService.error('Erreur lors de la modification de l’utilisateur');
      },
    });
  }

  deleteCompanyUser(user: any) {
    if (!confirm(`Supprimer ${user.firstName} ${user.lastName} ?`)) return;
    this.userService.delete(user.id).subscribe({
      next: () => {
        if (this.selectedCompany) {
          this.loadCompanyUsers(this.selectedCompany.id);
        }
        this.toastService.success('Utilisateur supprimé avec succès');
      },
      error: () => {
        this.toastService.error('Erreur lors de la suppression de l’utilisateur');
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  close() {
    this.showModal = false;
  }
  hasError(f: string) {
    return !!this.errors[f];
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  private emptyForm(): CreateCompanyPayload {
    return {
      name: '',
      legalName: '',
      taxIdentifier: '',
      rcNumber: '',
      iceNumber: '',
      cnssNumber: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Maroc',
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      status: 'ACTIVE',
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
      users: [
        {
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          phone: '',
          role: 'ADMIN',
          status: 'ACTIVE',
          permissions: [
            'dashboard',
            'employees',
            'organisation',
            'attendance',
            'contracts',
            'payroll',
            'reports',
            'users',
          ],
        },
      ],
    };
  }

  private validateCombinedForm(): FormErrors {
    const errors: FormErrors = {};

    if (!this.combinedForm.company.name?.trim()) {
      errors['company.name'] = "Le nom de l'entreprise est obligatoire";
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
        if (!user.lastName?.trim()) errors[`users.${i}.lastName`] = 'Le nom est obligatoire';
        if (!user.email?.trim()) errors[`users.${i}.email`] = "L'email est obligatoire";
        if (!user.password?.trim())
          errors[`users.${i}.password`] = 'Le mot de passe est obligatoire';
        if (!user.role) errors[`users.${i}.role`] = 'Le rôle est obligatoire';
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
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: [
        'dashboard',
        'employees',
        'organisation',
        'attendance',
        'contracts',
        'payroll',
        'reports',
        'users',
      ],
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
      basic: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      strong:
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?',
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

  // ─── Role and User Helper Methods ────────────────────────────────────────────

  roleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      SUPER_ADMIN: 'badge-super-admin',
      ADMIN: 'badge-admin',
      HR_MANAGER: 'badge-hr',
      PAYROLL_MANAGER: 'badge-payroll',
      EMPLOYEE: 'badge-employee',
      VIEWER: 'badge-viewer',
    };
    return map[role] ?? 'badge-custom';
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      SUPER_ADMIN: 'Super admin',
      ADMIN: 'Admin',
      HR_MANAGER: 'RH',
      PAYROLL_MANAGER: 'Paie',
      EMPLOYEE: 'Employé',
      VIEWER: 'Lecteur',
    };
    return (labels[role] ?? role) || '—';
  }

  roleIcon(role: string): string {
    const icons: Record<string, string> = {
      SUPER_ADMIN: 'bi-shield-lock',
      ADMIN: 'bi-person-badge',
      HR_MANAGER: 'bi-people',
      PAYROLL_MANAGER: 'bi-cash-stack',
      EMPLOYEE: 'bi-person',
      VIEWER: 'bi-eye',
    };
    return icons[role] ?? 'bi-person-fill';
  }

  // ─── Contract Generation ──────────────────────────────────────────────────────

  generateContract() {
    if (!this.selectedCompany) return;

    const loadingId = this.toastService.loading('Génération du contrat en cours...');

    try {
      // Generate HTML contract
      const contractHTML = this.createContractHTML();
      
      // Create and download PDF
      this.downloadContractPDF(contractHTML, `Contrat_${this.selectedCompany.name}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      this.toastService.update(loadingId, 'Contrat généré avec succès', 'success', 4000);
    } catch (error) {
      console.error('Contract generation error:', error);
      this.toastService.update(
        loadingId,
        'Erreur lors de la génération du contrat',
        'error',
        4000,
      );
    }
  }

  generateCompanyContract(company: any) {
    if (!company) return;

    try {
      // Generate HTML contract
      const contractHTML = this.createCompanyContractHTML(company);
      
      // Create and download PDF
      this.downloadContractPDF(contractHTML, `Contrat_Service_${company.name}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Show success message
      alert('Contrat de service généré avec succès!');
    } catch (error) {
      console.error('Company contract generation error:', error);
      alert('Erreur lors de la génération du contrat de service');
    }
  }

  private createCompanyContractHTML(company: any): string {
    if (!company) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Contrat de Service - ${company.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .section { margin: 30px 0; }
        .section-title { color: #4f46e5; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #374151; }
        .signature { margin-top: 50px; }
        .signature-box { border: 1px solid #d1d5db; padding: 20px; margin: 20px 0; height: 80px; }
        .footer { margin-top: 50px; text-align: center; color: #6b7280; font-size: 12px; }
        .service-contract-title { color: #1f2937; font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="service-contract-title">CONTRAT DE SERVICE HRMatrix</div>
        <h2>${company.name}</h2>
        <p>Date: ${currentDate}</p>
      </div>

      <div class="company-info">
        <div class="section-title">INFORMATIONS DE L'ENTREPRISE</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Nom commercial:</span> ${company.name}
          </div>
          <div class="info-item">
            <span class="info-label">Raison sociale:</span> ${company.legalName || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Email:</span> ${company.email || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Téléphone:</span> ${company.phone || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Adresse:</span> ${company.address || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Ville:</span> ${company.city || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Pays:</span> ${company.country || 'Maroc'}
          </div>
          <div class="info-item">
            <span class="info-label">Devise:</span> ${company.currency || 'MAD'}
          </div>
          <div class="info-item">
            <span class="info-label">Identifiant fiscal:</span> ${company.taxIdentifier || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Numéro RC:</span> ${company.rcNumber || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Numéro ICE:</span> ${company.iceNumber || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Numéro CNSS:</span> ${company.cnssNumber || 'N/A'}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">TERMES ET CONDITIONS</div>
        <p>Ce contrat régit les conditions d'utilisation de la plateforme HRMatrix par l'entreprise ${company.name}.</p>
        <ul>
          <li>Les services sont fournis selon les termes de la licence souscrite.</li>
          <li>L'entreprise s'engage à respecter les limites d'utilisation définies.</li>
          <li>Les données de l'entreprise restent sa propriété exclusive.</li>
          <li>La plateforme peut être résiliée en cas de non-respect des conditions.</li>
          <li>Les tarifs sont sujets à changement selon le plan souscrit.</li>
          <li>Le support technique est inclus selon le plan souscrit.</li>
          <li>Les mises à jour logicielles sont incluses sans frais supplémentaires.</li>
        </ul>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>Pour l'entreprise ${company.name}:</strong></p>
            <div class="signature-box"></div>
            <p>Nom et signature</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>Pour HRMatrix:</strong></p>
            <div class="signature-box"></div>
            <p>Nom et signature</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Ce contrat de service a été généré automatiquement le ${currentDate} via la plateforme HRMatrix.</p>
        <p>Pour toute question, contactez support@hrmatrix.ma | www.hrmatrix.ma</p>
        <p>Tél: +212 5XX XXX XXX | Adresse: 123 Avenue Mohammed V, Casablanca</p>
      </div>
    </body>
    </html>
    `;
  }

  private createContractHTML(): string {
    if (!this.selectedCompany) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const license = this.selectedLicense || {};
    const users = this.selectedCompanyUsers || [];

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Contrat de Service - ${this.selectedCompany.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .section { margin: 30px 0; }
        .section-title { color: #4f46e5; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #374151; }
        .signature { margin-top: 50px; }
        .signature-box { border: 1px solid #d1d5db; padding: 20px; margin: 20px 0; height: 80px; }
        .footer { margin-top: 50px; text-align: center; color: #6b7280; font-size: 12px; }
        .user-list { margin: 15px 0; }
        .user-item { background: #f9fafb; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .badge { background: #4f46e5; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CONTRAT DE SERVICE</h1>
        <h2>${this.selectedCompany.name}</h2>
        <p>Date: ${currentDate}</p>
      </div>

      <div class="company-info">
        <div class="section-title">INFORMATIONS DE L'ENTREPRISE</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Nom commercial:</span> ${this.selectedCompany.name}
          </div>
          <div class="info-item">
            <span class="info-label">Raison sociale:</span> ${this.selectedCompany.legalName || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Email:</span> ${this.selectedCompany.email || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Téléphone:</span> ${this.selectedCompany.phone || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Adresse:</span> ${this.selectedCompany.address || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Ville:</span> ${this.selectedCompany.city || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Pays:</span> ${this.selectedCompany.country || 'Maroc'}
          </div>
          <div class="info-item">
            <span class="info-label">Devise:</span> ${this.selectedCompany.currency || 'MAD'}
          </div>
          <div class="info-item">
            <span class="info-label">Identifiant fiscal:</span> ${this.selectedCompany.taxIdentifier || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Numéro RC:</span> ${this.selectedCompany.rcNumber || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Numéro ICE:</span> ${this.selectedCompany.iceNumber || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Numéro CNSS:</span> ${this.selectedCompany.cnssNumber || 'N/A'}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DÉTAILS DE LA LICENCE</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Plan:</span> <span class="badge">${license.planCode || 'BASIC'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Statut:</span> <span class="badge">${license.status || 'TRIAL'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Cycle de facturation:</span> ${license.billingCycle || 'MONTHLY'}
          </div>
          <div class="info-item">
            <span class="info-label">Date de début:</span> ${license.startsAt ? new Date(license.startsAt).toLocaleDateString('fr-FR') : 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Date de fin:</span> ${license.endsAt ? new Date(license.endsAt).toLocaleDateString('fr-FR') : 'Illimitée'}
          </div>
          <div class="info-item">
            <span class="info-label">Max utilisateurs:</span> ${license.maxUsers || 'Illimité'}
          </div>
          <div class="info-item">
            <span class="info-label">Max employés:</span> ${license.maxEmployees || 'Illimité'}
          </div>
          <div class="info-item">
            <span class="info-label">Max stockage:</span> ${license.maxStorageMb ? license.maxStorageMb + ' Mo' : 'Illimité'}
          </div>
        </div>
        
        <div style="margin-top: 20px;">
          <span class="info-label">Fonctionnalités activées:</span>
          <div style="margin-top: 10px;">
            ${license.payrollEnabled ? '<span class="badge" style="margin-right: 5px;">Paie</span>' : ''}
            ${license.rhEnabled ? '<span class="badge" style="margin-right: 5px;">RH</span>' : ''}
            ${license.cnssEnabled ? '<span class="badge" style="margin-right: 5px;">CNSS</span>' : ''}
            ${license.taxEnabled ? '<span class="badge" style="margin-right: 5px;">Fiscal</span>' : ''}
            ${license.damancomEnabled ? '<span class="badge" style="margin-right: 5px;">Damancom</span>' : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">UTILISATEURS AUTORISÉS (${users.length})</div>
        <div class="user-list">
          ${users.map(user => `
            <div class="user-item">
              <strong>${user.firstName} ${user.lastName}</strong> - ${user.email}
              <span class="badge" style="margin-left: 10px;">${user.role}</span>
              <span class="badge" style="margin-left: 5px; background: ${user.status === 'ACTIVE' ? '#16a34a' : '#f59e0b'};">${user.status}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">TERMES ET CONDITIONS</div>
        <p>Ce contrat régit les conditions d'utilisation de la plateforme HRMatrix par l'entreprise ${this.selectedCompany.name}.</p>
        <ul>
          <li>Les services sont fournis selon les termes de la licence spécifiée ci-dessus.</li>
          <li>L'entreprise s'engage à respecter les limites d'utilisation définies.</li>
          <li>Les données de l'entreprise restent sa propriété exclusive.</li>
          <li>La plateforme peut être résiliée en cas de non-respect des conditions.</li>
          <li>Les tarifs sont sujets à changement selon le plan souscrit.</li>
        </ul>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>Pour l'entreprise ${this.selectedCompany.name}:</strong></p>
            <div class="signature-box"></div>
            <p>Nom et signature</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>Pour HRMatrix:</strong></p>
            <div class="signature-box"></div>
            <p>Nom et signature</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Ce contrat a été généré automatiquement le ${currentDate} via la plateforme HRMatrix.</p>
        <p>Pour toute question, contactez support@hrmatrix.ma</p>
      </div>
    </body>
    </html>
    `;
  }

  private downloadContractPDF(html: string, filename: string) {
    // Create a temporary window to generate the content
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Wait for content to load, then trigger print
      setTimeout(() => {
        printWindow.print();
        // Close the window after printing (or after user cancels)
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 500);
    } else {
      // Fallback: create a downloadable HTML file
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.pdf', '.html');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}
