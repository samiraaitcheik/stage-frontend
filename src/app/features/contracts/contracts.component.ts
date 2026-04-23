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
      const contractHTML = this.createSimpleLongMoroccanContractHTML(contract);
      
      // Get employee name for filename
      const employeeName = this.getEmployeeName(contract.employeeId);
      const contractTypeLabel = this.getMoroccanContractTypeLabel(contract.contractType);
      const filename = `Contrat_${contractTypeLabel}_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Create and download PDF
      this.downloadContractPDF(contractHTML, filename);
      
      // Show success message
      alert(`Contrat ${contractTypeLabel} généré avec succès!`);
    } catch (error) {
      console.error('Employee contract generation error:', error);
      alert('Erreur lors de la génération du contrat d\'employé');
    }
  }

  /**
   * Obtenir le libellé du type de contrat marocain
   */
  private getMoroccanContractTypeLabel(contractType: string): string {
    const labels: Record<string, string> = {
      'CDI': 'CDI_A_Duree_Indeterminee',
      'CDD': 'CDD_A_Duree_Determinee',
      'STAGE': 'Convention_Stage',
      'INTERIM': 'Contrat_Interimaire',
      'FREELANCE': 'Contrat_Prestation_Service'
    };
    return labels[contractType] || 'Contrat_Travail';
  }

  private createMoroccanContractHTML(contract: any): string {
    if (!contract) return '';

    const employee = this.employees.find(e => e.id === contract.employeeId);
    if (!employee) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const employeeCompany = this.companies.find(c => c.id === employee.companyId);

    // Générer le contenu spécifique selon le type de contrat
    switch (contract.contractType) {
      case 'CDI':
        return this.createCDIContractHTML(employee, contract, employeeCompany, currentDate);
      case 'CDD':
        return this.createCDDContractHTML(employee, contract, employeeCompany, currentDate);
      case 'STAGE':
        return this.createStageContractHTML(employee, contract, employeeCompany, currentDate);
      case 'INTERIM':
        return this.createInterimContractHTML(employee, contract, employeeCompany, currentDate);
      case 'FREELANCE':
        return this.createFreelanceContractHTML(employee, contract, employeeCompany, currentDate);
      default:
        return this.createStandardContractHTML(employee, contract, employeeCompany, currentDate);
    }
  }

  private createCDIContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; color: #000000; }
        .header { text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #000000; font-size: 26px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .subtitle { color: #000000; font-size: 14px; text-align: center; margin-bottom: 20px; font-style: italic; }
        .section { margin: 30px 0; }
        .section-title { color: #000000; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #dc2626; padding-left: 10px; }
        .article { margin: 20px 0; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; }
        .article-title { font-weight: bold; color: #000000; margin-bottom: 8px; font-size: 14px; }
        .article p, .article ul, .article li { color: #000000; font-size: 12px; line-height: 1.4; }
        .article ul { margin: 8px 0; padding-left: 20px; }
        .article li { margin: 4px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #000000; font-size: 12px; }
        .info-item span, .info-item strong { color: #000000; font-size: 12px; }
        .signature { margin-top: 50px; }
        .signature-box { border: 2px solid #dc2626; padding: 20px; margin: 20px 0; height: 80px; }
        .signature p { color: #000000; font-size: 12px; }
        .footer { margin-top: 50px; text-align: center; color: #000000; font-size: 10px; }
        .badge { background: #dc2626; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .salary-info { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .salary-info p, .salary-info .info-label, .salary-info .info-item span, .salary-info .info-item strong { color: #000000; font-size: 12px; }
        .maroccan-flag { color: #000000; font-weight: bold; }
        h3 { color: #000000; font-size: 20px; margin: 10px 0; }
        h2 { color: #000000; font-size: 22px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE</div>
        <div class="subtitle">Conformément aux dispositions du Dahir n° 1-03-194 du 14 rajeb 1424 (11 septembre 2003) portant promulgation de la loi n° 65-99 relative au Code du Travail</div>
        <h3>${employee.firstName} ${employee.lastName}</h3>
        <p class="maroccan-flag">ROYAUME DU MAROC</p>
        <p>Fait à ${company?.city || 'Casablanca'}, le ${currentDate}</p>
      </div>

      <div class="section">
        <div class="section-title">DISPOSITIONS GÉNÉRALES</div>
        <div class="article">
          <div class="article-title">Article 2: Objet du contrat</div>
          <p>Le présent contrat a pour objet l'engagement de l'employé par l'employeur pour exercer les fonctions de ${employee.role || 'Employé'} conformément aux conditions ci-après.</p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 3: Période d'essai</div>
          <p>Une période d'essai de <strong>trois (3) mois</strong> est prévue, renouvelable une seule fois pour la même durée, conformément à l'article 13 du Code du Travail.</p>
        </div>

        <div class="article">
          <div class="article-title">Article 4: Lieu de travail</div>
          <p>L'employé exercera ses fonctions principalement au siège de l'entreprise situé à ${company?.address || 'N/A'}, ${company?.city || 'N/A'}.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONDITIONS DE RÉMUNÉRATION</div>
        <div class="salary-info">
          <div class="article-title">Article 5: Rémunération</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Salaire de base mensuel:</span> <strong>${contract.baseSalary ? contract.baseSalary.toLocaleString('fr-FR') + ' MAD' : 'N/A'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Heures de travail par mois:</span> <strong>${contract.hoursPerMonth || '191'} heures</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Jours ouvrés par mois:</span> <strong>${contract.workingDaysPerMonth || '26'} jours</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Indemnité de transport:</span> <strong>${contract.transportAllowance ? contract.transportAllowance.toLocaleString('fr-FR') + ' MAD' : 'Non prévue'}</strong>
            </div>
          </div>
          <p style="margin-top: 15px;">Le salaire sera versé mensuellement par virement bancaire ou chèque, au plus tard le 5 de chaque mois.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DROITS ET OBLIGATIONS</div>
        <div class="article">
          <div class="article-title">Article 6: Obligations de l'employé</div>
          <ul>
            <li>Exécuter consciencieusement les tâches confiées</li>
            <li>Respecter les horaires et règles internes de l'entreprise</li>
            <li>Observer une confidentialité absolue sur les informations professionnelles</li>
            <li>Suivre les formations nécessaires à l'amélioration des compétences</li>
          </ul>
        </div>

        <div class="article">
          <div class="article-title">Article 7: Droits de l'employé</div>
          <ul>
            <li>Droit aux congés payés: 2 jours ouvrables par mois de service</li>
            <li>Droit aux jours fériés légaux conformément à la législation marocaine</li>
            <li>Droit à une couverture sociale conformément à la CNSS</li>
            <li>Droit à la formation professionnelle continue</li>
          </ul>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DISPOSITIONS FINALES</div>
        <div class="article">
          <div class="article-title">Article 8: Durée et résiliation</div>
          <p>Le présent contrat est conclu pour une durée indéterminée. La résiliation du contrat peut intervenir par:</p>
          <ul>
            <li>Démission de l'employé avec préavis de 15 jours</li>
            <li>Licenciement pour motif juste avec préavis selon l'ancienneté</li>
            <li>Mutuel accord entre les parties</li>
          </ul>
        </div>

        <div class="article">
          <div class="article-title">Article 9: Litiges</div>
          <p>Tout litige né de l'exécution du présent contrat sera réglé à l'amiable. En cas d'échec, les tribunaux compétents du lieu de travail seront saisis.</p>
        </div>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>L'Employé:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>CIN: ${employee.cin || '[Numéro CIN]'}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>L'Employeur:</strong></p>
            <div class="signature-box"></div>
            <p>${company?.name || 'Société'}</p>
            <p>Représenté par: ___________________</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p class="maroccan-flag">CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE - ROYAUME DU MAROC</p>
        <p>Ce contrat a été généré automatiquement le ${currentDate} via la plateforme HRMatrix.</p>
        <p>Conforme au Code du Travail marocain - Dahir n° 1-03-194 du 14 rajeb 1424</p>
      </div>
    </body>
    </html>
    `;
  }

  private createCDDContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; color: #000000; }
        .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #000000; font-size: 26px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .section { margin: 30px 0; }
        .section-title { color: #000000; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 10px; }
        .article { margin: 20px 0; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; }
        .article-title { font-weight: bold; color: #000000; margin-bottom: 8px; font-size: 14px; }
        .article p, .article ul, .article li { color: #000000; font-size: 12px; line-height: 1.4; }
        .article ul { margin: 8px 0; padding-left: 20px; }
        .article li { margin: 4px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #000000; font-size: 12px; }
        .info-item span, .info-item strong { color: #000000; font-size: 12px; }
        .signature { margin-top: 50px; }
        .signature-box { border: 2px solid #2563eb; padding: 20px; margin: 20px 0; height: 80px; }
        .signature p { color: #000000; font-size: 12px; }
        .footer { margin-top: 50px; text-align: center; color: #000000; font-size: 10px; }
        .badge { background: #2563eb; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .salary-info { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .salary-info p, .salary-info .info-label, .salary-info .info-item span, .salary-info .info-item strong { color: #000000; font-size: 12px; }
        .duration-info { background: #dcfce7; padding: 15px; border-radius: 8px; border-left: 4px solid #16a34a; }
        .duration-info p, .duration-info .info-label, .duration-info .info-item span, .duration-info .info-item strong { color: #000000; font-size: 12px; }
        h3 { color: #000000; font-size: 20px; margin: 10px 0; }
        h2 { color: #000000; font-size: 22px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE</div>
        <h3>${employee.firstName} ${employee.lastName}</h3>
        <p>Fait à ${company?.city || 'Casablanca'}, le ${currentDate}</p>
      </div>

      <div class="section">
        <div class="section-title">ENTRE LES SOUSSIGNÉS</div>
        <div class="article">
          <div class="article-title">Article 1: Parties contractantes</div>
          <p><strong>L'Employeur:</strong> ${company?.name || 'Société'}</p>
          <p><strong>L'Employé:</strong> ${employee.firstName} ${employee.lastName}</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DURÉE DU CONTRAT</div>
        <div class="duration-info">
          <div class="article-title">Article 2: Durée déterminée</div>
          <p>Le présent contrat est conclu pour une durée déterminée de:</p>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Date de début:</span> <strong>${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Date de fin:</span> <strong>${contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'N/A'}</strong>
            </div>
          </div>
          <p style="margin-top: 15px;">Durée totale: ${this.calculateContractDuration(contract.startDate, contract.endDate)}</p>
          <p>Le contrat prendra fin automatiquement à la date d'échéance sans nécessité de préavis.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONDITIONS DE RÉMUNÉRATION</div>
        <div class="salary-info">
          <div class="article-title">Article 3: Rémunération</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Salaire mensuel:</span> <strong>${contract.baseSalary ? contract.baseSalary.toLocaleString('fr-FR') + ' MAD' : 'N/A'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Heures/mois:</span> <strong>${contract.hoursPerMonth || '191'} heures</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">MOTIF DU CDD</div>
        <div class="article">
          <div class="article-title">Article 4: Motif de recours au CDD</div>
          <p>Le recours au contrat à durée déterminée est justifié par:</p>
          <ul>
            <li>Remplacement d'un salarié temporairement absent</li>
            <li>Accroissement temporaire de l'activité de l'entreprise</li>
            <li>Emploi à caractère saisonnier</li>
            <li>[Autre motif à spécifier]</li>
          </ul>
        </div>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>L'Employé:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>L'Employeur:</strong></p>
            <div class="signature-box"></div>
            <p>${company?.name || 'Société'}</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE - CONFORME AU CODE DU TRAVAIL MAROCAIN</p>
      </div>
    </body>
    </html>
    `;
  }

  private createStageContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CONVENTION DE STAGE - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; color: #000000; }
        .header { text-align: center; border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #000000; font-size: 26px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .section { margin: 30px 0; }
        .section-title { color: #000000; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #16a34a; padding-left: 10px; }
        .article { margin: 20px 0; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; }
        .article-title { font-weight: bold; color: #000000; margin-bottom: 8px; font-size: 14px; }
        .article p, .article ul, .article li { color: #000000; font-size: 12px; line-height: 1.4; }
        .article ul { margin: 8px 0; padding-left: 20px; }
        .article li { margin: 4px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #000000; font-size: 12px; }
        .info-item span, .info-item strong { color: #000000; font-size: 12px; }
        .signature { margin-top: 50px; }
        .signature-box { border: 2px solid #16a34a; padding: 20px; margin: 20px 0; height: 80px; }
        .signature p { color: #000000; font-size: 12px; }
        .footer { margin-top: 50px; text-align: center; color: #000000; font-size: 10px; }
        .badge { background: #16a34a; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .stage-info { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .stage-info p, .stage-info .info-label, .stage-info .info-item span, .stage-info .info-item strong { color: #000000; font-size: 12px; }
        h3 { color: #000000; font-size: 20px; margin: 10px 0; }
        h2 { color: #000000; font-size: 22px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONVENTION DE STAGE</div>
        <h3>${employee.firstName} ${employee.lastName}</h3>
        <p>Fait à ${company?.city || 'Casablanca'}, le ${currentDate}</p>
      </div>

      <div class="section">
        <div class="section-title">OBJET DU STAGE</div>
        <div class="article">
          <div class="article-title">Article 1: Finalités du stage</div>
          <p>La présente convention a pour objet de définir les conditions dans lesquelles ${company?.name || 'l\'entreprise'} accueille ${employee.firstName} ${employee.lastName} en stage de formation professionnelle.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DURÉE ET CONDITIONS</div>
        <div class="stage-info">
          <div class="article-title">Article 2: Durée du stage</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Date de début:</span> <strong>${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Date de fin:</span> <strong>${contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'N/A'}</strong>
            </div>
          </div>
          <p style="margin-top: 15px;">Durée totale: ${this.calculateContractDuration(contract.startDate, contract.endDate)}</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">OBLIGATIONS RÉCIPROQUES</div>
        <div class="article">
          <div class="article-title">Article 3: Obligations du stagiaire</div>
          <ul>
            <li>Assiduité et ponctualité</li>
            <li>Respect du règlement intérieur</li>
            <li>Confidentialité des informations professionnelles</li>
            <li>Rédaction d'un rapport de fin de stage</li>
          </ul>
        </div>

        <div class="article">
          <div class="article-title">Article 4: Obligations de l'entreprise</div>
          <ul>
            <li>Encadrement pédagogique par un tuteur</li>
            <li>Formation pratique adaptée</li>
            <li>Attestation de fin de stage</li>
            <li>Indemnité de stage: ${contract.baseSalary ? contract.baseSalary.toLocaleString('fr-FR') + ' MAD' : 'Non prévue'}</li>
          </ul>
        </div>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>Le Stagiaire:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>L'Entreprise:</strong></p>
            <div class="signature-box"></div>
            <p>${company?.name || 'Société'}</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>CONVENTION DE STAGE - CONFORME À LA LÉGISLATION MAROCAINE</p>
      </div>
    </body>
    </html>
    `;
  }

  private createInterimContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CONTRAT DE MISSION INTÉRIMAIRE - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; color: #000000; }
        .header { text-align: center; border-bottom: 3px solid #9333ea; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #000000; font-size: 26px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .section { margin: 30px 0; }
        .section-title { color: #000000; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #9333ea; padding-left: 10px; }
        .article { margin: 20px 0; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; }
        .article-title { font-weight: bold; color: #000000; margin-bottom: 8px; font-size: 14px; }
        .article p, .article ul, .article li { color: #000000; font-size: 12px; line-height: 1.4; }
        .article ul { margin: 8px 0; padding-left: 20px; }
        .article li { margin: 4px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #000000; font-size: 12px; }
        .info-item span, .info-item strong { color: #000000; font-size: 12px; }
        .signature { margin-top: 50px; }
        .signature-box { border: 2px solid #9333ea; padding: 20px; margin: 20px 0; height: 80px; }
        .signature p { color: #000000; font-size: 12px; }
        .footer { margin-top: 50px; text-align: center; color: #000000; font-size: 10px; }
        .badge { background: #9333ea; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        h3 { color: #000000; font-size: 20px; margin: 10px 0; }
        h2 { color: #000000; font-size: 22px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONTRAT DE MISSION INTÉRIMAIRE</div>
        <h3>${employee.firstName} ${employee.lastName}</h3>
        <p>Fait à ${company?.city || 'Casablanca'}, le ${currentDate}</p>
      </div>

      <div class="section">
        <div class="section-title">MISSION INTÉRIMAIRE</div>
        <div class="article">
          <div class="article-title">Article 1: Objet de la mission</div>
          <p>Le présent contrat de mission intérimaire a pour objet la mise à disposition de l'intérimaire ${employee.firstName} ${employee.lastName} auprès de l'entreprise utilisatrice pour accomplir les tâches suivantes:</p>
          <p>Mission: ${employee.role || 'Poste temporaire'}</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DURÉE DE LA MISSION</div>
        <div class="article">
          <div class="article-title">Article 2: Durée</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Début de mission:</span> <strong>${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Fin de mission:</span> <strong>${contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'N/A'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>L'Intérimaire:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>L'Agence d'intérim:</strong></p>
            <div class="signature-box"></div>
            <p>${company?.name || 'Agence'}</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>CONTRAT DE MISSION INTÉRIMAIRE - CONFORME À LA LÉGISLATION MAROCAINE</p>
      </div>
    </body>
    </html>
    `;
  }

  private createFreelanceContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CONTRAT DE PRESTATION DE SERVICE - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; color: #000000; }
        .header { text-align: center; border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #000000; font-size: 26px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .section { margin: 30px 0; }
        .section-title { color: #000000; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #ea580c; padding-left: 10px; }
        .article { margin: 20px 0; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; }
        .article-title { font-weight: bold; color: #000000; margin-bottom: 8px; font-size: 14px; }
        .article p, .article ul, .article li { color: #000000; font-size: 12px; line-height: 1.4; }
        .article ul { margin: 8px 0; padding-left: 20px; }
        .article li { margin: 4px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #000000; font-size: 12px; }
        .info-item span, .info-item strong { color: #000000; font-size: 12px; }
        .signature { margin-top: 50px; }
        .signature-box { border: 2px solid #ea580c; padding: 20px; margin: 20px 0; height: 80px; }
        .signature p { color: #000000; font-size: 12px; }
        .footer { margin-top: 50px; text-align: center; color: #000000; font-size: 10px; }
        .badge { background: #ea580c; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        h3 { color: #000000; font-size: 20px; margin: 10px 0; }
        h2 { color: #000000; font-size: 22px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONTRAT DE PRESTATION DE SERVICE</div>
        <h3>${employee.firstName} ${employee.lastName}</h3>
        <p>Fait à ${company?.city || 'Casablanca'}, le ${currentDate}</p>
      </div>

      <div class="section">
        <div class="section-title">PRESTATION DE SERVICE</div>
        <div class="article">
          <div class="article-title">Article 1: Objet</div>
          <p>Le présent contrat a pour objet la prestation de services par ${employee.firstName} ${employee.lastName} au profit de ${company?.name || 'l\'entreprise'}.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONDITIONS FINANCIÈRES</div>
        <div class="article">
          <div class="article-title">Article 2: Rémunération</div>
          <p>Rémunération: <strong>${contract.baseSalary ? contract.baseSalary.toLocaleString('fr-FR') + ' MAD' : 'N/A'}</strong></p>
          <p>Mode de paiement: Virement bancaire ou chèque</p>
        </div>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>Le Prestataire:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>Le Client:</strong></p>
            <div class="signature-box"></div>
            <p>${company?.name || 'Entreprise'}</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>CONTRAT DE PRESTATION DE SERVICE - CONFORME À LA LÉGISLATION MAROCAINE</p>
      </div>
    </body>
    </html>
    `;
  }

  private createStandardContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CONTRAT DE TRAVAIL - ${employee.firstName} ${employee.lastName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #000000; }
        .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
        .contract-title { color: #000000; font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        .section { margin: 30px 0; }
        .section-title { color: #000000; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin: 5px 0; }
        .info-label { font-weight: bold; color: #000000; font-size: 12px; }
        .info-item span, .info-item strong { color: #000000; font-size: 12px; }
        .signature { margin-top: 50px; }
        .signature-box { border: 1px solid #d1d5db; padding: 20px; margin: 20px 0; height: 80px; }
        .signature p { color: #000000; font-size: 12px; }
        .footer { margin-top: 50px; text-align: center; color: #000000; font-size: 10px; }
        .badge { background: #4f46e5; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
        .salary-info { background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #16a34a; }
        .salary-info p, .salary-info .info-label, .salary-info .info-item span, .salary-info .info-item strong { color: #000000; font-size: 12px; }
        h3 { color: #000000; font-size: 20px; margin: 10px 0; }
        h2 { color: #000000; font-size: 22px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">CONTRAT DE TRAVAIL</div>
        <h2>${employee.firstName} ${employee.lastName}</h2>
        <p>Date: ${currentDate}</p>
      </div>

      <div class="section">
        <div class="section-title">INFORMATIONS DE L'EMPLOYÉ</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Nom complet:</span> ${employee.firstName} ${employee.lastName}
          </div>
          <div class="info-item">
            <span class="info-label">Entreprise:</span> ${company?.name || 'N/A'}
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
            <span class="info-label">Date de début:</span> ${contract.startDate ? new Date(contract.startDate).toLocaleDateString('fr-FR') : 'N/A'}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">CONDITIONS SALARIALES</div>
        <div class="salary-info">
          <div class="info-item">
            <span class="info-label">Salaire de base:</span> <strong>${contract.baseSalary ? contract.baseSalary.toLocaleString('fr-FR') + ' MAD' : 'N/A'}</strong>
          </div>
        </div>
      </div>

      <div class="signature">
        <div class="section-title">SIGNATURES</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <p><strong>L'employé:</strong></p>
            <div class="signature-box"></div>
            <p>${employee.firstName} ${employee.lastName}</p>
            <p>Date: ${currentDate}</p>
          </div>
          <div>
            <p><strong>L'employeur:</strong></p>
            <div class="signature-box"></div>
            <p>${company?.name || 'Représentant légal'}</p>
            <p>Date: ${currentDate}</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Ce contrat de travail a été généré automatiquement le ${currentDate} via la plateforme HRMatrix.</p>
      </div>
    </body>
    </html>
    `;
  }

  private createProfessionalMoroccanContractHTML(contract: any): string {
    if (!contract) return '';

    const employee = this.employees.find(e => e.id === contract.employeeId);
    if (!employee) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const employeeCompany = this.companies.find(c => c.id === employee.companyId);

    switch (contract.contractType) {
      case 'CDI':
        return this.createProfessionalCDIContractHTML(employee, contract, employeeCompany, currentDate);
      case 'CDD':
        return this.createProfessionalCDDContractHTML(employee, contract, employeeCompany, currentDate);
      case 'STAGE':
        return this.createProfessionalStageContractHTML(employee, contract, employeeCompany, currentDate);
      case 'INTERIM':
        return this.createProfessionalInterimContractHTML(employee, contract, employeeCompany, currentDate);
      case 'FREELANCE':
        return this.createProfessionalFreelanceContractHTML(employee, contract, employeeCompany, currentDate);
      default:
        return this.createProfessionalStandardContractHTML(employee, contract, employeeCompany, currentDate);
    }
  }

  private createProfessionalCDIContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return this.renderProfessionalContract({
      title: 'Contrat de travail a duree indeterminee',
      accent: '#8a1538',
      employee,
      company,
      contract,
      currentDate,
      legalBasis: 'Modele structure selon le Code du travail marocain, notamment sur la periode d essai, le CDI, le preavis et les droits lies a la rupture.',
      badge: 'CDI',
      purpose: 'Le present contrat formalise une relation de travail a duree indeterminee entre l employeur et le salarie.',
      durationSummary: 'Le contrat prend effet a la date d entree en fonction et se poursuit sans terme precis.',
      clauses: [
        {
          title: 'Fonctions et rattachement',
          body: `Le salarie exercera les fonctions de ${this.resolveJobTitle(employee)} au sein de ${company?.name || 'la societe'}, sous l autorite de la hierarchie interne et dans le respect du reglement de travail.`
        },
        {
          title: 'Periode d essai',
          body: 'La periode d essai doit etre arretee selon la categorie professionnelle du salarie et mentionnee avant signature. Elle reste a completer ou a verifier par le service RH avant diffusion finale.'
        },
        {
          title: 'Remuneration',
          body: `Le salaire brut mensuel de base est fixe a ${this.formatMoney(contract.baseSalary)}. L organisation du travail de reference est de ${contract.hoursPerMonth || 191} heures par mois et ${contract.workingDaysPerMonth || 26} jours ouvres. ${contract.transportAllowance ? `Une indemnite de transport de ${this.formatMoney(contract.transportAllowance)} est prevue.` : 'Aucune indemnite de transport n est mentionnee dans la fiche contrat.'}`
        },
        {
          title: 'Obligations professionnelles',
          body: 'Le salarie s engage a executer ses missions avec diligence, a respecter les consignes de securite, l obligation de confidentialite ainsi que l ensemble des procedures internes applicables.'
        },
        {
          title: 'Rupture du contrat',
          body: 'La rupture du CDI intervient dans le respect des dispositions legales applicables, notamment en matiere de preavis, de motif de rupture et, le cas echeant, d indemnite de licenciement selon l anciennete et la situation du salarie.'
        }
      ],
      footerNote: 'Document de generation assistee. A relire et completer par le service RH ou le conseil juridique avant signature.'
    });
  }
  private createProfessionalCDDContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return this.renderProfessionalContract({
      title: 'Contrat de travail a duree determinee',
      accent: '#1f5eff',
      employee,
      company,
      contract,
      currentDate,
      legalBasis: 'Modele structure pour les cas de recours au CDD reconnus par le Code du travail marocain, sous reserve de qualification precise du motif.',
      badge: 'CDD',
      purpose: 'Le present contrat couvre une relation de travail a duree determinee et doit etre rattache a un motif temporaire justifie.',
      durationSummary: `Le contrat couvre la periode du ${this.formatDate(contract.startDate)} au ${this.formatDate(contract.endDate)} pour une duree totale de ${this.calculateContractDuration(contract.startDate, contract.endDate)}.`,
      clauses: [
        {
          title: 'Motif de recours',
          body: `Le recours au CDD doit etre justifie par un besoin temporaire tel qu un remplacement, un surcroit d activite ou un emploi saisonnier. Motif a formaliser dans le dossier: ${this.escapeHtml(contract.notes || 'a preciser avant signature')}.`
        },
        {
          title: 'Mission confiee',
          body: `${employee.firstName} ${employee.lastName} est recrute(e) sur le poste de ${this.resolveJobTitle(employee)} pour la duree limitee definie au present contrat.`
        },
        {
          title: 'Remuneration et organisation du temps',
          body: `Le salaire de reference est fixe a ${this.formatMoney(contract.baseSalary)} pour une organisation de ${contract.hoursPerMonth || 191} heures par mois.${contract.transportAllowance ? ` Une indemnite de transport de ${this.formatMoney(contract.transportAllowance)} est egalement prevue.` : ''}`
        },
        {
          title: 'Fin de contrat',
          body: 'Le CDD prend fin a l arrivee du terme ou a la realisation de son objet. Toute rupture anticipee doit etre appreciee avec prudence au regard du cadre legal applicable.'
        }
      ],
      footerNote: 'Le motif de recours au CDD doit etre documente et valide avant emission finale.'
    });
  }

  private createProfessionalStageContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return this.renderProfessionalContract({
      title: 'Convention de stage',
      accent: '#1f8f6b',
      employee,
      company,
      contract,
      currentDate,
      legalBasis: 'Modele de convention de stage a usage RH interne, a adapter selon l etablissement de formation et les exigences de l organisme d accueil.',
      badge: 'STAGE',
      purpose: 'La presente convention encadre un stage a finalite pedagogique ou de mise en situation professionnelle.',
      durationSummary: `Le stage est prevu du ${this.formatDate(contract.startDate)} au ${this.formatDate(contract.endDate)} pour une duree de ${this.calculateContractDuration(contract.startDate, contract.endDate)}.`,
      clauses: [
        {
          title: 'Objet pedagogique',
          body: `${employee.firstName} ${employee.lastName} est accueilli(e) dans l objectif de developper des competences pratiques sur des missions rattachees a ${this.resolveJobTitle(employee)}.`
        },
        {
          title: 'Encadrement et suivi',
          body: 'L entreprise s engage a assurer un accueil adapte, a designer un tuteur de stage et a fournir un environnement conforme aux exigences d apprentissage, de securite et de confidentialite.'
        },
        {
          title: 'Conditions pratiques',
          body: `${contract.baseSalary ? `Une gratification ou indemnite de stage de ${this.formatMoney(contract.baseSalary)} est prevue.` : 'Aucune gratification n est saisie dans la fiche contrat.'} Le rythme de presence de reference est fixe a ${contract.hoursPerMonth || 191} heures par mois.`
        },
        {
          title: 'Livrables et evaluation',
          body: `${employee.firstName} ${employee.lastName} execute les missions confiees, rend compte de son activite et remet, si necessaire, un rapport ou une synthese de fin de stage.${contract.notes ? ` Observations renseignees: ${this.escapeHtml(contract.notes)}.` : ''}`
        }
      ],
      footerNote: 'Convention a completer avec les references de l etablissement de formation, du tuteur et des objectifs de stage.'
    });
  }

  private createProfessionalInterimContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return this.renderProfessionalContract({
      title: 'Contrat de mission interimaire',
      accent: '#6a3df0',
      employee,
      company,
      contract,
      currentDate,
      legalBasis: 'Modele de mission temporaire a adapter selon l entreprise de travail temporaire, l entreprise utilisatrice et le cadre reglementaire applicable.',
      badge: 'INTERIM',
      purpose: 'Le present document encadre une mission temporaire limitee dans le temps pour repondre a un besoin ponctuel.',
      durationSummary: `La mission est prevue du ${this.formatDate(contract.startDate)} au ${this.formatDate(contract.endDate)}.`,
      clauses: [
        {
          title: 'Objet de mission',
          body: `${employee.firstName} ${employee.lastName} est affecte(e) a une mission temporaire sur le poste de ${this.resolveJobTitle(employee)}.`
        },
        {
          title: 'Execution de la mission',
          body: `La mission sera executee au sein de ${company?.name || 'la structure utilisatrice'} a ${company?.city || 'Casablanca'}, sous reserve des consignes professionnelles, des regles d hygiene et des contraintes du site.`
        },
        {
          title: 'Conditions economiques',
          body: `La remuneration de reference est fixee a ${this.formatMoney(contract.baseSalary)} pour une base de ${contract.hoursPerMonth || 191} heures par mois.`
        },
        {
          title: 'Point de vigilance',
          body: 'Ce modele doit etre complete avec les informations de l entreprise de travail temporaire, du motif de recours et des responsabilites respectives des parties avant signature.'
        }
      ],
      footerNote: 'Validation RH et juridique recommandee avant remise au collaborateur.'
    });
  }

  private createProfessionalFreelanceContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return this.renderProfessionalContract({
      title: 'Contrat de prestation de service',
      accent: '#c96b22',
      employee,
      company,
      contract,
      currentDate,
      legalBasis: 'Modele de prestation independante a articuler avec le cadre contractuel civil et commercial applicable au Maroc.',
      badge: 'FREELANCE',
      purpose: 'Le present document organise une prestation de service realisee de maniere independante au profit du client.',
      durationSummary: contract.endDate
        ? `La prestation est prevue du ${this.formatDate(contract.startDate)} au ${this.formatDate(contract.endDate)}.`
        : `La prestation demarre le ${this.formatDate(contract.startDate)} selon les modalites convenues entre les parties.`,
      clauses: [
        {
          title: 'Objet de la prestation',
          body: `${employee.firstName} ${employee.lastName} intervient en qualite de prestataire pour realiser des travaux ou livrables rattaches a ${this.resolveJobTitle(employee)}.${contract.notes ? ` Description renseignee: ${this.escapeHtml(contract.notes)}.` : ''}`
        },
        {
          title: 'Autonomie du prestataire',
          body: 'Le prestataire conserve son autonomie dans l organisation de ses moyens et ne s inscrit pas, en principe, dans un lien de subordination salariale.'
        },
        {
          title: 'Honoraires',
          body: `La contrepartie financiere est fixee a ${this.formatMoney(contract.baseSalary)} selon les jalons, livrables ou modalites de facturation retenus entre les parties.`
        },
        {
          title: 'Confidentialite et livrables',
          body: 'Le prestataire s engage a la confidentialite sur les informations du client. Les conditions de propriete intellectuelle et de cession des livrables doivent etre precisees avant signature si necessaire.'
        }
      ],
      footerNote: 'Ce modele de prestation ne doit pas etre utilise comme substitut a un contrat de travail sans verification du cadre reel de la relation.'
    });
  }

  private createProfessionalStandardContractHTML(employee: any, contract: any, company: any, currentDate: string): string {
    return this.renderProfessionalContract({
      title: 'Document contractuel',
      accent: '#334155',
      employee,
      company,
      contract,
      currentDate,
      legalBasis: 'Modele generique a personnaliser selon la nature exacte de la relation contractuelle.',
      badge: contract.contractType || 'CONTRAT',
      purpose: 'Le present document resume les principales conditions de la relation contractuelle entre les parties.',
      durationSummary: `Debut de la relation au ${this.formatDate(contract.startDate)}${contract.endDate ? ` avec un terme prevu au ${this.formatDate(contract.endDate)}` : ''}.`,
      clauses: [
        {
          title: 'Fonctions',
          body: `${employee.firstName} ${employee.lastName} intervient sur le poste de ${this.resolveJobTitle(employee)}.`
        },
        {
          title: 'Conditions economiques',
          body: `La remuneration ou contrepartie de reference est fixee a ${this.formatMoney(contract.baseSalary)}.`
        },
        {
          title: 'Observations',
          body: contract.notes ? this.escapeHtml(contract.notes) : 'Aucune observation complementaire n a ete renseignee.'
        }
      ],
      footerNote: 'Modele generique. Une revue RH est recommandee avant diffusion.'
    });
  }

  private createSimpleLongMoroccanContractHTML(contract: any): string {
    if (!contract) return '';

    const employee = this.employees.find(e => e.id === contract.employeeId);
    if (!employee) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const company = this.companies.find(c => c.id === employee.companyId);
    const title = this.getSimpleContractTitle(contract.contractType);
    const articles = this.buildLongContractArticles(employee, contract, company);

    const articlesHtml = articles.map((article, index) => `
      <div class="article-block">
        <div class="article-title">Article ${index + 1} : ${this.escapeHtml(article.title)}</div>
        <div class="article-body">${this.escapeHtml(article.body)}</div>
      </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>${this.escapeHtml(title)} - ${this.escapeHtml(employee.firstName + ' ' + employee.lastName)}</title>
      <style>
        body {
          margin: 0;
          padding: 18px;
          background: #ffffff;
          color: #111111;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          line-height: 1.28;
        }
        .page {
          max-width: 760px;
          margin: 0 auto;
        }
        .title-bar {
          background: #9ab7d7;
          color: #ffffff;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          padding: 8px 12px;
          margin-bottom: 16px;
        }
        .intro-title {
          font-size: 10.5px;
          font-weight: 700;
          margin: 12px 0 8px;
        }
        .intro-text {
          margin-bottom: 8px;
        }
        .summary {
          margin: 14px 0 12px;
          font-size: 10px;
          font-weight: 700;
        }
        .article-block {
          margin-bottom: 9px;
        }
        .article-title {
          font-size: 10.5px;
          font-weight: 700;
          margin-bottom: 3px;
        }
        .article-body {
          white-space: pre-wrap;
        }
        .signatures {
          margin-top: 18px;
        }
        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-top: 10px;
        }
        .signature-box {
          min-height: 70px;
          border-top: 1px solid #444444;
          padding-top: 6px;
        }
        .footer-note {
          margin-top: 16px;
          font-size: 9px;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="title-bar">${this.escapeHtml(title)}</div>

        <div class="intro-title">Entre les soussignes :</div>
        <div class="intro-text">
          D'une part, la societe ${this.escapeHtml(company?.legalName || company?.name || '[Societe]')},
          ayant son siege a ${this.escapeHtml(company?.address || '[Adresse complete]')},
          ${this.escapeHtml(company?.city || '[Ville]')}, ${this.escapeHtml(company?.country || 'Maroc')},
          representee par ${this.escapeHtml(company?.name || '[Representant legal]')},
          ci-apres designee l'employeur / le client.
        </div>
        <div class="intro-text">
          Et d'autre part, Madame / Monsieur ${this.escapeHtml(employee.firstName + ' ' + employee.lastName)},
          demeurant ${this.escapeHtml(employee.address || '[Adresse]')},
          ne(e) le ${this.escapeHtml(employee.birthDate ? new Date(employee.birthDate).toLocaleDateString('fr-FR') : '[Date de naissance]')}
          a ${this.escapeHtml(employee.city || '[Ville]')},
          titulaire du CIN ${this.escapeHtml(employee.cin || '[Numero CIN]')},
          ci-apres designe(e) le salarie / prestataire / stagiaire.
        </div>

        <div class="summary">Il a ete convenu et arrete ce qui suit :</div>

        ${articlesHtml}

        <div class="signatures">
          <div class="intro-title">Fait a ${this.escapeHtml(company?.city || 'Maroc')}, le ${this.escapeHtml(currentDate)}, en deux exemplaires originaux.</div>
          <div class="signatures-grid">
            <div class="signature-box">
              <strong>Signature du salarie / prestataire / stagiaire</strong>
            </div>
            <div class="signature-box">
              <strong>Signature de l'employeur / client</strong>
            </div>
          </div>
        </div>

        <div class="footer-note">
          Document genere via HRMatrix. Ce modele doit etre relu, adapte et valide avant signature definitive.
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private getSimpleContractTitle(contractType: string): string {
    const titles: Record<string, string> = {
      CDI: 'Contrat a duree indeterminee',
      CDD: 'Contrat a duree determinee',
      STAGE: 'Convention de stage',
      INTERIM: 'Contrat de mission interimaire',
      FREELANCE: 'Contrat de prestation de service'
    };

    return titles[contractType] || 'Contrat';
  }

  private buildLongContractArticles(employee: any, contract: any, company: any): Array<{ title: string; body: string }> {
    const specific = this.getSpecificContractArticles(employee, contract, company);
    const common = this.getCommonLongContractArticles(employee, contract, company);
    return [...specific, ...common].slice(0, 60);
  }

  private getSpecificContractArticles(employee: any, contract: any, company: any): Array<{ title: string; body: string }> {
    const commonStart = [
      {
        title: 'Objet et duree du contrat',
        body: `Le present contrat prend effet a compter du ${this.formatDate(contract.startDate)}. Il encadre les relations entre ${company?.name || 'la societe'} et ${employee.firstName} ${employee.lastName} selon la nature du contrat retenu.`
      },
      {
        title: 'Engagement et prise de poste',
        body: `${employee.firstName} ${employee.lastName} est engage(e) pour exercer les fonctions de ${this.resolveJobTitle(employee)} dans les conditions definies par le present document et les procedures internes applicables.`
      },
      {
        title: 'Lieu d exercice et horaires',
        body: `Le lieu principal d execution est fixe a ${company?.address || '[Adresse de travail]'} ${company?.city || ''}. Le rythme de travail de reference est de ${contract.hoursPerMonth || 191} heures par mois sur ${contract.workingDaysPerMonth || 26} jours ouvres, sauf adaptation autorisee par l employeur.`
      },
      {
        title: 'Remuneration de base',
        body: `La remuneration de base est fixee a ${this.formatMoney(contract.baseSalary)}. ${contract.transportAllowance ? `Une indemnite de transport de ${this.formatMoney(contract.transportAllowance)} peut etre servie selon les regles internes.` : 'Aucune indemnite de transport n est renseignee dans la fiche contrat.'}`
      },
      {
        title: 'Date d effet et formalites',
        body: `Le present contrat est etabli a partir des informations disponibles dans le systeme RH. Les parties s engagent a verifier les mentions d identite, de fonction, de lieu et de remuneration avant signature.`
      }
    ];

    const byType: Record<string, Array<{ title: string; body: string }>> = {
      CDI: [
        {
          title: 'Nature du CDI',
          body: 'Le contrat est conclu pour une duree indeterminee. Il se poursuit sans terme precis jusqu a sa rupture selon les conditions legales et conventionnelles applicables.'
        },
        {
          title: 'Periode d essai',
          body: 'La periode d essai applicable doit etre renseignee et verifiee avant signature selon la categorie professionnelle, l anciennete et les usages internes de l entreprise.'
        },
        {
          title: 'Rupture et preavis',
          body: 'En cas de rupture du CDI, les regles relatives au preavis, au motif de rupture, a la faute grave et aux indemnites eventuelles demeurent appreciees conformement au cadre legal applicable.'
        },
        {
          title: 'Stabilite de la relation',
          body: 'Le CDI constitue la forme normale et generale de la relation de travail salariale lorsque le besoin de l entreprise est durable.'
        },
        {
          title: 'Evolution de poste',
          body: 'Les missions du salarie peuvent evoluer en fonction des besoins de l organisation sous reserve du respect du cadre contractuel et des prerogatives de direction de l employeur.'
        },
        {
          title: 'Dispositions de continuite',
          body: 'Le contrat demeure en vigueur en cas de simple reorganisation interne, sauf modification substantielle soumise aux regles applicables.'
        },
        {
          title: 'Reference interne',
          body: 'Toute annexe, note de fonction, reglement interieur ou procedure RH validee par l entreprise peut completer le present contrat.'
        }
      ],
      CDD: [
        {
          title: 'Nature du CDD',
          body: 'Le contrat est conclu pour une duree determinee et doit etre rattache a un motif temporaire justifie, tel qu un remplacement, un surcroit d activite ou un besoin saisonnier.'
        },
        {
          title: 'Terme du contrat',
          body: `Le contrat prend fin en principe a son terme, fixe au ${this.formatDate(contract.endDate)}, sauf prolongation ou renouvellement autorise par avenant regulierement etabli.`
        },
        {
          title: 'Motif de recours',
          body: `Le motif de recours doit etre precise et documente. En l etat, les observations disponibles sont les suivantes: ${this.escapeHtml(contract.notes || 'motif a completer avant signature')}.`
        },
        {
          title: 'Fin anticipee',
          body: 'Toute rupture anticipee du CDD hors cas legal ou convention autorisee doit faire l objet d une analyse RH et juridique avant execution.'
        },
        {
          title: 'Remise des documents',
          body: 'A l expiration du contrat, l employeur remet les documents de fin de relation dans les formes et delais applicables.'
        },
        {
          title: 'Absence de reconduction automatique',
          body: 'L arrivee du terme n emporte pas reconduction automatique, sauf accord ecrit et conditions legales remplies.'
        },
        {
          title: 'Justification de temporalite',
          body: 'Le besoin couvert par le present contrat est presume temporaire et doit rester coherent avec la nature du recours retenu.'
        }
      ],
      STAGE: [
        {
          title: 'Objet pedagogique du stage',
          body: 'La presente convention a pour objet l accueil du stagiaire dans un cadre pedagogique ou de mise en situation professionnelle.'
        },
        {
          title: 'Encadrement',
          body: 'L entreprise designe un tuteur ou referent et organise un suivi adapte du stagiaire pendant toute la duree du stage.'
        },
        {
          title: 'Duree du stage',
          body: `Le stage se deroule du ${this.formatDate(contract.startDate)} au ${this.formatDate(contract.endDate)}. Toute prolongation doit etre formalisee avant le terme initialement prevu.`
        },
        {
          title: 'Gratification ou indemnite',
          body: `${contract.baseSalary ? `Une gratification ou indemnite de stage de ${this.formatMoney(contract.baseSalary)} peut etre versee.` : 'Aucune gratification n est renseignee dans la fiche stage.'}`
        },
        {
          title: 'Rapport ou evaluation',
          body: 'Le stagiaire peut etre tenu de remettre un rapport, un support de soutenance ou tout livrable pedagogique en fin de stage.'
        },
        {
          title: 'Regles internes',
          body: 'Le stagiaire respecte les horaires, les regles d acces, la confidentialite et les normes de securite applicables au site d accueil.'
        },
        {
          title: 'Attestation de fin',
          body: 'Une attestation ou un document de fin de stage peut etre etabli apres verification de la periode effectivement realisee.'
        }
      ],
      INTERIM: [
        {
          title: 'Objet de la mission interimaire',
          body: 'Le present contrat encadre une mission temporaire repondant a un besoin ponctuel de l entite utilisatrice.'
        },
        {
          title: 'Periode de mission',
          body: `La mission est prevue du ${this.formatDate(contract.startDate)} au ${this.formatDate(contract.endDate)} sous reserve d adaptation ou de prolongation formalisee.`
        },
        {
          title: 'Site de mission',
          body: `Le collaborateur execute sa mission principalement a ${company?.address || '[Site de mission]'} ${company?.city || ''}, selon les besoins du service demandeur.`
        },
        {
          title: 'Instructions operationnelles',
          body: 'Le travailleur interimaire execute les taches definies dans le cadre de la mission en respectant les consignes professionnelles et de securite.'
        },
        {
          title: 'Duree limitee',
          body: 'La mission conserve un caractere temporaire et ne vaut pas engagement permanent en dehors des cas de regularisation expresse.'
        },
        {
          title: 'Conditions economiques',
          body: `La remuneration de reference pour la mission est fixee a ${this.formatMoney(contract.baseSalary)}.`
        },
        {
          title: 'Coordination des parties',
          body: 'Les responsabilites respectives de l entreprise de travail temporaire, de l entreprise utilisatrice et du travailleur doivent etre precisees dans le dossier final.'
        }
      ],
      FREELANCE: [
        {
          title: 'Objet de la prestation',
          body: 'Le present contrat organise une prestation de service ou mission independante executee au profit du client.'
        },
        {
          title: 'Autonomie du prestataire',
          body: 'Le prestataire conserve l autonomie dans l organisation de ses moyens et de son temps, sous reserve des obligations de resultat, de delai ou de qualite convenues.'
        },
        {
          title: 'Livrables et resultat attendu',
          body: `${contract.notes ? `Les livrables ou missions declares sont les suivants: ${this.escapeHtml(contract.notes)}.` : 'Les livrables attendus doivent etre precises dans une annexe ou bon de commande avant signature.'}`
        },
        {
          title: 'Honoraires',
          body: `Les honoraires de reference sont fixes a ${this.formatMoney(contract.baseSalary)} selon les modalites de facturation, jalons ou livrables retenus.`
        },
        {
          title: 'Absence de lien de subordination',
          body: 'La relation contractuelle n a pas vocation a creer un lien de subordination salariale et doit rester compatible avec la nature independante de la prestation.'
        },
        {
          title: 'Propriete et confidentialite',
          body: 'Les parties definissent avant signature les conditions de confidentialite, de propriete intellectuelle et de remise des livrables.'
        },
        {
          title: 'Fin de mission',
          body: 'La mission prend fin a la reception des livrables ou au terme convenu, sous reserve des dispositions de resiliation prevues par les parties.'
        }
      ]
    };

    return [...commonStart, ...(byType[contract.contractType] || byType['CDI'])];
  }

  private getCommonLongContractArticles(employee: any, contract: any, company: any): Array<{ title: string; body: string }> {
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const companyName = company?.name || 'la societe';
    const role = this.resolveJobTitle(employee);

    return [
      { title: 'Qualification professionnelle', body: `${employeeName} exercera avec la qualification de ${role}, sous reserve des ajustements d organisation et des besoins de service regulierement decides.` },
      { title: 'Subordination et directives', body: `Le titulaire du contrat execute ses missions conformement aux directives, procedures et instructions regulierement communiquees par ${companyName}.` },
      { title: 'Horaire de travail', body: `Les horaires peuvent etre repartis selon les besoins du service dans le respect du cadre d organisation retenu par l entreprise.` },
      { title: 'Lieu de travail principal', body: `Le lieu principal d execution est fixe a ${company?.address || '[Adresse de travail]'} ${company?.city || ''}.` },
      { title: 'Mobilite interne', body: 'Une adaptation raisonnable du lieu, de l organisation ou des modalites d execution peut intervenir si les besoins de service le justifient et si le cadre applicable le permet.' },
      { title: 'Remuneration variable', body: 'Toute prime, commission, avantage ou element variable non expressement garanti par le present document est verse selon les regles et validations en vigueur dans l entreprise.' },
      { title: 'Mode de paiement', body: 'Le paiement de la remuneration ou des honoraires intervient selon les modalites administratives, bancaires ou comptables applicables a la structure.' },
      { title: 'Bulletin ou justificatif', body: 'Les documents justificatifs de paiement, lorsque requis, sont remis ou tenus a disposition selon les procedures internes.' },
      { title: 'Avantages en nature', body: 'Tout avantage en nature, outil de travail, acces ou dotation eventuelle demeure soumis aux regles internes d attribution et de restitution.' },
      { title: 'Temps de repos', body: 'Les repos hebdomadaires, pauses, jours feries et absences autorisees sont gerees conformement au cadre legal, au reglement interieur et aux contraintes d exploitation.' },
      { title: 'Conges', body: 'Les conges sont acquis, demandes, valides et pris selon les droits applicables et l organisation du service.' },
      { title: 'Absence et justification', body: 'Toute absence doit etre signalee sans delai et justifiee selon les procedures internes et les exigences documentaires applicables.' },
      { title: 'Maladie ou accident', body: 'En cas de maladie, accident ou incapacite, la personne concernee doit informer sans delai son interlocuteur RH ou operationnel et remettre les justificatifs requis.' },
      { title: 'Visite medicale', body: 'Toute visite ou formalite medicale requise par la legislation, l activite ou la politique interne doit etre accomplie selon les modalites fixees par l entreprise.' },
      { title: 'Confidentialite', body: `${employeeName} s engage a conserver strictement confidentielles les informations techniques, sociales, salariales, commerciales, financieres et organisationnelles obtenues dans le cadre de la relation.` },
      { title: 'Protection des donnees', body: 'Les donnees personnelles traitees dans le cadre de la relation sont gerees uniquement pour les besoins legitimes d administration, de conformite et de pilotage RH.' },
      { title: 'Materiel et outils', body: 'Les materiels, comptes, applications, acces, badges et documents remis doivent etre utilises exclusivement dans le cadre autorise et restitues a premiere demande legitime.' },
      { title: 'Securite et hygiene', body: 'Le titulaire du contrat respecte les consignes de securite, de surete, de prevention, de sante au travail et les regles d acces applicables sur les sites de l entreprise ou du client.' },
      { title: 'Reglement interieur', body: 'Le reglement interieur, les notes de service, chartes informatiques et politiques internes regulierement portees a connaissance completent le present contrat.' },
      { title: 'Discipline', body: 'Tout manquement aux obligations professionnelles peut donner lieu aux mesures de gestion ou disciplinaires autorisees par le cadre applicable.' },
      { title: 'Qualite du travail', body: 'Les missions doivent etre executees avec diligence, competence, bonne foi, professionnalisme et dans le respect des delais raisonnablement fixes.' },
      { title: 'Reporting', body: 'Un reporting d activite, une remontee d information ou une validation hierarchique peut etre exige selon la nature des missions et l organisation interne.' },
      { title: 'Objectifs et evaluation', body: 'Des objectifs quantitatifs ou qualitatifs peuvent etre fixes puis reevalues selon les besoins de service et les modalites internes d evaluation.' },
      { title: 'Formation', body: 'La participation a des actions de formation, d integration, de sensibilisation ou de mise a niveau peut etre requise lorsque l activite le justifie.' },
      { title: 'Delegation et polyvalence', body: 'Le titulaire du contrat peut etre amene a participer a des taches connexes compatibles avec sa qualification et l interet du service.' },
      { title: 'Communication professionnelle', body: 'Les echanges professionnels doivent respecter les regles de courtoisie, de neutralite, de confidentialite et l image de l entreprise.' },
      { title: 'Non concurrence interne', body: 'Toute situation de conflit d interets ou d activite parallele incompatible avec les obligations contractuelles doit etre declaree sans delai.' },
      { title: 'Documentation contractuelle', body: 'Les annexes, fiches de poste, consignes operationnelles, formulaires RH et avenants valides font partie de la documentation contractuelle utile.' },
      { title: 'Avenants', body: 'Toute modification substantielle portant notamment sur la fonction, la remuneration, la duree, le terme, le perimetre ou les obligations particulieres doit etre formalisee par avenant lorsque necessaire.' },
      { title: 'Domiciliation des notifications', body: 'Les notifications peuvent etre remises a la derniere adresse ou aux derniers contacts declares par le titulaire du contrat, sauf disposition contraire imposee.' },
      { title: 'Bonne foi contractuelle', body: 'Les parties s engagent a executer le present contrat de bonne foi et a cooperer utilement pour traiter les situations operationnelles ou administratives.' },
      { title: 'Force majeure', body: 'En cas de force majeure ou d evenement exterieur empechant temporairement l execution normale de la relation, les parties examinent les mesures appropriees dans le respect du cadre applicable.' },
      { title: 'Suspension eventuelle', body: 'La relation peut etre suspendue dans les cas legalement prevus ou admis par les procedures internes regulierement etablies.' },
      { title: 'Restitution de documents', body: 'A la fin de la relation, tous documents, supports, acces, equipements, archives, materiels et donnees remis doivent etre restitues selon la procedure applicable.' },
      { title: 'Propriete des travaux', body: 'Les travaux, productions, notes, analyses, documents et livrables etablis dans le cadre de la mission sont geres selon les regles internes ou les stipulations particulieres du dossier.' },
      { title: 'Usage des systemes d information', body: 'Les systemes, applications, messageries et espaces de stockage de l entreprise doivent etre utilises conformement aux regles de securite et a la charte informatique applicable.' },
      { title: 'Controle interne', body: 'L entreprise peut mettre en place les dispositifs de controle, verification, audit ou tracabilite necessaires a la securite, a la conformite et a la bonne execution du travail.' },
      { title: 'Conformite legale', body: 'Le present contrat s interprete et s execute dans le respect du droit applicable, des textes en vigueur et, le cas echeant, des dispositions conventionnelles pertinentes.' },
      { title: 'Langue de reference', body: 'Le contrat est etabli en langue francaise pour les besoins de gestion interne, sans prejudice de toute traduction ou adaptation requise pour signature ou archivage.' },
      { title: 'Archivage', body: 'Le present document et ses pieces annexes peuvent etre archives sur support papier ou numerique dans le respect des procedures internes de conservation.' },
      { title: 'Coordination RH', body: 'Le service RH demeure le point de coordination pour les questions administratives, la mise a jour des informations et les formalites contractuelles.' },
      { title: 'Coordination manageriale', body: 'Le responsable hierarchique ou referent operationnel suit l execution des missions, l organisation du travail et les retours d activite.' },
      { title: 'Frais professionnels', body: 'Le remboursement ou la prise en charge de frais professionnels eventuels obeit aux procedures, plafonds et justifications exiges par l entreprise.' },
      { title: 'Representation externe', body: 'Toute prise de parole, engagement, commande, signature ou communication au nom de l entreprise suppose une habilitation reguliere prealable.' },
      { title: 'Respect des tiers', body: 'Les relations avec les clients, partenaires, fournisseurs, visiteurs, candidats et autres salaries doivent respecter les standards de professionnalisme et de respect mutuel.' },
      { title: 'Ethique professionnelle', body: 'Le titulaire du contrat s engage a respecter l integrite, la loyauten, la confidentialite et les principes de conduite professionnelle applicables au sein de l organisation.' },
      { title: 'Interdiction d usage abusif', body: 'Tout usage abusif des ressources de l entreprise, toute appropriation non autorisee ou toute utilisation contraire aux interets legitimes de la structure est prohibe.' },
      { title: 'Traitement des incidents', body: 'Tout incident, erreur, acces non autorise, perte d information, difficulte operationnelle ou risque majeur doit etre remonte sans delai a l interlocuteur competent.' },
      { title: 'Priorite des dispositions imperatives', body: 'En cas de contradiction entre une clause du present document et une disposition imperative du droit applicable, cette derniere prevaut de plein droit.' },
      { title: 'Nullite partielle', body: 'La nullite ou l inapplicabilite d une clause n emporte pas, sauf impossibilite manifeste, nullite de l ensemble du contrat.' },
      { title: 'Reglement amiable', body: 'Les parties recherchent prioritairement une solution amiable a toute difficulte liee a l execution ou a l interpretation du present contrat.' },
      { title: 'Competence juridictionnelle', body: 'A defaut de resolution amiable, le differend relevera des autorites ou juridictions competentes determinees par le droit applicable et le lieu d execution principal.' },
      { title: 'Entree en vigueur definitive', body: 'Le present contrat entre en vigueur a la date de prise d effet sous reserve de sa signature, des validations requises et, le cas echeant, des formalites administratives prealables.' }
    ];
  }

  private renderProfessionalContract(config: any): string {
    const employee = config.employee;
    const company = config.company;
    const contract = config.contract;
    const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
    const companyName = company?.name || 'Societe';
    const contractReference = `${config.badge || 'CTR'}-${String(contract?.id || 'DRAFT').slice(0, 8).toUpperCase()}`;

    const clausesHtml = (config.clauses || []).map((clause: any, index: number) => `
      <section class="clause">
        <div class="clause-index">Article ${index + 1}</div>
        <h3>${this.escapeHtml(clause.title)}</h3>
        <p>${clause.body}</p>
      </section>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>${this.escapeHtml(config.title)} - ${this.escapeHtml(employeeName)}</title>
      <style>
        :root {
          --accent: ${config.accent};
          --ink: #14202b;
          --muted: #62707c;
          --line: #d6dde3;
          --soft: #f4f7f9;
          --paper: #fffdfa;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 34px;
          font-family: "Segoe UI", Arial, sans-serif;
          background: #eef2f4;
          color: var(--ink);
          line-height: 1.55;
        }
        .document {
          max-width: 920px;
          margin: 0 auto;
          background: var(--paper);
          border: 1px solid var(--line);
          box-shadow: 0 24px 64px rgba(20, 32, 43, 0.08);
        }
        .hero {
          padding: 30px 34px 26px;
          background: linear-gradient(135deg, #142331, #223647);
          color: #ffffff;
        }
        .hero-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }
        .hero-metric {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .hero-metric span {
          display: block;
          margin-bottom: 6px;
          color: rgba(255, 255, 255, 0.66);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .hero-metric strong {
          display: block;
          font-size: 13px;
          line-height: 1.45;
        }
        .hero-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .hero h1 {
          margin: 0 0 10px;
          font-size: 30px;
          line-height: 1.05;
          letter-spacing: -0.03em;
        }
        .hero p {
          margin: 0;
          color: rgba(255, 255, 255, 0.8);
        }
        .legal-note {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 12px;
        }
        .content {
          padding: 30px 34px 18px;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .card {
          padding: 16px 18px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: var(--soft);
        }
        .card span {
          display: block;
          margin-bottom: 8px;
          color: var(--muted);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .card strong {
          display: block;
          font-size: 16px;
          line-height: 1.45;
        }
        .card p {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .section-title {
          margin: 24px 0 14px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .parties {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .party {
          padding: 18px 20px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: #ffffff;
        }
        .party h3 {
          margin: 0 0 10px;
          font-size: 15px;
        }
        .party p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.75;
        }
        .clause {
          margin-bottom: 14px;
          padding: 18px 20px;
          border: 1px solid var(--line);
          border-left: 4px solid var(--accent);
          border-radius: 16px;
          background: #ffffff;
        }
        .clause-index {
          margin-bottom: 8px;
          color: var(--accent);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .clause h3 {
          margin: 0 0 10px;
          font-size: 17px;
        }
        .clause p {
          margin: 0;
          font-size: 14px;
        }
        .signature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-top: 24px;
        }
        .signature-box {
          min-height: 150px;
          padding: 18px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: #fcfcfb;
        }
        .signature-box span {
          display: block;
          margin-bottom: 40px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .signature-box strong {
          display: block;
          margin-bottom: 6px;
          font-size: 15px;
        }
        .signature-box p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }
        .closing-note {
          margin-top: 20px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px dashed var(--line);
          background: #fbfcfd;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.7;
        }
        .footer {
          padding: 0 34px 28px;
          color: var(--muted);
          font-size: 11px;
          text-align: center;
        }
        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }
          .document {
            box-shadow: none;
            border: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="document">
        <header class="hero">
          <div class="hero-top">
            <span class="badge">${this.escapeHtml(config.badge)}</span>
            <span class="badge">Royaume du Maroc</span>
          </div>
          <h1>${this.escapeHtml(config.title)}</h1>
          <p>${this.escapeHtml(config.purpose)}</p>
          <div class="legal-note">${this.escapeHtml(config.legalBasis)}</div>
          <div class="hero-meta">
            <div class="hero-metric">
              <span>Reference</span>
              <strong>${this.escapeHtml(contractReference)}</strong>
            </div>
            <div class="hero-metric">
              <span>Date d etablissement</span>
              <strong>${this.escapeHtml(config.currentDate)}</strong>
            </div>
            <div class="hero-metric">
              <span>Lieu de signature</span>
              <strong>${this.escapeHtml(company?.city || 'Maroc')}</strong>
            </div>
          </div>
        </header>

        <main class="content">
          <div class="cards">
            <div class="card">
              <span>Employeur</span>
              <strong>${this.escapeHtml(companyName)}</strong>
              <p>${this.escapeHtml(this.buildCompanyLine(company))}</p>
            </div>
            <div class="card">
              <span>Salarie / prestataire</span>
              <strong>${this.escapeHtml(employeeName)}</strong>
              <p>${this.escapeHtml(this.buildEmployeeLine(employee))}</p>
            </div>
            <div class="card">
              <span>Date d effet</span>
              <strong>${this.formatDate(contract.startDate)}</strong>
              <p>${this.escapeHtml(config.durationSummary)}</p>
            </div>
            <div class="card">
              <span>Conditions economiques</span>
              <strong>${this.formatMoney(contract.baseSalary)}</strong>
              <p>${contract.hoursPerMonth || 191} h/mois / ${contract.workingDaysPerMonth || 26} jours/mois</p>
            </div>
          </div>

          <div class="section-title">Parties contractantes</div>
          <div class="parties">
            <section class="party">
              <h3>L employeur / client</h3>
              <p>${this.escapeHtml(this.buildCompanyIdentity(company))}</p>
            </section>
            <section class="party">
              <h3>Le salarie / prestataire</h3>
              <p>${this.escapeHtml(this.buildEmployeeFullIdentity(employee))}</p>
            </section>
          </div>

          <div class="section-title">Clauses contractuelles</div>
          ${clausesHtml}

          <div class="section-title">Signatures</div>
          <div class="signature-grid">
            <div class="signature-box">
              <span>Le salarie / prestataire</span>
              <strong>${this.escapeHtml(employeeName)}</strong>
              <p>${this.escapeHtml(this.buildEmployeeIdentity(employee))}</p>
            </div>
            <div class="signature-box">
              <span>L employeur / le client</span>
              <strong>${this.escapeHtml(companyName)}</strong>
              <p>Represente par: ................................................</p>
            </div>
          </div>

          <div class="closing-note">
            Le present document constitue une base contractuelle professionnelle generee par le systeme.
            Les mentions variables comme la periode d essai, le motif de recours au CDD, le representant
            habilite, les annexes internes et les references d immatriculation doivent etre verifiees
            puis completees avant signature definitive.
          </div>
        </main>

        <footer class="footer">
          <p>Document genere le ${this.escapeHtml(config.currentDate)} via HRMatrix.</p>
          <p>${this.escapeHtml(config.footerNote)}</p>
        </footer>
      </div>
    </body>
    </html>
    `;
  }

  private resolveJobTitle(employee: any): string {
    return employee?.position?.name || employee?.role || employee?.jobTitle || 'Collaborateur';
  }

  private buildCompanyLine(company: any): string {
    const parts = [
      company?.legalName || company?.name,
      company?.address,
      company?.city,
      company?.country || 'Maroc'
    ].filter(Boolean);

    return parts.join(', ');
  }

  private buildEmployeeLine(employee: any): string {
    const parts = [
      this.resolveJobTitle(employee),
      employee?.cin ? `CIN ${employee.cin}` : '',
      employee?.city
    ].filter(Boolean);

    return parts.join(' / ');
  }

  private buildEmployeeIdentity(employee: any): string {
    const parts = [
      employee?.cin ? `CIN: ${employee.cin}` : 'CIN: a completer',
      employee?.email || '',
      employee?.phone || ''
    ].filter(Boolean);

    return parts.join(' / ');
  }

  private buildCompanyIdentity(company: any): string {
    const parts = [
      company?.legalName || company?.name || 'Societe a completer',
      company?.address || 'Adresse a completer',
      company?.city || '',
      company?.country || 'Maroc',
      company?.rcNumber ? `RC: ${company.rcNumber}` : '',
      company?.iceNumber ? `ICE: ${company.iceNumber}` : '',
      company?.taxIdentifier ? `IF: ${company.taxIdentifier}` : '',
      company?.cnssNumber ? `CNSS: ${company.cnssNumber}` : ''
    ].filter(Boolean);

    return parts.join(' / ');
  }

  private buildEmployeeFullIdentity(employee: any): string {
    const parts = [
      `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Identite a completer',
      this.resolveJobTitle(employee),
      employee?.cin ? `CIN: ${employee.cin}` : 'CIN: a completer',
      employee?.email || '',
      employee?.phone || '',
      employee?.city || ''
    ].filter(Boolean);

    return parts.join(' / ');
  }

  private formatDate(value: string): string {
    if (!value) return 'A completer';
    return new Date(value).toLocaleDateString('fr-FR');
  }

  private formatMoney(value: number): string {
    if (value === null || value === undefined) {
      return 'A completer';
    }

    return Number(value).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' MAD';
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private calculateContractDuration(startDate: string, endDate: string): string {
    if (!startDate || !endDate) return 'Non spécifiée';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    
    if (months > 0 && days > 0) {
      return `${months} mois et ${days} jours`;
    } else if (months > 0) {
      return `${months} mois`;
    } else {
      return `${days} jours`;
    }
  }
}