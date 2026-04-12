import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EmployeeService, DepartmentService, AttendanceService, PayrollPeriodService, ContractService } from '../../core/services/domain.services';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  stats = { employees: 0, departments: 0, companies: 0, attendances: 0, periods: 0, contracts: 0 };
  loading = true;

  constructor(
    private employeeService: EmployeeService,
    private departmentService: DepartmentService,
    private attendanceService: AttendanceService,
    private periodService: PayrollPeriodService,
    private contractService: ContractService,
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    // /companies/mine retourne la company de l'user connecté (accessible à tous)
    const companies$ = this.api.get<any[]>('/companies/mine').pipe(catchError(() => of([])));

    forkJoin({
      employees:   this.employeeService.getAll().pipe(catchError(() => of([]))),
      departments: this.departmentService.getAll().pipe(catchError(() => of([]))),
      companies:   companies$,
      attendances: this.attendanceService.getAll().pipe(catchError(() => of([]))),
      periods:     this.periodService.getAll().pipe(catchError(() => of([]))),
      contracts:   this.contractService.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: (data) => {
        this.stats.employees   = data.employees.length;
        this.stats.departments = data.departments.length;
        this.stats.companies   = data.companies.length;
        this.stats.attendances = data.attendances.length;
        this.stats.periods     = data.periods.length;
        this.stats.contracts   = data.contracts.length;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}