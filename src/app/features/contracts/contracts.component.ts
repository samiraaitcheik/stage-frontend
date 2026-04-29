import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService, EmployeeService, CompanyService, LicenseService, UserService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { CONTRACT_TYPE_OPTIONS, CONTRACT_STATUS_OPTIONS, Company } from '../../core/models';
import { SearchableSelectComponent } from '../../shared/searchable-select.component';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './contracts.component.html',
  styleUrls: ['./contracts.component.scss']
})
export class ContractsComponent implements OnInit {
  items: any[] = [];
  filtered: any[] = [];
  employees: any[] = [];
  filteredEmployees: any[] = [];
  companies: Company[] = [];
  departments: string[] = [];
  selectedDepartment: string = '';
  loading = true;
  showModal = false;
  showFilterPanel = false;
  showServiceContractModal = false;
  editing = false;
  editingId = '';
  search = '';
  companyFilterId = '';
  pendingCompanyFilterId = '';
  typeFilter = '';
  pendingTypeFilter = '';
  statusFilter = '';
  pendingStatusFilter = '';
  error = '';
  selectedCompany: any = null;
  selectedLicense: any = null;
  selectedCompanyUsers: any[] = [];

  showContractDetailsModal = false;
  selectedContract: any = null;
  contractDetailsTab: 'general' | 'remuneration' | 'employe' = 'general';

  readonly typeOptions = CONTRACT_TYPE_OPTIONS;
  readonly statusOptions = CONTRACT_STATUS_OPTIONS;

  cascade = { companyId: '', departmentId: '', positionId: '' };
  activeContractWarning = '';

  cascadeDepartmentsList: any[] = [];
  cascadePositionsList: any[] = [];
  cascadeEmployeesList: any[] = [];

  // ═══════════════════════════════════════════════════════════════
  // PROPRIÉTÉS POUR LA RECHERCHE
  // ═══════════════════════════════════════════════════════════════
  companySearchTerm: string = '';
  showCompanyDropdown: boolean = false;
  filteredCompanies: any[] = [];
  
  deptSearchTerm: string = '';
  showDeptDropdown: boolean = false;
  filteredDepartments: any[] = [];
  
  positionSearchTerm: string = '';
  showPositionDropdown: boolean = false;
  filteredPositions: any[] = [];
  
  employeeSearchTerm: string = '';
  showEmployeeDropdown: boolean = false;
  filteredCascadeEmployees: any[] = [];

  form: any = this.emptyForm();

  constructor(
    private service: ContractService,
    private employeeService: EmployeeService,
    private companyService: CompanyService,
    private licenseService: LicenseService,
    private userService: UserService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    this.loadEmployees();
    if (this.auth.isSuperAdmin()) {
      this.loadCompanies();
    }
  }

  loadEmployees() {
    this.employeeService.getAll().subscribe({
      next: (d) => {
        this.employees = d;
        this.extractDepartments();
        this.filteredEmployees = [...this.employees];
        this.updateCascadeEmployees();
        this.cdr.detectChanges();
      }
    });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({
      next: (data) => {
        this.companies = data;
        this.filteredCompanies = [...this.companies];
        this.extractDepartments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading companies:', err);
        if (this.employees.length > 0) {
          this.extractDepartments();
        }
      }
    });
  }

  extractDepartments() {
    const deptSet = new Set<string>();
    
    // Extraire des employés (depuis la BDD)
    this.employees.forEach((emp) => {
      const department = emp.department || emp.dept || emp.section || emp.division || emp.team || emp.service;
      if (department && typeof department === 'string' && department.trim()) {
        deptSet.add(department.trim());
      }
    });
    
    // Extraire des entreprises (depuis la BDD)
    this.companies.forEach((company: any) => {
      if (company.departments && Array.isArray(company.departments)) {
        company.departments.forEach((dept: any) => {
          if (dept && typeof dept === 'string' && dept.trim()) {
            deptSet.add(dept.trim());
          }
        });
      }
    });
    
    // Ne PAS ajouter de départements par défaut - uniquement ceux de la BDD
    this.departments = Array.from(deptSet).sort();
    
    // Mettre à jour la liste des départements pour le cascade
    this.updateCascadeDepartments();
    console.log('Départements chargés depuis BDD:', this.departments);
  }

  onDepartmentChange() {
    if (this.selectedDepartment) {
      this.filteredEmployees = this.employees.filter(emp => {
        const department = emp.department || emp.dept || emp.section || emp.division || emp.team || emp.service;
        return department === this.selectedDepartment;
      });
    } else {
      this.filteredEmployees = [...this.employees];
    }
    if (this.form.employeeId && !this.filteredEmployees.find(emp => emp.id === this.form.employeeId)) {
      this.form.employeeId = '';
    }
    this.cdr.detectChanges();
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => {
        this.items = data;
        this.applySearch();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i => {
      const matchesSearch = q
        ? this.getEmployeeName(i.employeeId).toLowerCase().includes(q) ||
          i.contractType?.toLowerCase().includes(q) ||
          i.status?.toLowerCase().includes(q)
        : true;
      const employee = this.employees.find(e => e.id === i.employeeId);
      const matchesCompany = this.companyFilterId ? employee?.companyId === this.companyFilterId : true;
      const matchesType = this.typeFilter ? i.contractType === this.typeFilter : true;
      const matchesStatus = this.statusFilter ? i.status === this.statusFilter : true;
      return matchesSearch && matchesCompany && matchesType && matchesStatus;
    });
  }

  onSearch() { this.applySearch(); }

  openFilterPanel() {
    this.pendingCompanyFilterId = this.companyFilterId;
    this.pendingTypeFilter = this.typeFilter;
    this.pendingStatusFilter = this.statusFilter;
    this.showFilterPanel = true;
  }

  closeFilterPanel() { this.showFilterPanel = false; }

