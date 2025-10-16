import { Component, ChangeDetectionStrategy, input, effect, viewChild, ElementRef, OnDestroy, inject, AfterViewInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { D3Service } from '../services/d3.service';

export interface DonutChartData {
  name: string;
  value: number;
}

export interface LineChartSeries {
    name: string;
    values: number[];
    color: string;
}

export interface LineChartThreshold {
    value: number;
    label: string;
    color: string;
}

export interface LineChartData {
    labels: string[]; // dates as strings
    series: LineChartSeries[];
    threshold?: LineChartThreshold; // Optional threshold line
}


@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if(data()) {
      <div #chartContainer class="w-full h-full"></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardChartsComponent implements AfterViewInit, OnDestroy {
  data = input<any | null>(null);
  type = input.required<'donut' | 'bar' | 'line'>();
  valueFormat = input<'value' | 'quantity'>('value');
  segmentClick = output<string>();
  
  chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  private d3Service = inject(D3Service);
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;

  constructor() {
    effect(() => {
        // By reading the inputs here, the effect will re-run whenever they change.
        this.type();
        this.data();
        this.valueFormat();
        this.scheduleDrawCharts();
    });
  }

  ngAfterViewInit(): void {
    // The initial draw is triggered by the effect when data arrives or by the ResizeObserver.
    // We only need to set up the observer for size changes.
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.d3Service.hideTooltip();
    if(this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private setupResizeObserver() {
    const container = this.chartContainer()?.nativeElement;
    if (container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleDrawCharts();
      });
      this.resizeObserver.observe(container);
    }
  }

  private scheduleDrawCharts() {
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(() => this.drawCharts());
  }

  private drawCharts() {
    const el = this.chartContainer()?.nativeElement;
    const chartData = this.data();
    if (el && el.isConnected && chartData) {
      const clickHandler = (name: string) => this.segmentClick.emit(name);
      switch(this.type()) {
        case 'donut':
            this.d3Service.createDonutChart(el, chartData as DonutChartData[], this.valueFormat(), clickHandler);
            break;
        case 'bar':
            this.d3Service.createBarChart(el, chartData as DonutChartData[], this.valueFormat(), clickHandler);
            break;
        case 'line':
            this.d3Service.createLineChart(el, chartData as LineChartData);
            break;
      }
    }
  }
}