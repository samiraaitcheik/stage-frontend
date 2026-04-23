import { CommonModule } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
  helper?: string;
}

interface DonutSegment extends ChartDatum {
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-ui-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-chart.component.html',
  styleUrl: './ui-chart.component.scss',
})
export class UiChartComponent {
  private readonly dataSignal = signal<ChartDatum[]>([]);
  readonly chartData = this.dataSignal.asReadonly();

  @Input() type: 'donut' | 'bar' = 'donut';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() centerLabel = '';
  @Input() emptyLabel = 'Aucune donnee';

  @Input() set data(value: ChartDatum[] | null | undefined) {
    this.dataSignal.set((value ?? []).filter((item) => item.value > 0));
  }

  readonly total = computed(() =>
    this.dataSignal().reduce((sum, item) => sum + item.value, 0),
  );

  readonly max = computed(() =>
    this.dataSignal().reduce((largest, item) => Math.max(largest, item.value), 0),
  );

  readonly donutSegments = computed<DonutSegment[]>(() => {
    const data = this.chartData();
    const total = this.total();
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    if (!total) {
      return [];
    }

    return data.map((item) => {
      const size = (item.value / total) * circumference;
      const segment: DonutSegment = {
        ...item,
        dashArray: `${size} ${circumference - size}`,
        dashOffset: -offset,
      };
      offset += size;
      return segment;
    });
  });

  readonly barData = computed(() => {
    const max = this.max();
    return this.chartData().map((item) => ({
      ...item,
      width: max ? `${Math.max((item.value / max) * 100, 8)}%` : '0%',
    }));
  });

  readonly hasData = computed(() => this.total() > 0);
}