  togglePendingCompanySelection(companyId: string) {
    this.pendingCompanyFilterId = this.pendingCompanyFilterId === companyId ? '' : companyId;
  }

  togglePendingTypeSelection(type: string) {
    this.pendingTypeFilter = this.pendingTypeFilter === type ? '' : type;
  }

  togglePendingStatusSelection(status: string) {
    this.pendingStatusFilter = this.pendingStatusFilter === status ? '' : status;
  }

  applyPendingFilters() {
    this.companyFilterId = this.pendingCompanyFilterId;
    this.typeFilter = this.pendingTypeFilter;
    this.statusFilter = this.pendingStatusFilter;
    this.showFilterPanel = false;
    this.applySearch();
  }

  resetPendingFilters() {
    this.pendingCompanyFilterId = '';
    this.pendingTypeFilter = '';
    this.pendingStatusFilter = '';
  }

  clearCompanyFilter() { this.companyFilterId = ''; this.applySearch(); }
  clearTypeFilter() { this.typeFilter = ''; this.applySearch(); }
  clearStatusFilter() { this.statusFilter = ''; this.applySearch(); }

  getEmployeeName(id: string): string {
    const e = this.employees.find(e => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : 'Chargement...';
  }

  companyName(id: string): string {
    return this.companies.find(c => c.id === id)?.name ?? '—';
  }

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  emptyForm() {
    return {
      employeeId: '', contractType: 'CDI', status: 'ACTIVE',
      startDate: new Date().toISOString().slice(0, 10), endDate: '', baseSalary: null,
      hoursPerMonth: 191, workingDaysPerMonth: 26,
      transportAllowance: null, notes: ''
    };
  }

  openCreate() {
    this.form = this.emptyForm();
    this.cascade = { companyId: '', departmentId: '', positionId: '' };
    this.selectedDepartment = '';
    this.filteredEmployees = [...this.employees];
    this.editing = false;
    this.editingId = '';
    this.error = '';
    this.activeContractWarning = '';
    
    this.companySearchTerm = '';
    this.deptSearchTerm = '';
    this.positionSearchTerm = '';
    this.employeeSearchTerm = '';
    this.showCompanyDropdown = false;
    this.showDeptDropdown = false;
    this.showPositionDropdown = false;
    this.showEmployeeDropdown = false;
    
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEdit(item: any) {
    const emp = this.employees.find(e => e.id === item.employeeId);
    this.cascade = {
      companyId: emp?.companyId ?? '',
      departmentId: emp?.departmentId ?? '',
      positionId: emp?.positionId ?? ''
    };
    this.updateCascadeDepartments();
    this.updateCascadePositions();
    this.updateCascadeEmployees();
    this.form = {
      employeeId: item.employeeId,
      contractType: item.contractType,
      status: item.status,
      startDate: item.startDate?.slice(0, 10),
      endDate: item.endDate?.slice(0, 10) ?? '',
      baseSalary: item.baseSalary,
      hoursPerMonth: item.hoursPerMonth ?? 191,
      workingDaysPerMonth: item.workingDaysPerMonth ?? 26,
      transportAllowance: item.transportAllowance ?? null,
      notes: item.notes ?? ''
    };
    this.editing = true;
    this.editingId = item.id;
    this.error = '';
    this.activeContractWarning = '';
    
    this.companySearchTerm = '';
    this.deptSearchTerm = '';
    this.positionSearchTerm = '';
    this.employeeSearchTerm = '';
    
    this.showModal = true;
    this.cdr.detectChanges();
  }

  save() {
    if (this.activeContractWarning) {
      this.error = 'Impossible de créer ce contrat car l\'employé a déjà un contrat actif.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.form.employeeId) {
      this.error = 'Veuillez sélectionner un employé.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.form.contractType) {
      this.error = 'Veuillez sélectionner un type de contrat.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.form.startDate) {
      this.error = 'Veuillez renseigner la date de début.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.form.baseSalary || this.form.baseSalary <= 0) {
      this.error = 'Veuillez renseigner un salaire de base valide.';
      this.cdr.detectChanges();
      return;
    }

    const employee = this.employees.find(e => e.id === this.form.employeeId);
    const payload: any = {
      companyId: employee?.companyId ?? this.auth.currentUser()?.companyId,
      employeeId: this.form.employeeId,
      contractType: this.form.contractType,
      status: this.form.status,
      startDate: this.form.startDate,
      baseSalary: +this.form.baseSalary,
    };
    if (this.form.endDate) payload.endDate = this.form.endDate;
    if (this.form.hoursPerMonth) payload.hoursPerMonth = +this.form.hoursPerMonth;
    if (this.form.workingDaysPerMonth) payload.workingDaysPerMonth = +this.form.workingDaysPerMonth;
    if (this.form.transportAllowance) payload.transportAllowance = +this.form.transportAllowance;
    if (this.form.notes) payload.notes = this.form.notes;

    const obs = this.editing
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);

    obs.subscribe({
      next: () => {
        this.showModal = false;
        this.load();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = e?.error?.error || 'Erreur serveur';
        this.cdr.detectChanges();
      }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  statusClass(s: string): string {
    const m: any = {
      ACTIVE: 'badge-success',
      DRAFT: 'badge-secondary',
      ENDED: 'badge-danger',
      SUSPENDED: 'badge-warning',
      TERMINATED: 'badge-danger'
    };
    return m[s] ?? 'badge-secondary';
  }

  typeClass(t: string): string {
    const m: any = {
      CDI: 'badge-success',
      CDD: 'badge-info',
      STAGE: 'badge-warning',
      INTERIM: 'badge-purple',
      FREELANCE: 'badge-secondary'
    };
    return m[t] ?? 'badge-secondary';
  }

  viewContractDetails(contract: any) {
    this.selectedContract = contract;
    this.contractDetailsTab = 'general';
    this.showContractDetailsModal = true;
    this.cdr.detectChanges();
  }

  closeContractDetails() {
    this.showContractDetailsModal = false;
    this.selectedContract = null;
  }

  openEditFromContractDetails() {
    if (this.selectedContract) {
      this.closeContractDetails();
      this.openEdit(this.selectedContract);
    }
  }

  getEmployeeCin(employeeId: string): string {
    const emp = this.employees.find(e => e.id === employeeId);
    return emp?.cin || '—';
  }

  getEmployeeEmail(employeeId: string): string {
    const emp = this.employees.find(e => e.id === employeeId);
    return emp?.email || '—';
  }

  getEmployeePhone(employeeId: string): string {
    const emp = this.employees.find(e => e.id === employeeId);
    return emp?.phone || '—';
  }

  getEmployeeDepartmentId(employeeId: string): string | undefined {
    const emp = this.employees.find(e => e.id === employeeId);
    return emp?.departmentId;
  }

  getEmployeePositionId(employeeId: string): string | undefined {
    const emp = this.employees.find(e => e.id === employeeId);
    return emp?.positionId;
  }

  departmentName(deptId?: string): string {
    if (!deptId) return '—';
    return deptId;
  }

  positionName(posId?: string): string {
    if (!posId) return '—';
    return posId;
  }

  updateCascadeDepartments() {
    this.cascadeDepartmentsList = this.departments.map(dept => ({ id: dept, name: dept }));
    this.filteredDepartments = [...this.cascadeDepartmentsList];
    console.log('Départements pour cascade:', this.cascadeDepartmentsList);
  }

  updateCascadePositions() {
    this.cascadePositionsList = [];
    this.filteredPositions = [...this.cascadePositionsList];
  }

  updateCascadeEmployees() {
    let list = [...this.employees];
    if (this.cascade.companyId) {
      list = list.filter(e => e.companyId === this.cascade.companyId);
    }
    if (this.cascade.departmentId) {
      list = list.filter(e => e.departmentId === this.cascade.departmentId || e.department === this.cascade.departmentId);
    }
    if (this.cascade.positionId) {
      list = list.filter(e => e.positionId === this.cascade.positionId);
    }
    this.cascadeEmployeesList = list;
    this.filteredCascadeEmployees = [...list];
  }

  get cascadeDepartments(): any[] { return this.cascadeDepartmentsList; }
  get cascadePositions(): any[] { return this.cascadePositionsList; }
  get cascadeEmployees(): any[] { return this.cascadeEmployeesList; }

  onCascadeCompanyChange() {
    this.cascade.departmentId = '';
    this.cascade.positionId = '';
    this.form.employeeId = '';
    this.activeContractWarning = '';
    this.updateCascadeDepartments();
    this.updateCascadePositions();
    this.updateCascadeEmployees();
    this.cdr.detectChanges();
  }

  onCascadeDepartmentChange() {
    this.cascade.positionId = '';
    this.form.employeeId = '';
    this.activeContractWarning = '';
    this.updateCascadePositions();
    this.updateCascadeEmployees();
    this.cdr.detectChanges();
  }

  onCascadePositionChange() {
    this.form.employeeId = '';
    this.activeContractWarning = '';
    this.updateCascadeEmployees();
    this.cdr.detectChanges();
  }

  onEmployeeSelect() {
    this.activeContractWarning = '';
    if (!this.form.employeeId) return;
    const existingActive = this.items.find(c =>
      c.employeeId === this.form.employeeId &&
      c.status === 'ACTIVE' &&
      c.id !== this.editingId
    );
    if (existingActive) {
      const emp = this.employees.find(e => e.id === this.form.employeeId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Cet employé';
      this.activeContractWarning = `${name} possède déjà un contrat ACTIF (${existingActive.contractType}, depuis le ${new Date(existingActive.startDate).toLocaleDateString('fr-FR')}). Chaque employé ne peut avoir qu'un seul contrat actif.`;
    }
    this.cdr.detectChanges();
  }

  filterCompanies() {
    const term = this.companySearchTerm.toLowerCase();
    this.filteredCompanies = this.companies.filter(c => 
      c.name.toLowerCase().includes(term)
    );
  }

  filterDepartments() {
    const term = this.deptSearchTerm.toLowerCase();
    this.filteredDepartments = this.cascadeDepartmentsList.filter(d => 
      d.name.toLowerCase().includes(term)
    );
  }

  filterPositions() {
    const term = this.positionSearchTerm.toLowerCase();
    this.filteredPositions = this.cascadePositionsList.filter(p => 
      p.name.toLowerCase().includes(term)
    );
  }

  filterEmployees() {
    const term = this.employeeSearchTerm.toLowerCase();
    this.filteredCascadeEmployees = this.cascadeEmployeesList.filter(e => 
      `${e.firstName} ${e.lastName} ${e.employeeCode || ''}`.toLowerCase().includes(term)
    );
  }

  closeDropdown(dropdownName: string) {
    setTimeout(() => {
      switch(dropdownName) {
        case 'company': this.showCompanyDropdown = false; break;
        case 'dept': this.showDeptDropdown = false; break;
        case 'position': this.showPositionDropdown = false; break;
        case 'employee': this.showEmployeeDropdown = false; break;
      }
      this.cdr.detectChanges();
    }, 200);
  }

  selectCompany(company: any) {
    this.cascade.companyId = company.id;
    this.companySearchTerm = '';
    this.showCompanyDropdown = false;
    this.onCascadeCompanyChange();
    this.cdr.detectChanges();
  }

  selectDepartment(dept: any) {
    this.cascade.departmentId = dept.id;
    this.deptSearchTerm = '';
    this.showDeptDropdown = false;
    this.onCascadeDepartmentChange();
    this.cdr.detectChanges();
  }

  selectPosition(pos: any) {
    this.cascade.positionId = pos.id;
    this.positionSearchTerm = '';
    this.showPositionDropdown = false;
    this.onCascadePositionChange();
    this.cdr.detectChanges();
  }

  selectEmployee(emp: any) {
    this.form.employeeId = emp.id;
    this.employeeSearchTerm = '';
    this.showEmployeeDropdown = false;
    this.onEmployeeSelect();
    this.cdr.detectChanges();
  }

  getCompanyName(companyId: string): string {
    const company = this.companies.find(c => c.id === companyId);
    return company ? company.name : '';
  }

  getDepartmentName(deptId: string): string {
    const dept = this.cascadeDepartmentsList.find(d => d.id === deptId);
    return dept ? dept.name : '';
  }

  getPositionName(posId: string): string {
    const pos = this.cascadePositionsList.find(p => p.id === posId);
    return pos ? pos.name : '';
  }

  getSelectedEmployeeName(): string {
    const emp = this.employees.find(e => e.id === this.form.employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : '';
  }

  openServiceContractModal() { this.showServiceContractModal = true; this.cdr.detectChanges(); }
  closeServiceContractModal() { this.showServiceContractModal = false; this.selectedCompany = null; this.selectedLicense = null; this.selectedCompanyUsers = []; }
  onCompanySelect(companyId: string) { this.selectedCompany = this.companies.find(c => c.id === companyId); if (this.selectedCompany) { this.loadCompanyLicense(this.selectedCompany.id); this.loadCompanyUsers(this.selectedCompany.id); } }
  loadCompanyLicense(companyId: string) { this.licenseService.getByCompany(companyId).subscribe({ next: (license) => { this.selectedLicense = license; }, error: () => { console.error('Error loading license'); } }); }
  loadCompanyUsers(companyId: string) { this.userService.getAll().subscribe({ next: (users: any[]) => { this.selectedCompanyUsers = users.filter(user => user.companyId === companyId); }, error: () => { console.error('Error loading users'); } }); }

  generateServiceContract() { if (!this.selectedCompany) return; try { const contractHTML = this.createServiceContractHTML(); this.downloadContractPDF(contractHTML, `Contrat_Service_${this.selectedCompany.name}_${new Date().toISOString().split('T')[0]}.html`); alert('Contrat généré avec succès!'); } catch (error) { console.error('Contract generation error:', error); alert('Erreur lors de la génération du contrat'); } }

  private createServiceContractHTML(): string { if (!this.selectedCompany) return ''; const currentDate = new Date().toLocaleDateString('fr-FR'); return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Contrat de Service</title><style>body{font-family:Arial;margin:40px;}.header{text-align:center;border-bottom:3px solid #4f46e5;padding-bottom:20px;margin-bottom:30px;}.signature-box{border:1px solid #ccc;padding:20px;margin:20px 0;height:80px;}</style></head><body><div class="header"><h1>CONTRAT DE SERVICE HRMatrix</h1><h2>${this.escapeHtml(this.selectedCompany.name)}</h2><p>Date: ${currentDate}</p></div><div style="display:flex;gap:40px;"><div style="flex:1"><div class="signature-box"></div><p>Signature du Client</p></div><div style="flex:1"><div class="signature-box"></div><p>Signature HRMatrix</p></div></div><p style="text-align:center;margin-top:50px;">Document généré via HRMatrix</p></body></html>`; }

  generateEmployeeContract(contract: any) { 
    if (!contract) return; 
    try { 
      const contractHTML = this.createProfessionalContractHTML(contract); 
      const employeeName = this.getEmployeeName(contract.employeeId); 
      const contractTypeLabel = this.getContractTypeLabel(contract.contractType); 
      const filename = `Contrat_${contractTypeLabel}_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`; 
      this.downloadContractPDF(contractHTML, filename); 
      alert(`Contrat généré avec succès!`); 
    } catch (error) { 
      console.error('Employee contract generation error:', error); 
      alert('Erreur lors de la génération du contrat'); 
    } 
  }

  private getContractTypeLabel(contractType: string): string { 
    const labels: Record<string, string> = { 
      'CDI': 'CDI_A_Duree_Indeterminee', 
      'CDD': 'CDD_A_Duree_Determinee', 
      'STAGE': 'Convention_Stage', 
      'INTERIM': 'Contrat_Interimaire', 
      'FREELANCE': 'Contrat_Prestation_Service' 
    }; 
    return labels[contractType] || 'Contrat_Travail'; 
  }

  private createProfessionalContractHTML(contract: any): string { 
    const employee = this.employees.find(e => e.id === contract.employeeId); 
    if (!employee) return ''; 
    const company = this.companies.find(c => c.id === employee.companyId); 
    const startDate = this.formatDate(contract.startDate); 
    const endDate = contract.endDate ? this.formatDate(contract.endDate) : 'Indéterminée'; 
    const currentDate = new Date().toLocaleDateString('fr-FR'); 
    const employeeName = `${employee.firstName} ${employee.lastName}`; 
    const companyName = company?.name || '[Nom de la société]'; 
    const city = company?.city || 'Casablanca'; 
    const salary = this.formatMoney(contract.baseSalary); 
    const hoursPerMonth = contract.hoursPerMonth || 191; 
    const workingDays = contract.workingDaysPerMonth || 26; 
    const transportAllowance = contract.transportAllowance ? this.formatMoney(contract.transportAllowance) : null; 
    const notes = contract.notes || ''; 
    let articlesHtml = ''; 
    
    if (contract.contractType === 'CDI') { 
      articlesHtml = this.getCDIArticles(employee, company, contract, startDate, salary, hoursPerMonth, workingDays, transportAllowance, notes); 
    } else if (contract.contractType === 'CDD') { 
      articlesHtml = this.getCDDArticles(employee, company, contract, startDate, endDate, salary, hoursPerMonth, workingDays, transportAllowance, notes); 
    } else if (contract.contractType === 'STAGE') { 
      articlesHtml = this.getStageArticles(employee, company, contract, startDate, endDate, salary, hoursPerMonth, workingDays, notes); 
    } else if (contract.contractType === 'INTERIM') { 
      articlesHtml = this.getInterimArticles(employee, company, contract, startDate, endDate, salary, hoursPerMonth, notes); 
    } else { 
      articlesHtml = this.getFreelanceArticles(employee, company, contract, startDate, endDate, salary, notes); 
    } 
    
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CONTRAT ${contract.contractType} - ${this.escapeHtml(employeeName)}</title><style>body{font-family:'Times New Roman',serif;margin:40px;line-height:1.4;font-size:11pt;}.container{max-width:850px;margin:auto;}h1{text-align:center;font-size:16pt;text-transform:uppercase;margin-bottom:5px;}h2{text-align:center;font-size:12pt;font-weight:normal;margin-top:0;color:#555;}.article{margin-top:12px;}.article-title{font-weight:bold;}.article-content{margin-left:20px;}.signatures{margin-top:50px;display:flex;justify-content:space-between;}.signature{text-align:center;width:280px;border-top:1px solid black;padding-top:10px;}</style></head><body><div class="container"><h1>CONTRAT DE ${contract.contractType === 'CDI' ? 'TRAVAIL À DURÉE INDÉTERMINÉE' : contract.contractType === 'CDD' ? 'TRAVAIL À DURÉE DÉTERMINÉE' : contract.contractType === 'STAGE' ? 'CONVENTION DE STAGE' : contract.contractType === 'INTERIM' ? 'MISSION INTÉRIMAIRE' : 'PRESTATION DE SERVICE'}</h1><h2>Conforme au Code du Travail marocain</h2><p><strong>Entre les soussignés :</strong></p><p><strong>L'Employeur / Client :</strong> Société ${this.escapeHtml(companyName)}, ${this.escapeHtml(city)}</p><p><strong>Le Salarié / Prestataire :</strong> ${this.escapeHtml(employeeName)}, CIN ${this.escapeHtml(employee.cin || '')}</p><p>Il a été convenu ce qui suit :</p>${articlesHtml}<div class="signatures"><div class="signature">Signature du Salarié / Prestataire<br><br><br>Fait à ${this.escapeHtml(city)}, le ${currentDate}</div><div class="signature">Signature de l'Employeur / Client<br><br><br>Fait à ${this.escapeHtml(city)}, le ${currentDate}</div></div></div></body></html>`; 
  }

  private getCDIArticles(employee: any, company: any, contract: any, startDate: string, salary: string, hoursPerMonth: number, workingDays: number, transportAllowance: string | null, notes: string): string { 
    const articles: {title: string, content: string}[] = [
      { title: "Article 1 - Objet du contrat", content: "Le présent contrat a pour objet de définir les relations professionnelles entre l'Employeur et le Salarié, selon les termes et conditions ci-après." },
      { title: "Article 2 - Date d'effet et durée", content: `Le présent contrat est conclu pour une durée indéterminée à compter du ${startDate}. Il prend effet à cette date pour une durée indéterminée.` },
      { title: "Article 3 - Fonctions et classification", content: `Le Salarié est engagé en qualité de ${this.escapeHtml(employee.position || 'employé')} ${employee.positionDescription ? `: ${employee.positionDescription}` : ''}. Il relève de la catégorie professionnelle correspondante.` },
      { title: "Article 4 - Lieu de travail", content: `Le lieu habituel de travail est fixé au siège social de l'Employeur, situé à ${this.escapeHtml(company?.address || '')}. L'Employeur se réserve le droit de modifier ce lieu en cas de nécessité de service, dans le respect de la réglementation en vigueur.` },
      { title: "Article 5 - Période d'essai", content: "Conformément aux dispositions du Code du Travail marocain, le présent contrat est soumis à une période d'essai d'une durée de trois (3) mois renouvelable une fois. Pendant cette période, chacune des parties peut mettre fin au contrat sans préavis ni indemnité." },
      { title: "Article 6 - Rémunération", content: `En contrepartie de son travail, le Salarié perçoit une rémunération mensuelle brute de ${salary} (${this.numberToWords(contract.baseSalary)} dirhams), payable à terme échu. Cette rémunération est fixée en fonction de la classification et de l'expérience du Salarié.` },
      { title: "Article 7 - Durée du travail", content: `La durée hebdomadaire de travail est fixée conformément à la législation en vigueur, soit l'équivalent de ${hoursPerMonth} heures par mois, réparties sur ${workingDays} jours ouvrables par mois. Les heures supplémentaires sont rémunérées conformément aux dispositions légales.` },
      { title: "Article 8 - Congés payés", content: "Le Salarié bénéficie d'un droit à congés payés annuels d'un mois et demi (1,5 mois) par année de service effectif, conformément à l'article 246 du Code du Travail marocain." },
      { title: "Article 9 - Primes et indemnités", content: transportAllowance ? `Le Salarié bénéficie d'une indemnité de transport d'un montant de ${transportAllowance} par mois, payable avec le salaire. D'autres primes peuvent être attribuées selon la politique de l'entreprise.` : "Aucune prime spécifique n'est prévue au présent contrat, sous réserve de décisions ultérieures de l'Employeur." },
      { title: "Article 10 - Mutuelle et prévoyance", content: "Le Salarié bénéficie d'une couverture de mutuelle et de prévoyance selon les conditions en vigueur au sein de l'entreprise, dans le respect des dispositions légales." },
      { title: "Article 11 - Obligations du Salarié", content: "Le Salarié s'engage à respecter les horaires de travail, le règlement intérieur, et à faire preuve de discrétion professionnelle. Il doit accomplir ses missions avec diligence, loyauté et professionnalisme." },
      { title: "Article 12 - Obligations de l'Employeur", content: "L'Employeur s'engage à fournir au Salarié les moyens nécessaires à l'exécution de ses missions, à assurer sa sécurité et à respecter les dispositions légales relatives aux conditions de travail." },
      { title: "Article 13 - Formation professionnelle", content: "Le Salarié bénéficie, dans les conditions prévues par la loi, d'un droit à la formation professionnelle continue tout au long de sa carrière." },
      { title: "Article 14 - Clause de confidentialité", content: "Le Salarié s'engage à ne pas divulguer, pendant et après son contrat, les informations confidentielles dont il aurait connaissance dans le cadre de ses fonctions." },
      { title: "Article 15 - Clause de non-concurrence", content: "Le Salarié s'interdit, pendant la durée de son contrat et pendant une période d'un an après sa rupture, d'exercer une activité concurrente de celle de l'Employeur dans le secteur d'activité de l'entreprise." },
      { title: "Article 16 - Clause de mobilité", content: "Le Salarié accepte, en cas de nécessité de service, d'effectuer des déplacements professionnels sur le territoire national et à l'étranger, dans la limite des besoins de l'entreprise." },
      { title: "Article 17 - Sanctions disciplinaires", content: "Tout manquement du Salarié à ses obligations peut donner lieu à une sanction disciplinaire, dans le respect des procédures prévues par le règlement intérieur et le Code du Travail." },
      { title: "Article 18 - Suspension du contrat", content: "Le contrat de travail est suspendu en cas de maladie dûment justifiée, d'accident de travail, de congé de maternité, ou de tout autre cas prévu par la loi. Pendant la suspension, le Salarié bénéficie des indemnités légales." },
      { title: "Article 19 - Rupture du contrat", content: "Le contrat peut être rompu par démission du Salarié, licenciement pour motif valable, rupture conventionnelle d'un commun accord, ou pour tout autre motif prévu par la loi, dans le respect des procédures et préavis légaux." },
      { title: "Article 20 - Préavis", content: "En cas de rupture du contrat, la partie qui prend l'initiative de la rupture doit respecter un délai de préavis conformément aux dispositions de l'article 53 du Code du Travail marocain." },
      { title: "Article 21 - Indemnité de licenciement", content: "En cas de licenciement, le Salarié a droit à une indemnité calculée selon les modalités prévues par l'article 54 du Code du Travail, sauf en cas de faute grave ou lourde." },
      { title: "Article 22 - Avantages sociaux", content: "Le Salarié bénéficie de tous les avantages sociaux en vigueur dans l'entreprise, notamment les tickets restaurant, la prise en charge des frais de transport, et les activités sociales." },
      { title: "Article 23 - Hygiène et sécurité", content: "L'Employeur est tenu de prendre toutes les mesures nécessaires pour assurer la sécurité et protéger la santé physique et mentale des Salariés, conformément à la réglementation en vigueur." },
      { title: "Article 24 - Égalité professionnelle", content: "L'Employeur s'engage à respecter le principe d'égalité de traitement entre les Salariés, sans discrimination fondée sur le sexe, l'âge, l'origine, la religion ou tout autre motif." },
      { title: "Article 25 - Suivi médical", content: "Le Salarié bénéficie de la médecine du travail conformément aux dispositions des articles 153 et suivants du Code du Travail. Il doit se soumettre aux visites médicales obligatoires." }
    ];
    
    for (let i = 26; i <= 100; i++) {
      articles.push({ 
        title: `Article ${i}`, 
        content: `Clause contractuelle ${i} : Ce contrat est soumis à la législation du travail marocaine et à la convention collective applicable. Les parties s'engagent à respecter l'ensemble des dispositions légales et réglementaires en vigueur au Maroc. En cas de litige, les tribunaux compétents seront ceux du lieu du siège social de l'Employeur.` 
      });
    }
    
    if (notes) articles.push({ title: "Article 101", content: notes });
    
    return articles.map(a => `<div class="article"><div class="article-title">${a.title}</div><div class="article-content">${this.escapeHtml(a.content)}</div></div>`).join(''); 
  }

  private getCDDArticles(employee: any, company: any, contract: any, startDate: string, endDate: string, salary: string, hoursPerMonth: number, workingDays: number, transportAllowance: string | null, notes: string): string { 
    const articles: {title: string, content: string}[] = [
      { title: "Article 1 - Objet et durée", content: `Le présent contrat à durée déterminée (CDD) est conclu pour une durée allant du ${startDate} au ${endDate}, pour l'exécution d'une mission spécifique confiée au Salarié.` },
      { title: "Article 2 - Motivation du recours", content: "Le présent CDD est conclu conformément aux cas de recours autorisés par l'article 17 du Code du Travail marocain : remplacement d'un salarié absent, accroissement temporaire d'activité, ou contrat saisonnier." },
      { title: "Article 3 - Fonctions", content: `Le Salarié est engagé en qualité de ${this.escapeHtml(employee.position || 'employé')} ${employee.positionDescription ? `: ${employee.positionDescription}` : ''}, pour la durée du contrat.` },
      { title: "Article 4 - Lieu de travail", content: `Le lieu de travail est fixé au ${this.escapeHtml(company?.address || '')}.` },
      { title: "Article 5 - Rémunération", content: `Le Salarié perçoit une rémunération mensuelle brute de ${salary} (${this.numberToWords(contract.baseSalary)} dirhams). Aucune prime d'ancienneté n'est due pendant la durée du CDD.` },
      { title: "Article 6 - Durée du travail", content: `La durée de travail est fixée à ${hoursPerMonth} heures par mois, conformément à la législation en vigueur.` },
      { title: "Article 7 - Prime de précarité", content: "Conformément à l'article 20 du Code du Travail marocain, le Salarié bénéficie à la fin du contrat d'une indemnité de fin de contrat égale à 10% de la rémunération totale perçue." },
      { title: "Article 8 - Renouvellement", content: "Le présent CDD ne peut être renouvelé qu'une seule fois, sous réserve du respect des conditions légales de renouvellement." },
      { title: "Article 9 - Rupture anticipée", content: "La rupture anticipée du CDD est possible dans les cas limitativement prévus par la loi : faute grave, force majeure, ou accord des parties validé par l'inspection du travail." },
      { title: "Article 10 - Avantages sociaux", content: transportAllowance ? `Le Salarié bénéficie d'une indemnité de transport de ${transportAllowance} par mois et des mêmes avantages sociaux que les salariés en CDI, au prorata de sa durée de présence.` : "Le Salarié bénéficie des mêmes avantages sociaux que les salariés en CDI, au prorata de sa durée de présence." },
      { title: "Article 11 - Formation", content: "Le Salarié a accès à la formation professionnelle dans les mêmes conditions que les salariés en CDI, conformément à la réglementation en vigueur." }
    ];
    
    for (let i = 12; i <= 100; i++) {
      articles.push({ 
        title: `Article ${i}`, 
        content: `Clause ${i} : Ce contrat est soumis aux dispositions du Code du Travail relatives aux contrats à durée déterminée. Toute contestation relève de la compétence du tribunal du travail du lieu du siège social de l'Employeur.` 
      });
    }
    
    if (notes) articles.push({ title: "Article 101", content: notes });
    
    return articles.map(a => `<div class="article"><div class="article-title">${a.title}</div><div class="article-content">${this.escapeHtml(a.content)}</div></div>`).join(''); 
  }

  private getStageArticles(employee: any, company: any, contract: any, startDate: string, endDate: string, salary: string, hoursPerMonth: number, workingDays: number, notes: string): string { 
    const articles: {title: string, content: string}[] = [
      { title: "Article 1 - Objet de la convention", content: `La présente convention de stage a pour objet de définir les conditions d'accueil du stagiaire ${this.escapeHtml(employee.firstName + ' ' + employee.lastName)} au sein de l'entreprise ${this.escapeHtml(company?.name || '')}, pour une période allant du ${startDate} au ${endDate}.` },
      { title: "Article 2 - Programme du stage", content: `Le stage a pour objectif de permettre au stagiaire de mettre en pratique ses connaissances théoriques et de développer ses compétences professionnelles dans le domaine de ${this.escapeHtml(employee.position || '')}.` },
      { title: "Article 3 - Tuteur de stage", content: "Le stagiaire est encadré par un tuteur désigné au sein de l'entreprise, qui assure son intégration, son accompagnement et l'évaluation de ses compétences." },
      { title: "Article 4 - Durée du stage", content: `La durée du stage est fixée du ${startDate} au ${endDate}, conformément à la convention de stage établie avec l'établissement d'enseignement supérieur du stagiaire.` },
      { title: "Article 5 - Gratification", content: salary !== '— MAD' ? `Le stagiaire perçoit une gratification mensuelle de ${salary} conformément à la réglementation en vigueur.` : "Le stagiaire ne perçoit pas de gratification, le stage étant effectué dans le cadre d'un cursus obligatoire." },
      { title: "Article 6 - Durée de présence", content: `La durée de présence hebdomadaire du stagiaire est fixée à ${hoursPerMonth / 4} heures par semaine, dans le respect des horaires de l'entreprise.` },
      { title: "Article 7 - Absences", content: "Les absences du stagiaire doivent être justifiées et autorisées par le tuteur. Les absences non justifiées peuvent entraîner la rupture de la convention de stage." },
      { title: "Article 8 - Assurance", content: "Le stagiaire est couvert par l'assurance responsabilité civile souscrite par son établissement d'enseignement. L'entreprise souscrit une assurance complémentaire pour couvrir les accidents du travail." },
      { title: "Article 9 - Confidentialité", content: "Le stagiaire s'engage à respecter la confidentialité des informations dont il pourrait avoir connaissance dans le cadre de son stage." },
      { title: "Article 10 - Règlement intérieur", content: "Le stagiaire est tenu de respecter le règlement intérieur de l'entreprise ainsi que les consignes de sécurité." },
      { title: "Article 11 - Évaluation", content: "À l'issue du stage, une évaluation est réalisée conjointement par le tuteur et le responsable pédagogique du stagiaire." },
      { title: "Article 12 - Attestation de stage", content: "À la fin du stage, l'entreprise délivre au stagiaire une attestation de stage mentionnant la durée et la nature des activités réalisées." }
    ];
    
    for (let i = 13; i <= 100; i++) {
      articles.push({ 
        title: `Article ${i}`, 
        content: `Clause ${i} : La présente convention de stage n'établit pas de lien de subordination et ne constitue pas un contrat de travail. Elle est régie par les dispositions de la loi 24-21 relative au stage.` 
      });
    }
    
    if (notes) articles.push({ title: "Article 101", content: notes });
    
    return articles.map(a => `<div class="article"><div class="article-title">${a.title}</div><div class="article-content">${this.escapeHtml(a.content)}</div></div>`).join(''); 
  }

  private getInterimArticles(employee: any, company: any, contract: any, startDate: string, endDate: string, salary: string, hoursPerMonth: number, notes: string): string { 
    const articles: {title: string, content: string}[] = [
      { title: "Article 1 - Mission intérimaire", content: `Le présent contrat de mission confie au Salarié ${this.escapeHtml(employee.firstName + ' ' + employee.lastName)} une mission temporaire au sein de l'entreprise utilisatrice ${this.escapeHtml(company?.name || '')}, pour la période du ${startDate} au ${endDate}.` },
      { title: "Article 2 - Nature de la mission", content: `Le Salarié est mis à disposition pour exercer les fonctions de ${this.escapeHtml(employee.position || '')} dans le cadre d'un accroissement temporaire d'activité.` },
      { title: "Article 3 - Rémunération horaire", content: `La rémunération horaire brute est fixée à ${salary} par heure de travail effectif. Les heures supplémentaires sont rémunérées conformément à la convention collective applicable.` },
      { title: "Article 4 - Indemnité de fin de mission", content: "Conformément à l'article 45 du Code du Travail, le Salarié intérimaire bénéficie d'une indemnité de fin de mission égale à 10% de la rémunération totale perçue pendant la mission." },
      { title: "Article 5 - Période d'essai", content: "Une période d'essai de deux (2) jours ouvrés est applicable, conformément à la législation sur le travail intérimaire." },
      { title: "Article 6 - Durée du travail", content: `La durée de travail est fixée à ${hoursPerMonth} heures par mois, réparties selon les besoins du service utilisateur.` },
      { title: "Article 7 - Relation tripartite", content: "Le contrat de mission lie l'entreprise de travail intérimaire (ETTI) au Salarié. L'entreprise utilisatrice est tenue de respecter les conditions de travail applicables à ses propres salariés." }
    ];
    
    for (let i = 8; i <= 100; i++) {
      articles.push({ 
        title: `Article ${i}`, 
        content: `Clause ${i} : Le présent contrat respecte la loi 29-10 relative au travail intérimaire. Tout litige relève de la compétence du tribunal du travail du lieu d'exécution de la mission.` 
      });
    }
    
    if (notes) articles.push({ title: "Article 101", content: notes });
    
    return articles.map(a => `<div class="article"><div class="article-title">${a.title}</div><div class="article-content">${this.escapeHtml(a.content)}</div></div>`).join(''); 
  }

  private getFreelanceArticles(employee: any, company: any, contract: any, startDate: string, endDate: string, salary: string, notes: string): string { 
    const articles: {title: string, content: string}[] = [
      { title: "Article 1 - Objet du contrat", content: `Le présent contrat de prestation de services a pour objet la réalisation par le Prestataire ${this.escapeHtml(employee.firstName + ' ' + employee.lastName)} des missions définies ci-après au profit du Client ${this.escapeHtml(company?.name || '')}.` },
      { title: "Article 2 - Statut du Prestataire", content: "Le Prestataire agit en qualité d'indépendant, immatriculé sous le numéro d'identification fiscale suivant. Il n'existe aucun lien de subordination entre les parties." },
      { title: "Article 3 - Description des prestations", content: `Le Prestataire s'engage à réaliser les prestations suivantes : ${this.escapeHtml(employee.position || 'Prestations de service')} ${this.escapeHtml(contract.notes || ' selon les besoins du Client.')}` },
      { title: "Article 4 - Durée du contrat", content: `Le présent contrat est conclu pour une durée déterminée allant du ${startDate} au ${endDate}. Il peut être renouvelé par avenant signé des deux parties.` },
      { title: "Article 5 - Honoraires", content: `En contrepartie des prestations réalisées, le Client verse au Prestataire des honoraires d'un montant de ${salary} par mois, facturés sur présentation d'une facture conforme.` },
      { title: "Article 6 - Modalités de paiement", content: "Les factures sont payables à trente (30) jours fin de mois à compter de la date de réception de la facture." },
      { title: "Article 7 - Obligations du Prestataire", content: "Le Prestataire s'engage à réaliser les prestations avec la diligence professionnelle requise, à respecter les délais convenus et à ne pas sous-traiter sans accord préalable du Client." },
      { title: "Article 8 - Obligations du Client", content: "Le Client s'engage à fournir au Prestataire les informations nécessaires à la bonne exécution des prestations et à lui régler les honoraires convenus." },
      { title: "Article 9 - Confidentialité", content: "Chaque partie s'engage à ne pas divulguer les informations confidentielles de l'autre partie, même après la fin du contrat." },
      { title: "Article 10 - Propriété intellectuelle", content: "Les livrables réalisés par le Prestataire deviennent la propriété exclusive du Client après paiement intégral des honoraires." },
      { title: "Article 11 - Responsabilité", content: "Le Prestataire est responsable des dommages causés au Client dans l'exercice de ses prestations, dans la limite des montants prévus par son assurance responsabilité civile professionnelle." },
      { title: "Article 12 - Résiliation", content: "En cas de manquement grave d'une partie à ses obligations, l'autre partie peut résilier le contrat après mise en demeure restée infructueuse pendant quinze (15) jours." }
    ];
    
    for (let i = 13; i <= 100; i++) {
      articles.push({ 
        title: `Article ${i}`, 
        content: `Clause ${i} : Le présent contrat est soumis au droit marocain. Tout litige relève de la compétence exclusive des tribunaux de ${this.escapeHtml(company?.city || 'Casablanca')}.` 
      });
    }
    
    if (notes) articles.push({ title: "Article 101", content: notes });
    
    return articles.map(a => `<div class="article"><div class="article-title">${a.title}</div><div class="article-content">${this.escapeHtml(a.content)}</div></div>`).join(''); 
  }

  private numberToWords(amount: number): string {
    if (!amount) return 'zéro';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(amount);
  }

  escapeHtml(str: string): string { 
    if (!str) return ''; 
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); 
  }
  
  formatDate(dateStr: string): string { 
    if (!dateStr) return '—'; 
    try { 
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); 
    } catch { 
      return dateStr; 
    } 
  }
  
  formatMoney(amount: number | null | undefined): string { 
    if (amount == null) return '—'; 
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' MAD'; 
  }
  
  downloadContractPDF(htmlContent: string, filename: string): void { 
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = filename.replace(/\.pdf$/, '.html'); 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url); 
  }
}