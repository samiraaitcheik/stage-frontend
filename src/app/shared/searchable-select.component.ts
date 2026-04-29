// src/app/shared/searchable-select.component.ts
import { Component, Input, Output, EventEmitter, forwardRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="searchable-select" [class.disabled]="disabled" (click)="toggleDropdown($event)">
      <div class="selected-value" [class.placeholder]="!selectedLabel">
        {{ selectedLabel || placeholder }}
      </div>
      <i class="bi bi-chevron-down"></i>
      <div class="dropdown" *ngIf="isOpen" (click)="$event.stopPropagation()">
        <div class="search-box">
          <input type="text"
                 [(ngModel)]="searchTerm"
                 (input)="filterOptions()"
                 placeholder="Rechercher..."
                 (click)="$event.stopPropagation()"
                 autofocus />
        </div>
        <div class="options-list">
          <div *ngFor="let opt of filteredItems"
               class="option"
               [class.selected]="opt[valueField] === value"
               (click)="selectOption(opt)">
            {{ opt[displayField] }}
          </div>
          <div *ngIf="filteredItems.length === 0" class="no-options">
            Aucun résultat
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .searchable-select {
      position: relative;
      width: 100%;
      min-height: 38px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.42rem 0.72rem;
      cursor: pointer;
      font-size: 0.84rem;
    }
    .searchable-select.disabled {
      background: #f3f4f6;
      cursor: not-allowed;
      opacity: 0.7;
    }
    .selected-value {
      flex: 1;
      color: #1f2937;
    }
    .selected-value.placeholder {
      color: #9ca3af;
    }
    .dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
      z-index: 1050;
      max-height: 260px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .search-box {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .search-box input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.8rem;
      outline: none;
    }
    .options-list {
      max-height: 200px;
      overflow-y: auto;
    }
    .option {
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.1s;
      font-size: 0.84rem;
    }
    .option:hover {
      background: #f3f4f6;
    }
    .option.selected {
      background: #e0e7ff;
      font-weight: 500;
    }
    .no-options {
      padding: 12px;
      text-align: center;
      color: #6b7280;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() items: any[] = [];
  @Input() displayField = 'name';
  @Input() valueField = 'id';
  @Input() placeholder = '— Sélectionner —';
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<any>();

  value: any = null;
  selectedLabel = '';
  isOpen = false;
  searchTerm = '';
  filteredItems: any[] = [];

  private onChange: any = () => {};
  private onTouched: any = () => {};

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  constructor(private el: ElementRef) {}

  writeValue(value: any): void {
    this.value = value;
    this.updateSelectedLabel();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  toggleDropdown(event: MouseEvent) {
    if (this.disabled) return;
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchTerm = '';
      this.filterOptions();
      setTimeout(() => {
        const input = this.el.nativeElement.querySelector('.search-box input');
        if (input) input.focus();
      }, 50);
    }
  }

  filterOptions() {
    const term = this.searchTerm.toLowerCase();
    this.filteredItems = this.items.filter(item =>
      String(item[this.displayField]).toLowerCase().includes(term)
    );
  }

  selectOption(option: any) {
    this.value = option[this.valueField];
    this.updateSelectedLabel();
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.isOpen = false;
    this.searchTerm = '';
  }

  private updateSelectedLabel() {
    const selected = this.items.find(i => i[this.valueField] === this.value);
    this.selectedLabel = selected ? selected[this.displayField] : '';
  }
}