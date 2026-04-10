import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../core/services/domain.services';
import {
  Company, CreateCompanyPayload, UpdateCompanyPayload,
  COMPANY_STATUS_OPTIONS, FormErrors, validateRequired
} from '../../core/models';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './companies.component.html',
  styleUrls: ['./companies.component.scss']
})
export class CompaniesComponent implements OnInit {
  items: Company[]    = [];
  filtered: Company[] = [];
  loading   = true;
  showModal = false;
  editing   = false;
  editingId = '';
  search    = '';
  errors: FormErrors = {};

  readonly statusOptions = COMPANY_STATUS_OPTIONS;

  form: CreateCompanyPayload = {
    name:          '',
    legalName:     '',
    taxIdentifier: '',
    rcNumber:      '',
    iceNumber:     '',
    cnssNumber:    '',
    email:         '',
    phone:         '',
    address:       '',
    city:          '',
    country:       'Maroc',
    timezone:      'Africa/Casablanca',
    currency:      'MAD',
    status:        'ACTIVE',
  };

  constructor(private service: CompanyService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => { this.items = data; this.filtered = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onSearch() {
    const q = this.search.toLowerCase();
    this.filtered = this.items.filter(i =>
      `${i.name} ${i.legalName ?? ''} ${i.email ?? ''} ${i.phone ?? ''} ${i.city ?? ''}`.toLowerCase().includes(q)
    );
  }

  openCreate() {
    this.form = {
      name: '', legalName: '', taxIdentifier: '', rcNumber: '',
      iceNumber: '', cnssNumber: '', email: '', phone: '',
      address: '', city: '', country: 'Maroc',
      timezone: 'Africa/Casablanca', currency: 'MAD', status: 'ACTIVE',
    };
    this.editing = false; this.editingId = ''; this.errors = {};
    this.showModal = true;
  }

  openEdit(item: Company) {
    this.form = {
      name:          item.name,
      legalName:     item.legalName     ?? '',
      taxIdentifier: item.taxIdentifier ?? '',
      rcNumber:      item.rcNumber      ?? '',
      iceNumber:     item.iceNumber     ?? '',
      cnssNumber:    item.cnssNumber    ?? '',
      email:         item.email         ?? '',
      phone:         item.phone         ?? '',
      address:       item.address       ?? '',
      city:          item.city          ?? '',
      country:       item.country       ?? 'Maroc',
      timezone:      item.timezone      ?? 'Africa/Casablanca',
      currency:      item.currency      ?? 'MAD',
      status:        item.status,
    };
    this.editing = true; this.editingId = item.id; this.errors = {};
    this.showModal = true;
  }

  save() {
    this.errors = validateRequired(this.form as any, ['name']);
    if (Object.keys(this.errors).length) return;

    const obs = this.editing
      ? this.service.update(this.editingId, this.form as UpdateCompanyPayload)
      : this.service.create(this.form);

    obs.subscribe({
      next: () => { this.showModal = false; this.load(); },
      error: (e) => { this.errors['api'] = e?.error?.error || 'Erreur serveur'; }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette entreprise ?')) return;
    this.service.delete(id).subscribe(() => this.load());
  }

  close()              { this.showModal = false; }
  hasError(f: string)  { return !!this.errors[f]; }
}