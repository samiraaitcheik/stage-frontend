import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';

export const PERMISSIONS = [
  { key: 'dashboard',     label: 'Tableau de bord',    icon: 'bi-grid-1x2' },
  { key: 'employees',     label: 'Employés',            icon: 'bi-people' },
  { key: 'payroll',       label: 'Paie',                icon: 'bi-cash-stack' },
  { key: 'organisation',  label: 'Organisation',        icon: 'bi-building' },
  { key: 'attendance',    label: 'Présences',           icon: 'bi-calendar-check' },
  { key: 'contracts',     label: 'Contrats',            icon: 'bi-file-earmark-text' },
  { key: 'reports',       label: 'Rapports CNSS',       icon: 'bi-file-bar-graph' },
  { key: 'licenses',      label: 'Licences',            icon: 'bi-shield-check' },
  { key: 'users',         label: 'Utilisateurs',        icon: 'bi-person-gear' },
];

export const ROLE_PRESETS: Record<string, string[]> = {
  ADMIN:   ['dashboard','employees','payroll','organisation','attendance','contracts','reports','licenses','users'],
  RH:      ['dashboard','employees','attendance','contracts','reports'],
  MANAGER: ['dashboard','employees','attendance'],
  VIEWER:  ['dashboard'],
  CUSTOM:  [],
};

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  readonly PERMISSIONS = PERMISSIONS;
  readonly ROLE_PRESETS = ROLE_PRESETS;
  readonly ROLES = ['ADMIN', 'RH', 'MANAGER', 'VIEWER', 'CUSTOM'];

  items: any[] = [];
  filtered: any[] = [];
  loading = true;
  showModal = false;
  editing = false;
  editingId = '';
  search = '';
  error = '';
  showPassword = false;
  toast = '';
  toastTimer: any;

  form: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    permissions: string[];
    status: string;
  } = this.emptyForm();

  constructor(private service: UserService, public auth: AuthService) {}

  ngOnInit() { this.load(); }

  emptyForm() {
    return { firstName: '', lastName: '', email: '', phone: '', role: '', password: '', permissions: [], status: 'ACTIVE' };
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.applySearch(); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = q
      ? this.items.filter(i =>
          `${i.firstName} ${i.lastName}`.toLowerCase().includes(q) ||
          i.email?.toLowerCase().includes(q) ||
          i.role?.toLowerCase().includes(q)
        )
      : [...this.items];
  }

  onSearch() { this.applySearch(); }

  openCreate() {
    this.form = this.emptyForm();
    this.editing = false;
    this.editingId = '';
    this.error = '';
    this.showPassword = false;
    this.showModal = true;
  }

  openEdit(item: any) {
    this.form = {
      firstName:   item.firstName ?? '',
      lastName:    item.lastName ?? '',
      email:       item.email ?? '',
      phone:       item.phone ?? '',
      role:        item.role ?? '',
      password:    '',
      permissions: Array.isArray(item.permissions) ? [...item.permissions] : [],
      status:      item.status ?? 'ACTIVE',
    };
    this.editing = true;
    this.editingId = item.id;
    this.error = '';
    this.showPassword = false;
    this.showModal = true;
  }

  onRoleChange() {
    const preset = ROLE_PRESETS[this.form.role];
    if (preset !== undefined) {
      this.form.permissions = [...preset];
    }
  }

  isPermChecked(key: string): boolean {
    return this.form.permissions.includes(key);
  }

  togglePermission(key: string) {
    const idx = this.form.permissions.indexOf(key);
    if (idx >= 0) {
      this.form.permissions.splice(idx, 1);
    } else {
      this.form.permissions.push(key);
    }
    // If manually changed, switch role to CUSTOM
    if (this.form.role !== 'CUSTOM' && this.form.role !== 'ADMIN') {
      this.form.role = 'CUSTOM';
    }
  }

  generatePassword(strength: 'basic' | 'strong') {
    const alpha = 'abcdefghijkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const special = '!@#$%';
    let chars = alpha + digits;
    if (strength === 'strong') chars += upper + special;
    let pw = '';
    for (let i = 0; i < (strength === 'strong' ? 14 : 10); i++) {
      pw += chars[Math.floor(Math.random() * chars.length)];
    }
    this.form.password = pw;
    this.showPassword = true;
  }

  save() {
    if (!this.form.firstName || !this.form.lastName || !this.form.email || !this.form.role) {
      this.error = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (!this.editing && !this.form.password) {
      this.error = 'Le mot de passe est obligatoire.';
      return;
    }

    const payload: any = {
      firstName:   this.form.firstName,
      lastName:    this.form.lastName,
      email:       this.form.email,
      phone:       this.form.phone || undefined,
      role:        this.form.role,
      permissions: this.form.permissions,
      status:      this.form.status,
    };
    if (this.form.password) payload.password = this.form.password;

    // For create, need companyId from current user
    if (!this.editing) {
      payload.companyId = this.auth.currentUser()?.companyId;
    }

    const obs = this.editing
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);

    obs.subscribe({
      next: () => {
        this.showModal = false;
        this.load();
        this.showToast(this.editing
          ? `Utilisateur ${this.form.firstName} mis à jour.`
          : `Utilisateur ${this.form.firstName} ${this.form.lastName} créé avec succès !`
        );
      },
      error: (e) => { this.error = e?.error?.error || 'Erreur lors de l\'enregistrement.'; }
    });
  }

  delete(item: any) {
    if (!confirm(`Supprimer ${item.firstName} ${item.lastName} ?`)) return;
    this.service.delete(item.id).subscribe({
      next: () => { this.load(); this.showToast('Utilisateur supprimé.'); },
      error: (e) => alert(e?.error?.error || 'Erreur lors de la suppression.')
    });
  }

  close() { this.showModal = false; }

  showToast(msg: string) {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast = '', 4000);
  }

  roleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'badge-admin', RH: 'badge-rh',
      MANAGER: 'badge-manager', VIEWER: 'badge-viewer', CUSTOM: 'badge-custom'
    };
    return map[role] ?? 'badge-custom';
  }

  getInitials(item: any): string {
    return `${(item.firstName?.[0] ?? '')}${(item.lastName?.[0] ?? '')}`.toUpperCase();
  }
}