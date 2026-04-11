import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;       // Bootstrap Icons class e.g. 'bi-grid-1x2'
  route?: string;
  permission?: string; // permission key required to see this item
  children?: NavItem[];
  expanded?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  @Input() collapsed = false;

  constructor(public auth: AuthService) {}

  navItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'bi-grid-1x2-fill',  route: '/dashboard',  permission: 'dashboard' },
    {
      label: 'Organisation', icon: 'bi-building-fill', expanded: false,
      children: [
        { label: 'Entreprises',  icon: 'bi-buildings',       route: '/companies',   permission: 'organisation' },
        { label: 'Départements', icon: 'bi-diagram-3-fill',  route: '/departments', permission: 'organisation' },
        { label: 'Postes',       icon: 'bi-briefcase-fill',  route: '/positions',   permission: 'organisation' },
        { label: 'Licences',     icon: 'bi-shield-fill-check', route: '/licenses',  permission: 'licenses' },
      ]
    },
    {
      label: 'Employés', icon: 'bi-people-fill', expanded: false,
      children: [
        { label: 'Liste des employés',   icon: 'bi-person-lines-fill',  route: '/employees',     permission: 'employees' },
        { label: 'Présences',            icon: 'bi-calendar-check-fill', route: '/attendance',   permission: 'attendance' },
        { label: 'Contrats',             icon: 'bi-file-earmark-text-fill', route: '/contracts', permission: 'contracts' },
        { label: 'Éléments variables',   icon: 'bi-sliders',             route: '/variable-items', permission: 'contracts' },
      ]
    },
    {
      label: 'Paie', icon: 'bi-cash-stack', expanded: false,
      children: [
        { label: 'Périodes',      icon: 'bi-calendar3',       route: '/payroll/periods',  permission: 'payroll' },
        { label: 'Exécutions',    icon: 'bi-play-circle-fill',route: '/payroll/runs',     permission: 'payroll' },
        { label: 'Lignes de paie',icon: 'bi-list-columns',    route: '/payroll/items',    permission: 'payroll' },
        { label: 'Bulletins',     icon: 'bi-file-earmark-richtext-fill', route: '/payroll/payslips', permission: 'payroll' },
      ]
    },
    { label: 'Utilisateurs', icon: 'bi-person-gear-fill', route: '/users', permission: 'users' },
  ];

  /** Check if a nav item (or any of its children) should be visible */
  isVisible(item: NavItem): boolean {
    if (this.auth.isAdmin()) return true;
    if (item.children) {
      return item.children.some(c => this.auth.hasPermission(c.permission ?? ''));
    }
    return this.auth.hasPermission(item.permission ?? '');
  }

  visibleChildren(item: NavItem): NavItem[] {
    if (!item.children) return [];
    if (this.auth.isAdmin()) return item.children;
    return item.children.filter(c => this.auth.hasPermission(c.permission ?? ''));
  }

  toggleGroup(item: NavItem) {
    if (item.children) item.expanded = !item.expanded;
  }

  get userInitials(): string {
    const u = this.auth.currentUser();
    if (!u) return 'A';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  }

  get userName(): string {
    const u = this.auth.currentUser();
    return u ? `${u.firstName} ${u.lastName}` : 'Administrateur';
  }

  get userRole(): string {
    return this.auth.currentUser()?.role ?? 'USER';
  }
}