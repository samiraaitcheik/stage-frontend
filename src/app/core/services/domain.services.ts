import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import {
  Company, Department, Position, Employee, Attendance,
  EmployeeContract, License, PayrollPeriod, PayrollRun,
  PayrollItem, Payslip, VariableItem, User
} from '../models';

// ── Interfaces pour le super admin ──────────────────────────────────────────

export interface SuperAdminDashboardStats {
  companies: { total: number; active: number; inactive: number };
  users:     { total: number };
  licenses:  { total: number; active: number; trial: number; expired: number };
}

export interface CompanyWithStats extends Company {
  license?: Partial<License>;
  _count?: { users: number; employees: number };
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CompanyService {
  constructor(private api: ApiService, private auth: AuthService) {}

  /**
   * CORRIGÉ: isSuperAdmin est un computed signal Angular, s'appelle comme une fonction.
   * Super admin → GET /companies (toutes)
   * Autres      → GET /companies/mine (uniquement la leur)
   */
  getAll(): Observable<Company[]> {
    return this.auth.isSuperAdmin()
      ? this.api.get<Company[]>('/companies')
      : this.api.get<Company[]>('/companies/mine');
  }

  getById(id: string): Observable<Company>                    { return this.api.get(`/companies/${id}`); }
  create(data: Partial<Company>): Observable<Company>         { return this.api.post('/companies', data); }
  update(id: string, data: Partial<Company>): Observable<Company> { return this.api.put(`/companies/${id}`, data); }
  delete(id: string): Observable<any>                         { return this.api.delete(`/companies/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  constructor(private api: ApiService) {}
  getAll(): Observable<Department[]>                              { return this.api.get('/departments'); }
  getById(id: string): Observable<Department>                    { return this.api.get(`/departments/${id}`); }
  create(data: Partial<Department>): Observable<Department>      { return this.api.post('/departments', data); }
  update(id: string, data: Partial<Department>): Observable<Department> { return this.api.put(`/departments/${id}`, data); }
  delete(id: string): Observable<any>                            { return this.api.delete(`/departments/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class PositionService {
  constructor(private api: ApiService) {}
  getAll(): Observable<Position[]>                             { return this.api.get('/positions'); }
  getById(id: string): Observable<Position>                   { return this.api.get(`/positions/${id}`); }
  create(data: Partial<Position>): Observable<Position>       { return this.api.post('/positions', data); }
  update(id: string, data: Partial<Position>): Observable<Position> { return this.api.put(`/positions/${id}`, data); }
  delete(id: string): Observable<any>                         { return this.api.delete(`/positions/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  constructor(private api: ApiService) {}
  getAll(): Observable<Employee[]>                             { return this.api.get('/employees'); }
  getById(id: string): Observable<Employee>                   { return this.api.get(`/employees/${id}`); }
  getByDepartments(departmentIds: string[]): Observable<Employee[]> { 
    const ids = departmentIds.join(',');
    return this.api.get(`/employees/by-departments?departmentIds=${ids}`);
  }
  create(data: Partial<Employee>): Observable<Employee>       { return this.api.post('/employees', data); }
  update(id: string, data: Partial<Employee>): Observable<Employee> { return this.api.put(`/employees/${id}`, data); }
  delete(id: string): Observable<any>                         { return this.api.delete(`/employees/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private api: ApiService) {}
  getAll(): Observable<Attendance[]>                               { return this.api.get('/attendances'); }
  getById(id: string): Observable<Attendance>                     { return this.api.get(`/attendances/${id}`); }
  getByEmployee(employeeId: string): Observable<Attendance[]>     { return this.api.get(`/attendances/employee/${employeeId}`); }
  create(data: Partial<Attendance>): Observable<Attendance>       { return this.api.post('/attendances', data); }
  update(id: string, data: Partial<Attendance>): Observable<Attendance> { return this.api.put(`/attendances/${id}`, data); }
  delete(id: string): Observable<any>                             { return this.api.delete(`/attendances/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class ContractService {
  constructor(private api: ApiService) {}
  getAll(): Observable<EmployeeContract[]>                                { return this.api.get('/contracts'); }
  getById(id: string): Observable<EmployeeContract>                      { return this.api.get(`/contracts/${id}`); }
  getByEmployee(employeeId: string): Observable<EmployeeContract[]>      { return this.api.get(`/contracts/employee/${employeeId}`); }
  create(data: Partial<EmployeeContract>): Observable<EmployeeContract>  { return this.api.post('/contracts', data); }
  update(id: string, data: Partial<EmployeeContract>): Observable<EmployeeContract> { return this.api.put(`/contracts/${id}`, data); }
  delete(id: string): Observable<any>                                     { return this.api.delete(`/contracts/${id}`); }
  generatePdf(id: string): Observable<{message: string; filename: string; path: string}> { return this.api.post(`/contracts/${id}/generate-pdf`, {}); }
  downloadPdf(filename: string): Observable<Blob> { return this.api.get(`/contracts/pdf/${filename}`, { responseType: 'blob' }); }
}

@Injectable({ providedIn: 'root' })
export class LicenseService {
  constructor(private api: ApiService) {}
  getAll(): Observable<License[]>                           { return this.api.get('/licenses'); }
  getById(id: string): Observable<License>                 { return this.api.get(`/licenses/${id}`); }
  getByCompany(companyId: string): Observable<License>     { return this.api.get(`/licenses/company/${companyId}`); }
  create(data: Partial<License>): Observable<License>      { return this.api.post('/licenses', data); }
  update(id: string, data: Partial<License>): Observable<License> { return this.api.put(`/licenses/${id}`, data); }
  delete(id: string): Observable<any>                      { return this.api.delete(`/licenses/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class VariableItemService {
  constructor(private api: ApiService) {}
  getAll(): Observable<VariableItem[]>                                   { return this.api.get('/variable-items'); }
  getById(id: string): Observable<VariableItem>                         { return this.api.get(`/variable-items/${id}`); }
  getByEmployee(employeeId: string): Observable<VariableItem[]>         { return this.api.get(`/variable-items/employee/${employeeId}`); }
  create(data: Partial<VariableItem>): Observable<VariableItem>         { return this.api.post('/variable-items', data); }
  update(id: string, data: Partial<VariableItem>): Observable<VariableItem> { return this.api.put(`/variable-items/${id}`, data); }
  delete(id: string): Observable<any>                                   { return this.api.delete(`/variable-items/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private api: ApiService) {}
  getAll(): Observable<User[]>                           { return this.api.get('/users'); }
  getById(id: string): Observable<User>                 { return this.api.get(`/users/${id}`); }
  create(data: Partial<User>): Observable<User>         { return this.api.post('/users', data); }
  update(id: string, data: Partial<User>): Observable<User> { return this.api.put(`/users/${id}`, data); }
  delete(id: string): Observable<any>                   { return this.api.delete(`/users/${id}`); }
}

/**
 * NOUVEAU: Service dédié au super admin
 * Utilise les routes /super-admin/* pour les opérations d'administration globale
 */
@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  constructor(private api: ApiService) {}

  /** Stats globales du tableau de bord super admin */
  getDashboardStats(): Observable<SuperAdminDashboardStats> {
    return this.api.get('/super-admin/dashboard');
  }

  /** Toutes les entreprises avec leurs licences et compteurs */
  getAllCompanies(): Observable<{ total: number; companies: CompanyWithStats[] }> {
    return this.api.get('/super-admin/companies');
  }

  /** Créer une entreprise (via route super-admin) */
  createCompany(data: Partial<Company>): Observable<{ message: string; company: Company }> {
    return this.api.post('/super-admin/companies', data);
  }

  /** Utilisateurs d'une entreprise */
  getCompanyUsers(companyId: string): Observable<{ company: { id: string; name: string }; total: number; users: User[] }> {
    return this.api.get(`/super-admin/companies/${companyId}/users`);
  }

  /** Créer un admin d'entreprise */
  createCompanyAdmin(data: {
    companyId: string; firstName: string; lastName: string;
    email: string; password: string; phone?: string;
  }): Observable<{ message: string; user: User }> {
    return this.api.post('/super-admin/company-admins', data);
  }

  /** Créer / mettre à jour une licence */
  createOrUpdateLicense(data: Partial<License>): Observable<{ message: string; license: License }> {
    return this.api.post('/super-admin/licenses', data);
  }

  /** Créer une entreprise avec licence et utilisateurs */
  createCompanyWithLicenseAndUsers(data: {
    company: Partial<Company>;
    license: Partial<License>;
    users: Array<{
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string;
      role?: string;
      status?: string;
      permissions?: string[];
    }>;
  }): Observable<{ message: string; data: { company: Company; license: License; users: User[] } }> {
    return this.api.post('/super-admin/companies-with-license-and-users', data);
  }

  /** Générer un contrat PDF pour une entreprise */
  generateContract(data: any): Observable<string> {
    return this.api.post('/super-admin/generate-contract', data, { responseType: 'text' });
  }
}
