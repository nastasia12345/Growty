import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { AnalyticsService } from '../services/analytics';


@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    BaseChartDirective
  ],
  templateUrl: './analytics.html',
  styleUrls: ['./analytics.css']
})
export class AnalyticsComponent implements OnInit {
  summary = {
    totalCompleted: 0,
    totalOverdue: 0,
    totalCreated: 0
  };

  completionRate: number = 0;

  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { display: false }
    }
  };

  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  constructor(private analyticsService: AnalyticsService) { }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.analyticsService.getSummary().subscribe(data => {
      this.summary = data;
      this.completionRate = this.summary.totalCreated > 0
        ? Math.round((this.summary.totalCompleted / this.summary.totalCreated) * 100)
        : 0;
    });
  }

  refreshData() {
    this.loadData();
  }

  exportData() {
    this.analyticsService.exportCsv().subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'analytics.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    });
  }
}
