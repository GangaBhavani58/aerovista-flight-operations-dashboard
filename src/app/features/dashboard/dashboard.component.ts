import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  Subscription,
  timer,
} from 'rxjs';
import * as L from 'leaflet';
import { Flight, FlightStatus } from '../../core/models/flight.model';
import { FlightService } from '../../core/services/flight.service';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(FlightService);
  private readonly fb = inject(FormBuilder);
  private map?: L.Map;
  private layers = L.layerGroup();
  private subscriptions = new Subscription();
  private simulationTimer?: ReturnType<typeof setInterval>;
  visibleFlights: Flight[] = [];
  simulationActive = false;
  readonly now$ = timer(0, 1000).pipe(map(() => new Date()));
  readonly filter = this.fb.nonNullable.group({
    query: '',
    status: 'All',
    origin: 'All',
    destination: 'All',
    mapStatus: 'All',
  });
  readonly flights$ = combineLatest([
    this.service.flights$,
    this.filter.valueChanges.pipe(
      startWith(this.filter.getRawValue()),
      debounceTime(180),
      distinctUntilChanged(),
    ),
  ]).pipe(
    map(([flights, filter]) =>
      flights.filter((f) => {
        const mapMatch =
          filter.mapStatus === 'All' ||
          filter.mapStatus === f.status ||
          (filter.mapStatus === 'Ground' &&
            ['Boarding', 'Arrived', 'Scheduled'].includes(f.status));
        return (
          (!filter.query ||
            f.callsign.toLowerCase().includes(filter.query.toLowerCase())) &&
          (filter.status === 'All' || f.status === filter.status) &&
          (filter.origin === 'All' || f.origin.code === filter.origin) &&
          (filter.destination === 'All' ||
            f.destination.code === filter.destination) &&
          mapMatch
        );
      }),
    ),
  );
  readonly selected$ = this.service.selected$;
  readonly statuses: FlightStatus[] = [
    'En route',
    'Delayed',
    'Boarding',
    'Arrived',
    'Scheduled',
  ];
  readonly airports = [
    ...new Set(
      this.service.flights$.value.flatMap((f) => [
        f.origin.code,
        f.destination.code,
      ]),
    ),
  ].sort();
  readonly kpis = this.service.flights$.pipe(
    map((fs) => [
      { label: 'Total flights', value: fs.length, icon: '✦', tone: 'blue' },
      {
        label: 'Active now',
        value: fs.filter(
          (f) => f.status === 'En route' || f.status === 'Boarding',
        ).length,
        icon: '◉',
        tone: 'green',
      },
      {
        label: 'Delayed',
        value: fs.filter((f) => f.status === 'Delayed').length,
        icon: '!',
        tone: 'amber',
      },
      {
        label: 'Arrived',
        value: fs.filter((f) => f.status === 'Arrived').length,
        icon: '✓',
        tone: 'violet',
      },
    ]),
  );
  operatorStatus: 'On duty' | 'Away' = 'On duty';
  readonly alerts$ = this.service.flights$.pipe(
    map((fs) =>
      fs.filter((f) => f.status === 'Delayed' || f.status === 'Boarding'),
    ),
  );
  toggleOperatorStatus() {
    this.operatorStatus =
      this.operatorStatus === 'On duty' ? 'Away' : 'On duty';
  }
  routeStats(f: Flight) {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const [a, b] = f.origin.coords,
      [c, d] = f.destination.coords;
    const h =
      Math.sin(toRad(c - a) / 2) ** 2 +
      Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(toRad(d - b) / 2) ** 2;
    const distance = Math.round(
      6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)),
    );
    return {
      distance,
      remainingKm: Math.round(distance * (1 - f.progress / 100)),
    };
  }
  ngAfterViewInit() {
    this.map = L.map('flight-map', {
      zoomControl: false,
      attributionControl: false,
    }).setView([22.5, 79], 5);
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 },
    ).addTo(this.map);
    this.layers.addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.subscriptions.add(
      this.flights$.subscribe((fs) => {
        this.visibleFlights = fs;
        const selected = this.service.selected$.value;

        // Keep the selected flight synchronized with the filtered list.
        if (fs.length && !fs.some((f) => f.id === selected.id)) {
          this.service.select(fs[0]);
          return;
        }
        this.paint(fs);
      }),
    );
    this.subscriptions.add(
      this.selected$.subscribe((f) => {
        this.paint(this.visibleFlights);
        setTimeout(
          () =>
            this.map?.flyTo(f.position, Math.max(this.map?.getZoom() ?? 5, 6), {
              duration: 0.8,
            }),
          0,
        );
      }),
    );
  }
  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    this.map?.remove();
  }
  private paint(fs: Flight[]) {
    if (!this.map) return;
    this.layers.clearLayers();
    const selected = this.service.selected$.value;
    const airports = new Map(
      fs.flatMap((f) => [
        [f.origin.code, f.origin],
        [f.destination.code, f.destination],
      ]),
    );
    airports.forEach((airport) =>
      L.circleMarker(airport.coords, {
        radius: 5,
        color: '#7b9cbb',
        weight: 1,
        fillColor: '#102b46',
        fillOpacity: 1,
      })
        .bindTooltip(`<b>${airport.code}</b><br>${airport.city}`, {
          direction: 'top',
        })
        .addTo(this.layers),
    );
    fs.forEach((f) => {
      const color = this.color(f.status);
      if (f.id === selected.id)
        L.polyline([f.origin.coords, f.destination.coords], {
          color: '#58b9ff',
          weight: 3,
          opacity: 0.9,
          dashArray: '8 8',
        }).addTo(this.layers);
      const icon = L.divIcon({
        className: '',
        html: `<button class="plane-marker ${f.id === selected.id ? 'selected' : ''}" style="--marker:${color};transform:rotate(${f.heading}deg)" aria-label="${f.callsign}">✈</button>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker(f.position, { icon })
        .on('click', () => this.select(f))
        .bindTooltip(
          `<b>${f.number}</b> · ${f.callsign}<br>${f.origin.code} → ${f.destination.code}<br><em>${f.status}</em>`,
          { direction: 'top', offset: [0, -15] },
        )
        .addTo(this.layers);
    });
  }
  select(f: Flight) {
    this.service.select(f);
  }
  clear() {
    this.filter.reset({
      query: '',
      status: 'All',
      origin: 'All',
      destination: 'All',
      mapStatus: 'All',
    });
  }
  setMapStatus(status: string) {
    this.filter.controls.mapStatus.setValue(status);
  }
  exportFlights() {
    const headings = [
      'Flight number',
      'Callsign',
      'Aircraft',
      'Origin',
      'Destination',
      'Status',
      'ETD',
      'ETA',
      'Altitude (ft)',
      'Speed (kts)',
    ];
    const rows = this.visibleFlights.map((f) => [
      f.number,
      f.callsign,
      f.aircraft,
      `${f.origin.code} - ${f.origin.city}`,
      `${f.destination.code} - ${f.destination.city}`,
      f.status,
      f.etd,
      f.eta,
      f.altitude || 'On ground',
      f.speed || 'N/A',
    ]);
    const csv = [headings, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `aerovista-flight-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  toggleSimulation() {
    this.simulationActive = !this.simulationActive;
    if (!this.simulationActive && this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = undefined;
      return;
    }
    this.simulationTimer = setInterval(() => this.moveFlights(), 1000);
  }
  private moveFlights() {
    const updated = this.service.flights$.value.map((f) => {
      if (f.status !== 'En route' || f.progress >= 99) return f;
      const ratio = 0.008;
      const position: [number, number] = [
        f.position[0] + (f.destination.coords[0] - f.position[0]) * ratio,
        f.position[1] + (f.destination.coords[1] - f.position[1]) * ratio,
      ];
      return {
        ...f,
        position,
        progress: Math.min(99, Math.round((f.progress + 1) * 10) / 10),
      };
    });
    this.service.update(updated);
  }
  statusClass(s: string) {
    return s.toLowerCase().replace(' ', '-');
  }
  private color(s: FlightStatus) {
    return {
      'En route': '#4ade80',
      Delayed: '#fbbf24',
      Boarding: '#60a5fa',
      Arrived: '#a78bfa',
      Scheduled: '#94a3b8',
    }[s];
  }
}
