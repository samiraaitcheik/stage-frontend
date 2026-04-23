import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Attendance,
  Company,
  Department,
  Employee,
  EmployeeContract,
  License,
  User,
  VariableItem,
} from '../../core/models';
import {
  AttendanceService,
  CompanyService,
  ContractService,
  DepartmentService,
  EmployeeService,
  LicenseService,
  SuperAdminDashboardStats,
  SuperAdminService,
  UserService,
  VariableItemService,
} from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { UiChartComponent, type ChartDatum } from '../../shared/ui-chart/ui-chart.component';

interface DashboardMetric {
  label: string;
  value: number;
  helper: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'rose' | 'slate';
}

interface DashboardHighlight {
  eyebrow: string;
  title: string;
  description: string;
  value: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, UiChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  loading = true;

  employees: Employee[] = [];
  departments: Department[] = [];
  companies: Company[] = [];
  attendances: Attendance[] = [];
  contracts: EmployeeContract[] = [];
  variableItems: VariableItem[] = [];
  licenses: License[] = [];
  users: User[] = [];
  superAdminStats: SuperAdminDashboardStats | null = null;

  readonly quickLinks = [
    {
      title: 'Employes',
      description: 'Suivre les effectifs, les statuts et les changements RH.',
      route: '/employees',
      icon: 'bi-people',
      permission: 'employees',
    },
    {
      title: 'Presences',
      description: 'Verifier la ponctualite et les absences du jour.',
      route: '/attendance',
      icon: 'bi-calendar-check',
      permission: 'attendance',
    },
    {
      title: 'Contrats',
      description: 'Controler les contrats actifs, termines et a renouveler.',
      route: '/contracts',
      icon: 'bi-file-earmark-text',
      permission: 'contracts',
    },
    {
      title: 'Utilisateurs',
      description: 'Gerer les acces, les roles et les autorisations metier.',
      route: '/users',
      icon: 'bi-shield-check',
      permission: 'users',
    },
  ];

