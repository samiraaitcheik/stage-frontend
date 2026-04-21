import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService, EmployeeService, CompanyService, LicenseService, UserService } from '../../core/services/domain.services';
import { AuthService } from '../../core/services/auth.service';
import { CONTRACT_TYPE_OPTIONS, CONTRACT_STATUS_OPTIONS, Company } from '../../core/models';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  readonly typeOptions = CONTRACT_TYPE_OPTIONS;
  readonly statusOptions = CONTRACT_STATUS_OPTIONS;

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
        console.log('Employees loaded:', this.employees);
        if (this.employees.length > 0) {
          console.log('Sample employee structure:', this.employees[0]);
        }
        // Extract departments immediately for non-super admin or if no companies
        if (!this.auth.isSuperAdmin() || this.companies.length === 0) {
          this.extractDepartments();
          console.log('Departments extracted:', this.departments);
        }
        this.filteredEmployees = [...this.employees];
        this.cdr.detectChanges(); 
      } 
    });
  }

  loadCompanies() {
    this.companyService.getAll().subscribe({ 
      next: (data) => { 
        this.companies = data; 
        console.log('Companies loaded:', this.companies);
        // Always extract departments after companies are loaded for super admin
        if (this.auth.isSuperAdmin() && this.employees.length > 0) {
          this.extractDepartments();
          console.log('Departments extracted with companies data:', this.departments);
          this.cdr.detectChanges(); // Force UI update
        }
      },
      error: (err) => {
        console.error('Error loading companies:', err);
        // Still extract departments from employees if companies fail to load
        if (this.employees.length > 0) {
          this.extractDepartments();
          console.log('Departments extracted from employees only:', this.departments);
        }
      }
    });
  }

  extractDepartments() {
    const deptSet = new Set<string>();
    console.log('Extracting departments...');
    console.log('Employees count:', this.employees.length);
    console.log('Companies count:', this.companies.length);
    
    // Ajouter les départements depuis les employés
    this.employees.forEach((emp, index) => {
      if (index < 3) { // Only log first 3 employees to avoid spam
        console.log(`Employee ${index}:`, emp);
      }
      
      // Vérifier plusieurs noms de champs possibles pour le département
      const department = emp.department || emp.dept || emp.section || emp.division || emp.team || emp.service;
      
      if (department && typeof department === 'string' && department.trim()) {
        deptSet.add(department.trim());
        console.log(`Found department from employee: ${department.trim()}`);
      }
    });
    
    // Ajouter les départements depuis les entreprises
    this.companies.forEach((company: any, index) => {
      if (index < 3) { // Only log first 3 companies to avoid spam
        console.log(`Company ${index}:`, company);
      }
      
      // Vérifier si l'entreprise a des départements définis
      if (company.departments && Array.isArray(company.departments)) {
        company.departments.forEach((dept: any) => {
          if (dept && typeof dept === 'string' && dept.trim()) {
            deptSet.add(dept.trim());
            console.log(`Found department from company ${company.name}: ${dept.trim()}`);
          }
        });
      }
      
      // Vérifier d'autres champs possibles dans l'entreprise
      const companyDept = (company as any).mainDepartment || (company as any).primaryDepartment || (company as any).department;
      if (companyDept && typeof companyDept === 'string' && companyDept.trim()) {
        deptSet.add(companyDept.trim());
        console.log(`Found main department from company ${company.name}: ${companyDept.trim()}`);
      }
    });
    
    this.departments = Array.from(deptSet).sort();
    console.log('Final departments list:', this.departments);
    console.log('Departments count:', this.departments.length);
    
    // Si aucun département n'est trouvé, ajouter quelques départements par défaut pour le test
    if (this.departments.length === 0) {
      console.log('No departments found, adding default departments for testing');
      this.departments = ['Technique', 'Commercial', 'RH', 'Finance', 'Marketing'];
      console.log('Default departments added:', this.departments);
    }
  }

  onDepartmentChange() {
    console.log('Department changed to:', this.selectedDepartment);
    
    if (this.selectedDepartment) {
      this.filteredEmployees = this.employees.filter(emp => {
        // Vérifier plusieurs noms de champs possibles pour le département
        const department = emp.department || emp.dept || emp.section || emp.division || emp.team || emp.service;
        return department === this.selectedDepartment;
      });
      console.log('Filtered employees:', this.filteredEmployees);
    } else {
      this.filteredEmployees = [...this.employees];
      console.log('Showing all employees:', this.filteredEmployees.length);
    }
    
    // Réinitialiser la sélection d'employé si l'employé sélectionné n'est plus dans la liste filtrée
    if (this.form.employeeId && !this.filteredEmployees.find(emp => emp.id === this.form.employeeId)) {
      console.log('Resetting employee selection as current employee is not in filtered list');
      this.form.employeeId = '';
    }
    
    this.cdr.detectChanges();
  }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.applySearch(); this.loading = false; this.cdr.detectChanges(); },
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
      const matchesCompany = this.companyFilterId
        ? employee?.companyId === this.companyFilterId
        : true;
      const matchesType = this.typeFilter
        ? i.contractType === this.typeFilter
        : true;
      const matchesStatus = this.statusFilter
        ? i.status === this.statusFilter
        : true;
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

  closeFilterPanel() {
    this.showFilterPanel = false;
  }

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

  clearCompanyFilter() {
    this.companyFilterId = '';
    this.applySearch();
  }

  clearTypeFilter() {
    this.typeFilter = '';
    this.applySearch();
  }

  clearStatusFilter() {
    this.statusFilter = '';
    this.applySearch();
  }

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
    this.selectedDepartment = '';
    this.filteredEmployees = [...this.employees];
    this.editing = false; this.editingId = ''; this.error = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEdit(item: any) {
    this.form = {
      employeeId: item.employeeId,
      contractType: item.contractType,
      status: item.status,
      startDate: item.startDate?.slice(0, 10),
      endDate: item.endDate?.slice(0, 10) ?? '',
      baseSalary: item.baseSalary,
      hoursPerMonth: item.hoursPerMonth ?? null,
      workingDaysPerMonth: item.workingDaysPerMonth ?? null,
      transportAllowance: item.transportAllowance ?? null,
      notes: item.notes ?? ''
    };
    this.editing = true; this.editingId = item.id; this.error = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  save() {
    if (!this.form.employeeId || !this.form.contractType || !this.form.startDate || !this.form.baseSalary) {
      this.error = 'Champs obligatoires manquants.';
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

    const obs = this.editing ? this.service.update(this.editingId, payload) : this.service.create(payload);
    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.error = e?.error?.error || 'Erreur serveur'; this.cdr.detectChanges(); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close() { this.showModal = false; this.cdr.detectChanges(); }

  statusClass(s: string): string {
    const m: any = { ACTIVE: 'badge-success', DRAFT: 'badge-secondary', ENDED: 'badge-danger', SUSPENDED: 'badge-warning', TERMINATED: 'badge-danger' };
    return m[s] ?? 'badge-secondary';
  }

  typeClass(t: string): string {
    const m: any = { CDI: 'badge-success', CDD: 'badge-info', STAGE: 'badge-warning', INTERIM: 'badge-purple', FREELANCE: 'badge-secondary' };
    return m[t] ?? 'badge-secondary';
  }

  openServiceContractModal() {
    this.showServiceContractModal = true;
    this.cdr.detectChanges();
  }

  closeServiceContractModal() {
    this.showServiceContractModal = false;
    this.selectedCompany = null;
    this.selectedLicense = null;
    this.selectedCompanyUsers = [];
  }

  onCompanySelect(companyId: string) {
    this.selectedCompany = this.companies.find(c => c.id === companyId);
    if (this.selectedCompany) {
      this.loadCompanyLicense(this.selectedCompany.id);
      this.loadCompanyUsers(this.selectedCompany.id);
    }
  }

  loadCompanyLicense(companyId: string) {
    this.licenseService.getByCompany(companyId).subscribe({
      next: (license) => {
        this.selectedLicense = license;
      },
      error: () => {
        console.error('Error loading license');
      }
    });
  }

  loadCompanyUsers(companyId: string) {
    this.userService.getAll().subscribe({
      next: (users: any[]) => {
        this.selectedCompanyUsers = users.filter(user => user.companyId === companyId);
      },
      error: () => {
        console.error('Error loading users');
      }
    });
  }

  generateServiceContract() {
    if (!this.selectedCompany) return;

    try {
      // Generate HTML contract
      const contractHTML = this.createServiceContractHTML();
      
      // Create and download PDF
      this.downloadContractPDF(contractHTML, `Contrat_Service_${this.selectedCompany.name}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Show success message
      alert('Contrat généré avec succès!');
    } catch (error) {
      console.error('Contract generation error:', error);
      alert('Erreur lors de la génération du contrat');
    }
  }

  private createServiceContractHTML(): string {
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
        .service-contract-title { color: #1f2937; font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="service-contract-title">CONTRAT DE SERVICE HRMatrix</div>
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
          <li>Le support technique est inclus selon le plan souscrit.</li>
          <li>Les mises à jour logicielles sont incluses sans frais supplémentaires.</li>
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
        <p>Ce contrat de service a été généré automatiquement le ${currentDate} via la plateforme HRMatrix.</p>
        <p>Pour toute question, contactez support@hrmatrix.ma | www.hrmatrix.ma</p>
        <p>Tél: +212 5XX XXX XXX | Adresse: 123 Avenue Mohammed V, Casablanca</p>
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

  // ─── Employee Contract Generation ────────────────────────────────────────────────

  generateEmployeeContract(contract: any) {
    if (!contract) return;

    try {
      // Generate HTML contract
      const contractHTML = this.createEmployeeContractHTML(contract);
      
      // Get employee name for filename
      const employeeName = this.getEmployeeName(contract.employeeId);
      const filename = `Contrat_Travail_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Create and download PDF
      this.downloadContractPDF(contractHTML, filename);
      
      // Show success message
      alert('Contrat d\'employé généré avec succès!');
    } catch (error) {
      console.error('Employee contract generation error:', error);
      alert('Erreur lors de la génération du contrat d\'employé');
    }
  }

  private createEmployeeContractHTML(contract: any): string {
    if (!contract) return '';

    const employee = this.employees.find(e => e.id === contract.employeeId);
    if (!employee) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const employeeCompany = this.companies.find(c => c.id === employee.companyId);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Contrat de Travail - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #1f2937; font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .employee-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .section { margin: 30px 0; }
        .section-title { color: #4f46e5; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #374151; }
        .signature { margin-top: 50px; }
        .signature-box { border: 1px solid #d1d5db; padding: 20px; margin: 20px 0; height: 80px; }
        .footer { margin-top: 50px; text-align: center; color: #6b7280; font-size: 12px; }
        .badge { background: #4f46e5; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
        .salary-info { background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #16a34a; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONTRAT DE TRAVAIL</div>
        <h2>${employee.firstName} ${employee.lastName}</h2>
        <p>Date: ${currentDate}</p>
      </div>

      <div class="employee-info">
        <div class="section-title">INFORMATIONS DE L'EMPLOYÉ</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Nom complet:</span> ${employee.firstName} ${employee.lastName}
          </div>
          <div class="info-item">
            <span class="info-label">Email:</span> ${employee.email || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Téléphone:</span> ${employee.phone || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Code employé:</span> ${employee.employeeCode || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Entreprise:</span> ${employeeCompany?.name || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Rôle:</span> <span class="badge">${employee.role || 'EMPLOYEE'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DÉTAILS DU CONTRAT</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Type de contrat:</span> <span class="badge">${contract.contractType}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Statut:</span> <span class="badge">${contract.status}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Date de début:</span> ${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Date de fin:</span> ${contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'Indéterminée (CDI)'}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONDITIONS SALARIALES</div>
        <div class="salary-info">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Salaire de base:</span> <strong>${contract.baseSalary ? contract.baseSalary.toLocaleString('fr-FR') + ' MAD' : 'N/A'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Heures par mois:</span> ${contract.hoursPerMonth || '191'} heures
            </div>
            <div class="info-item">
              <span class="info-label">Jours ouvrés:</span> ${contract.workingDaysPerMonth || '26'} jours
            </div>
            <div class="info-item">
              <span class="info-label">Indemnité transport:</span> ${contract.transportAllowance ? contract.transportAllowance.toLocaleString('fr-FR') + ' MAD' : 'Non incluse'}
            </div>
          </div>
        </div>
      </div>

      ${contract.notes ? `
      <div class="section">
        <div class="section-title">NOTIONS ADDITIONNELLES</div>
        <p>${contract.notes}</p>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">TERMES ET CONDITIONS</div>
        <p>Ce contrat de travail régit les conditions d'emploi entre ${employeeCompany?.name || 'l\'entreprise'} et ${employee.firstName} ${employee.lastName}.</p>
        <ul>
          <li>L'employé s'engage à respecter les horaires et conditions de travail définies.</li>
          <li>L'employeur s'engage à verser le salaire convenu aux dates prévues.</li>
          <li>La période d'essai est de 3 mois renouvelable une fois.</li>
          <li>Le contrat peut être rompu selon les dispositions du code du travail marocain.</li>
          <li>L'employé bénéficie des congés payés selon la législation en vigueur.</li>
          <li>La confidentialité des informations de l'entreprise est obligatoire.</li>
        </ul>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>Pour l'employé:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>Pour l'employeur:</strong></p>
            <div class="signature-box"></div>
            <p>${employeeCompany?.name || 'Représentant légal'}</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Ce contrat de travail a été généré automatiquement le ${currentDate} via la plateforme HRMatrix.</p>
        <p>Pour toute question, contactez support@hrmatrix.ma | www.hrmatrix.ma</p>
        <p>Tél: +212 5XX XXX XXX | Adresse: 123 Avenue Mohammed V, Casablanca</p>
      </div>
    </body>
    </html>
    `;
  }
}