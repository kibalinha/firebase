import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { DonutChartData, LineChartData } from '../components/dashboard-charts.component';

@Injectable({ providedIn: 'root' })
export class D3Service {

  private getTooltip(): d3.Selection<HTMLDivElement, unknown, HTMLElement, any> {
    const tooltipId = 'd3-global-tooltip';
    let tooltip = d3.select(`body > div#${tooltipId}`);
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('id', tooltipId)
        .attr('class', 'd3-tooltip')
        .style('position', 'absolute')
        .style('z-index', '50')
        .style('visibility', 'hidden')
        .style('pointer-events', 'none');
    }
    return tooltip;
  }

  hideTooltip(): void {
    this.getTooltip().style('visibility', 'hidden');
  }

  createDonutChart(element: HTMLElement, data: DonutChartData[], valueFormat: 'value' | 'quantity' = 'value', onClick?: (name: string) => void) {
    d3.select(element).select('svg').remove();

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(element).append('svg')
      .attr('class', 'd3-chart')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const pie = d3.pie<DonutChartData>().value(d => d.value).sort(null);
    const arc = d3.arc<any>().innerRadius(radius * 0.5).outerRadius(radius * 0.8);
    
    const formatValue = (value: number) => {
      if (valueFormat === 'value') {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }
      return `${value.toLocaleString('pt-BR')} un.`;
    };

    const tooltip = this.getTooltip();

    const arcs = svg.selectAll('.arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .style('cursor', onClick ? 'pointer' : 'default')
      .on('mouseover', (event, d) => {
        const total = d3.sum(data, item => item.value);
        const percentage = total > 0 ? (d.data.value / total) * 100 : 0;
        tooltip.html(`<strong>${d.data.name}</strong><br/>${formatValue(d.data.value)} (${percentage.toFixed(1)}%)`)
               .style('visibility', 'visible');
      })
      .on('mousemove', (event) => tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px'))
      .on('mouseout', () => tooltip.style('visibility', 'hidden'))
      .on('click', (event, d) => {
          if (onClick) {
              onClick(d.data.name);
          }
      });
  }

  createBarChart(element: HTMLElement, data: DonutChartData[], valueFormat: 'value' | 'quantity' = 'value', onClick?: (name: string) => void) {
    d3.select(element).select('svg').remove();

    const margin = { top: 20, right: 20, bottom: 90, left: 60 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;

    const svg = d3.select(element).append('svg')
        .attr('class', 'd3-chart')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.name))
      .padding(0.2);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end');

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([height, 0]);
    svg.append('g')
      .call(d3.axisLeft(y));
      
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(data.map(d => d.name));
    
    const formatValue = (value: number) => {
      if (valueFormat === 'value') {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }
      return `${value.toLocaleString('pt-BR')} un.`;
    };

    const tooltip = this.getTooltip();

    svg.selectAll('rect.bar')
      .data(data)
      .join('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.name)!)
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.value))
        .attr('fill', d => color(d.name))
        .style('cursor', onClick ? 'pointer' : 'default')
        .on('mouseover', (event, d) => {
            tooltip.html(`<strong>${d.name}</strong><br/>${formatValue(d.value)}`)
                   .style('visibility', 'visible');
        })
        .on('mousemove', (event) => tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px'))
        .on('mouseout', () => tooltip.style('visibility', 'hidden'))
        .on('click', (event, d) => {
            if (onClick) {
                onClick(d.name);
            }
        });
  }

  createLineChart(element: HTMLElement, data: LineChartData) {
    d3.select(element).select('svg').remove();

    const margin = {top: 40, right: 30, bottom: 40, left: 50};
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const svg = d3.select(element)
      .append("svg")
        .attr("class", "d3-chart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(data.labels, d => new Date(d)) as [Date, Date])
      .range([ 0, width ]);
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%d/%m") as any));

    const yMax = d3.max(data.series, s => d3.max(s.values)) || 0;
    const domainMax = Math.max(yMax, data.threshold?.value || 0);
    const y = d3.scaleLinear()
      .domain([0, domainMax === 0 ? 10 : domainMax * 1.1]) // add padding & handle zero max
      .range([ height, 0 ]);
    svg.append("g")
      .call(d3.axisLeft(y));

    // Add threshold line if it exists
    if (data.threshold && data.threshold.value > 0) {
        svg.append("line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", y(data.threshold.value))
            .attr("y2", y(data.threshold.value))
            .attr("stroke", data.threshold.color)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");

        svg.append("text")
            .attr("x", width)
            .attr("y", y(data.threshold.value) - 5)
            .attr("text-anchor", "end")
            .attr("fill", data.threshold.color)
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .text(data.threshold.label);
    }

    // Legend
    const legend = svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "start")
        .selectAll("g")
        .data(data.series)
        .join("g")
        .attr("transform", (d, i) => `translate(${i * 120}, -20)`);

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => d.color);

    legend.append("text")
        .attr("x", 16)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .text(d => d.name);

    // Lines and Points
    data.series.forEach(series => {
      const lineData = data.labels.map((label, i) => ({date: new Date(label), value: series.values[i]}));
      
      // Sanitize series name to create a valid CSS class selector
      const seriesClassName = series.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

      svg.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", series.color)
        .attr("stroke-width", 2)
        .attr("d", d3.line<{date: Date, value: number}>()
          .x(d => x(d.date))
          .y(d => y(d.value))
        );

      svg.selectAll(`circle.${seriesClassName}`)
        .data(lineData)
        .enter()
        .append("circle")
        .attr("class", seriesClassName)
        .attr("fill", series.color)
        .attr("r", 3)
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.value));
    });

    // Tooltip elements
    const tooltip = this.getTooltip();

    const focusLine = svg.append('line')
        .style('stroke', '#94a3b8') // slate-400
        .style('stroke-width', 1)
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0);
        
    const bisectDate = d3.bisector((d: string) => new Date(d)).left;

    svg.append('rect')
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .attr('width', width)
        .attr('height', height)
        .on('mouseover', () => {
            tooltip.style('visibility', 'visible');
            focusLine.style('opacity', 1);
        })
        .on('mouseout', () => {
            tooltip.style('visibility', 'hidden');
            focusLine.style('opacity', 0);
        })
        .on('mousemove', (event) => {
            const x0 = x.invert(d3.pointer(event)[0]);
            const i = bisectDate(data.labels, x0, 1);
            const d0 = data.labels[i - 1];
            const d1 = data.labels[i];
            const selectedDateStr = (d1 && (x0.getTime() - new Date(d0).getTime() > new Date(d1).getTime() - x0.getTime())) ? d1 : d0;
            const selectedIndex = data.labels.indexOf(selectedDateStr);
            const selectedDate = new Date(selectedDateStr);

            if (selectedIndex === -1) return;

            focusLine
                .attr('x1', x(selectedDate))
                .attr('y1', 0)
                .attr('x2', x(selectedDate))
                .attr('y2', height);

            const tooltipContent = `
                <strong>${selectedDate.toLocaleDateString('pt-BR')}</strong><br/>
                ${data.series.map(s => `
                    <span style="color:${s.color};">●</span> ${s.name}: ${s.values[selectedIndex]}
                `).join('<br/>')}
            `;

            tooltip.html(tooltipContent)
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        });
  }
}