  constructor(
    private employeeService: EmployeeService,
    private departmentService: DepartmentService,
    private companyService: CompanyService,
    private attendanceService: AttendanceService,
    private contractService: ContractService,
    private variableItemService: VariableItemService,
    private licenseService: LicenseService,
    private userService: UserService,
    private superAdminService: SuperAdminService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const isSuperAdmin = this.auth.isSuperAdmin();
    const canManageUsers = this.auth.isAdmin();

    forkJoin({
      employees: this.employeeService.getAll().pipe(catchError(() => of([]))),
      departments: this.departmentService.getAll().pipe(catchError(() => of([]))),
      companies: this.companyService.getAll().pipe(catchError(() => of([]))),
      attendances: this.attendanceService.getAll().pipe(catchError(() => of([]))),
      contracts: this.contractService.getAll().pipe(catchError(() => of([]))),
      variableItems: this.variableItemService.getAll().pipe(catchError(() => of([]))),
      licenses: isSuperAdmin ? this.licenseService.getAll().pipe(catchError(() => of([]))) : of([]),
      users: canManageUsers ? this.userService.getAll().pipe(catchError(() => of([]))) : of([]),
      superAdminStats: isSuperAdmin
        ? this.superAdminService.getDashboardStats().pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: (data) => {
        this.employees = data.employees;
        this.departments = data.departments;
        this.companies = data.companies;
        this.attendances = data.attendances;
        this.contracts = data.contracts;
        this.variableItems = data.variableItems;
        this.licenses = data.licenses;
        this.users = data.users;
        this.superAdminStats = data.superAdminStats;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get heroTitle(): string {
    return this.auth.isSuperAdmin()
      ? 'Pilotage global de la plateforme RH'
      : 'Vue d ensemble de votre activite RH';
  }

  get heroDescription(): string {
    return this.auth.isSuperAdmin()
      ? 'Suivez les entreprises, les licences et les effectifs depuis un tableau de bord unifie.'
      : 'Retrouvez vos effectifs, vos presences et vos contrats dans un espace plus clair et plus utile.';
  }

  get companyDisplayName(): string {
    return this.companies[0]?.name || 'votre structure';
  }

  get highlights(): DashboardHighlight[] {
    const activeEmployees = this.countBy(this.employees, (item) => item.status === 'ACTIVE');
    const activeContracts = this.countBy(this.contracts, (item) => item.status === 'ACTIVE');
    const pendingVariables = this.countBy(this.variableItems, (item) => item.status === 'PENDING');
    const activeCompanies = this.superAdminStats?.companies.active
      ?? this.countBy(this.companies, (item) => item.status === 'ACTIVE');

    return [
      {
        eyebrow: this.auth.isSuperAdmin() ? 'Entreprises actives' : 'Effectif actif',
        title: this.auth.isSuperAdmin() ? 'Portefeuille en bonne sante' : 'Equipe mobilisee',
        description: this.auth.isSuperAdmin()
          ? 'Entreprises avec statut actif sur la plateforme.'
          : 'Collaborateurs actuellement actifs dans votre entreprise.',
        value: this.auth.isSuperAdmin() ? `${activeCompanies}` : `${activeEmployees}`,
      },
      {
        eyebrow: 'Contrats actifs',
        title: 'Base contractuelle stable',
        description: 'Contrats en cours sur la base des statuts reellement recuperes.',
        value: `${activeContracts}`,
      },
      {
        eyebrow: 'Variables en attente',
        title: 'Points a traiter',
        description: 'Elements variables qui demandent encore une validation ou une action.',
        value: `${pendingVariables}`,
      },
    ];
  }

  get metrics(): DashboardMetric[] {
    const activeEmployees = this.countBy(this.employees, (item) => item.status === 'ACTIVE');
    const activeDepartments = this.countBy(this.departments, (item) => item.isActive);
    const activeContracts = this.countBy(this.contracts, (item) => item.status === 'ACTIVE');
    const activeLicenses = this.superAdminStats?.licenses.active
      ?? this.countBy(this.licenses, (item) => item.status === 'ACTIVE');

    const cards: DashboardMetric[] = [
      {
        label: 'Employes',
        value: this.employees.length,
        helper: `${activeEmployees} actifs`,
        icon: 'bi-people-fill',
        tone: 'blue',
      },
      {
        label: 'Departements',
        value: this.departments.length,
        helper: `${activeDepartments} actifs`,
        icon: 'bi-diagram-3-fill',
        tone: 'green',
      },
      {
        label: this.auth.isSuperAdmin() ? 'Entreprises' : 'Utilisateurs',
        value: this.auth.isSuperAdmin() ? this.companies.length : this.users.length,
        helper: this.auth.isSuperAdmin()
          ? `${this.superAdminStats?.companies.active ?? this.countBy(this.companies, (item) => item.status === 'ACTIVE')} actives`
          : `${this.countBy(this.users, (item) => item.status === 'ACTIVE')} actifs`,
        icon: this.auth.isSuperAdmin() ? 'bi-buildings-fill' : 'bi-person-badge-fill',
        tone: 'amber',
      },
      {
        label: 'Presences',
        value: this.attendances.length,
        helper: `${this.countBy(this.attendances, (item) => item.status === 'PRESENT')} presentes`,
        icon: 'bi-calendar2-check-fill',
        tone: 'slate',
      },
      {
        label: 'Contrats',
        value: this.contracts.length,
        helper: `${activeContracts} actifs`,
        icon: 'bi-file-earmark-text-fill',
        tone: 'rose',
      },
    ];

    if (this.auth.isSuperAdmin()) {
      cards.push({
        label: 'Licences',
        value: this.superAdminStats?.licenses.total ?? this.licenses.length,
        helper: `${activeLicenses} actives`,
        icon: 'bi-stars',
        tone: 'blue',
      });
    }

    return cards;
  }

  get primaryChart(): ChartDatum[] {
    return this.createChartData([
      ['Actifs', this.countBy(this.employees, (item) => item.status === 'ACTIVE'), '#00b894'],
      ['Inactifs', this.countBy(this.employees, (item) => item.status === 'INACTIVE'), '#ffb000'],
      ['Suspendus', this.countBy(this.employees, (item) => item.status === 'SUSPENDED'), '#ff3d81'],
      ['Sortis', this.countBy(this.employees, (item) => item.status === 'LEFT'), '#5b6c8f'],
    ]);
  }

  get contractChart(): ChartDatum[] {
    return this.createChartData([
      ['Actifs', this.countBy(this.contracts, (item) => item.status === 'ACTIVE'), '#2979ff'],
      ['Brouillons', this.countBy(this.contracts, (item) => item.status === 'DRAFT'), '#ffb000'],
      ['Termines', this.countBy(this.contracts, (item) => item.status === 'ENDED' || item.status === 'TERMINATED'), '#ff5a36'],
      ['Suspendus', this.countBy(this.contracts, (item) => item.status === 'SUSPENDED'), '#7a3cff'],
    ]);
  }

  get attendanceChart(): ChartDatum[] {
    return this.createChartData([
      ['Present', this.countBy(this.attendances, (item) => item.status === 'PRESENT'), '#00c2a8'],
      ['Absence', this.countBy(this.attendances, (item) => item.status === 'ABSENT'), '#ff7a00'],
      ['Conge paye', this.countBy(this.attendances, (item) => item.status === 'PAID_LEAVE'), '#1f7aff'],
      ['Maladie', this.countBy(this.attendances, (item) => item.status === 'SICK_LEAVE'), '#b14dff'],
    ]);
  }

  get licenseChart(): ChartDatum[] {
    return this.createChartData([
      ['Actives', this.superAdminStats?.licenses.active ?? this.countBy(this.licenses, (item) => item.status === 'ACTIVE'), '#00b894'],
      ['Essai', this.superAdminStats?.licenses.trial ?? this.countBy(this.licenses, (item) => item.status === 'TRIAL'), '#5856ff'],
      ['Expirees', this.superAdminStats?.licenses.expired ?? this.countBy(this.licenses, (item) => item.status === 'EXPIRED'), '#ff3366'],
    ]);
  }

  get companyStatusChart(): ChartDatum[] {
    return this.createChartData([
      ['Actives', this.superAdminStats?.companies.active ?? this.countBy(this.companies, (item) => item.status === 'ACTIVE'), '#1f7aff'],
      ['Inactives', this.superAdminStats?.companies.inactive ?? this.countBy(this.companies, (item) => item.status !== 'ACTIVE'), '#94a3b8'],
    ]);
  }

  get topDepartments(): ChartDatum[] {
    const counts = new Map<string, number>();

    for (const employee of this.employees) {
      const departmentName = employee.department?.name || 'Sans departement';
      counts.set(departmentName, (counts.get(departmentName) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label,
        value,
        color: ['#1f7aff', '#00b894', '#7a3cff', '#ffb000', '#ff3d81'][index % 5],
        helper: value === 1 ? '1 employe' : `${value} employes`,
      }));
  }

  get visibleQuickLinks() {
    return this.quickLinks.filter((item) => this.auth.hasPermission(item.permission));
  }

  get companyHealthLabel(): string {
    if (this.auth.isSuperAdmin()) {
      return `${this.superAdminStats?.companies.total ?? this.companies.length} entreprises suivies`;
    }

    return this.companyDisplayName;
  }

  private countBy<T>(items: T[], predicate: (item: T) => boolean): number {
    return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
  }

  private createChartData(rows: Array<[string, number, string]>): ChartDatum[] {
    return rows
      .filter(([, value]) => value > 0)
      .map(([label, value, color]) => ({ label, value, color }));
  }
}
