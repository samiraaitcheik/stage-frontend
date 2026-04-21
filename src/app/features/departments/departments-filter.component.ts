import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService, EmployeeService } from '../../core/services/domain.services';

@Component({
  selector: 'app-departments-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './departments-filter.component.html',
  styleUrls: ['./departments-filter.component.scss']
})
export class DepartmentsFilterComponent implements OnInit {
  departments: any[] = [];
  employees: any[] = [];
  filteredEmployees: any[] = [];
  selectedDepartments: string[] = [];
  loading = true;
  searchEmployee = '';

  constructor(
    private departmentService: DepartmentService,
    private employeeService: EmployeeService
  ) {}

  ngOnInit() {
    this.loadDepartments();
    this.loadEmployees();
  }

  loadDepartments() {
    this.departmentService.getAll().subscribe({
      next: (data) => {
        this.departments = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        console.error('Error loading departments');
      }
    });
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({
      next: (data) => {
        this.employees = data;
        this.applyFilters();
      },
      error: () => {
        console.error('Error loading employees');
      }
    });
  }

  toggleDepartmentSelection(departmentId: string) {
    const index = this.selectedDepartments.indexOf(departmentId);
    if (index >= 0) {
      this.selectedDepartments.splice(index, 1);
    } else {
      this.selectedDepartments.push(departmentId);
    }
    this.applyFilters();
  }

  isDepartmentSelected(departmentId: string): boolean {
    return this.selectedDepartments.includes(departmentId);
  }

  applyFilters() {
    // Filter by departments
    let employees = this.selectedDepartments.length > 0 
      ? this.employees.filter(emp => this.selectedDepartments.includes(emp.departmentId))
      : [...this.employees];

    // Filter by search
    if (this.searchEmployee.trim()) {
      const search = this.searchEmployee.toLowerCase();
      employees = employees.filter(emp => 
        `${emp.firstName} ${emp.lastName} ${emp.email}`.toLowerCase().includes(search)
      );
    }

    this.filteredEmployees = employees;
  }

  onSearchChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.selectedDepartments = [];
    this.searchEmployee = '';
    this.applyFilters();
  }

  getDepartmentName(departmentId: string): string {
    const dept = this.departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'Non assigné';
  }

  getEmployeeInitials(employee: any): string {
    return `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'status-active';
      case 'INACTIVE': return 'status-inactive';
      case 'SUSPENDED': return 'status-suspended';
      default: return 'status-default';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Actif';
      case 'INACTIVE': return 'Inactif';
      case 'SUSPENDED': return 'Suspendu';
      default: return status;
    }
  }
}
