## AeroVista — Design Explanation

## 1. Overview

AeroVista is a responsive flight operations dashboard created for the Ramphal Tech Frontend Developer (Angular & UI/UX) assessment.

The design goal was to create a compact operations-control workspace where a user can understand the current flight network quickly, filter the network, inspect geographic information, and then drill into a selected flight without leaving the main dashboard.

The application uses mocked flight data because the assessment explicitly permits mock data and does not require a backend.

The implementation uses:

Angular 18.2

TypeScript

Angular Reactive Forms

Angular Router

RxJS

Leaflet

SCSS

## 2. UI/UX Design Decisions

Visual language

The dashboard uses a dark aviation/control-room inspired visual style. A dark navy interface provides a strong background for the map and operational information while reducing visual distraction.

Cyan is primarily used for interactive and selected states, while different status colors communicate operational conditions:

Green — En route
Amber — Delayed
Blue — Boarding
Violet — Arrived
Neutral tones — Scheduled / inactive states

Status is also displayed as text rather than relying only on color, improving clarity and accessibility.

Information hierarchy

The interface is organized into three major areas:

┌────────────────┬──────────────────────┬─────────────────┐
│ Flight         │                      │ Selected Flight │
│ Directory      │       Flight Map     │ Details         │
│                │                      │                 │
└────────────────┴──────────────────────┴─────────────────┘

The KPI cards and operational alerts appear above these areas so that important network-level information is visible immediately.

The left section supports quick filtering and flight selection. The map provides geographic context, while the right panel provides deeper information for the selected flight.

This structure allows users to move from a high-level overview to detailed information without leaving the main workspace.

Progressive disclosure

The flight directory intentionally shows only the information needed for quick scanning, such as flight number, callsign, status, route, and ETA.

Additional information such as altitude, speed, progress, route distance, and schedule details is shown after selecting a flight.

This keeps the main interface information-dense without making every flight row overly complex.

## 3. Information Architecture

The application is organized around the operational workflow rather than separate application pages.

Network overview

The KPI section provides:

Total flights
Active flights
Delayed flights
Arrived flights

These values are derived from the shared flight data stream.

Operational alerts

Delayed and boarding flights are surfaced in the alert area so that operational exceptions can be identified quickly.

Selecting an alert can take the user directly to the corresponding flight.

Flight directory

The directory provides:

Callsign search
Status filtering
Origin filtering
Destination filtering
Clear filters
Flight selection

The directory and map are driven by the same filtered flight state so that both views remain synchronized.

Flight map

The map provides the geographic view of the current flight network.

It displays:

Airports
Aircraft
Aircraft headings
Flight status
Tooltips
Selected routes
Selected flight details

The detail panel displays:

Flight number
Status
Callsign
Aircraft
Origin and destination
ETD and ETA
Progress
Altitude
Ground speed
Route distance
Remaining distance

This creates a clear progression from network overview to individual flight inspection.

## 4. Angular Architecture

The application uses a lightweight feature-oriented Angular structure:

src/app/
├── core/
│ ├── models/
│ │ └── flight.model.ts
│ └── services/
│ └── flight.service.ts
│
├── features/
│ └── dashboard/
│ ├── dashboard.component.ts
│ ├── dashboard.component.html
│ └── dashboard.component.scss
│
├── app.routes.ts
└── app.config.ts
Domain model

flight.model.ts contains the TypeScript contracts for the application's flight data.

The model defines:

FlightStatus
Airport
Flight

The FlightStatus union type restricts the application to known operational states and provides compile-time type safety.

Service layer

FlightService acts as the application's data and state layer.

It maintains:

flights$
selected$

using RxJS BehaviorSubject instances.

The service is provided at the root level so that the dashboard has a single shared source of flight state.

This prevents the flight list, map, KPI cards, and details panel from maintaining separate copies of the same data.

Routing

Angular Router is configured with the dashboard as the main application route.

The application uses standalone Angular components and provider-based application configuration.

## 5. RxJS and State Management

RxJS is used to keep the dashboard reactive and avoid unnecessary manual state synchronization.

The primary state flow is:

                 FlightService
                      │
             ┌────────┴────────┐
             │                 │
         flights$          selected$
             │                 │
             ▼                 ▼
       Flight stream      Selected flight
             │
             │
             ▼
       Dashboard Component
             ▲
             │
       Reactive Form
       valueChanges
             │
             ▼
       combineLatest()
             │
             ▼
       Filtered flights
             │
       ┌─────┼───────────┐
       ▼     ▼           ▼
      List   Map      KPI / UI

BehaviorSubject

BehaviorSubject is used because the dashboard requires an initial value as well as future updates.

flights$ represents the current flight network.

selected$ represents the currently selected flight.

combineLatest

combineLatest combines the flight stream with the Reactive Form's filter changes.

This means that when either the flight data or filter values change, the filtered result is recalculated.

debounceTime

debounceTime is applied to the search input so that filtering does not run for every individual keystroke immediately.

distinctUntilChanged

distinctUntilChanged helps avoid unnecessary recalculations when the filter state has not meaningfully changed.

map

map is used to derive:

Filtered flights
KPI values
Operational alerts
Other view-specific data
Async pipe

Observable-backed values are consumed using Angular's async pipe where appropriate, allowing Angular to manage the subscription lifecycle in the template.

The overall approach keeps the UI synchronized without manually updating every visual element whenever the underlying flight state changes.

## 6. Leaflet Map Integration

Leaflet is the main geographic visualization technology used in AeroVista.

The map is initialized after the dashboard view is rendered because the Leaflet container must exist in the DOM before the map can be created.

Map features

The implementation includes:

Dark CARTO basemap
Airport markers
Airport tooltips
Custom aircraft markers
Aircraft heading rotation
Flight status styling
Selected-flight highlighting
Selected route polyline
Map centering
Dynamic marker updates
Map status filtering
Custom aircraft markers

Instead of using Leaflet's default markers, aircraft are represented using custom divIcon elements.

The marker can therefore reflect:

Flight status
Selection state
Aircraft heading

The heading value is used to rotate the aircraft icon so that the marker visually represents the aircraft's current direction.

Flight selection

Selecting a flight from either the directory or the map updates the shared selected-flight state.

The selected state then causes:

Flight selection
↓
Selected aircraft highlighted
↓
Route displayed
↓
Map centered
↓
Details panel updated

This keeps the list, map, and detail panel connected through the same state source.

Route distance

The application calculates approximate route distance using the Haversine formula based on the origin and destination coordinates.

Remaining distance is derived from the route distance and current flight progress.

These calculations are intended for interface demonstration and are not intended for real-world aviation navigation.

Cleanup

Leaflet resources and simulation timers are cleaned up when the dashboard component is destroyed to avoid retaining unnecessary map objects or timers.

## 7. Responsive Design

The dashboard is designed for desktop, tablet, and mobile screen sizes.

Desktop

The desktop layout uses three primary columns:

Flight Directory | Flight Map | Flight Details

This provides simultaneous access to filtering, geographic information, and selected-flight details.

Tablet

At tablet widths, the map receives additional space while secondary information becomes more compact.

The goal is to preserve the geographic workflow without forcing every desktop panel to retain the same width.

Mobile

On smaller screens, the layout transitions into a vertical flow:

Flight Directory
↓
Flight Map
↓
Flight Details

This allows each section to use the available screen width while maintaining access to the same functionality.

Responsive behavior is implemented through SCSS media queries rather than creating separate mobile and desktop applications.

The map also becomes a full-width visual surface on smaller screens so that aircraft markers remain usable.

## 8. Accessibility

Accessibility was considered as part of the interface design.

Native controls

The application uses native HTML controls for:

Search inputs
Select filters
Buttons
Interactive actions

This provides standard browser keyboard interaction without requiring unnecessary custom control behavior.

Text-based status

Flight statuses are displayed as text alongside their visual styling.

For example:

● Delayed
● En route

This prevents status information from being communicated exclusively through color.

Accessible labeling

Interactive elements use descriptive labels and accessible names where appropriate.

The map container is also given an accessible label, while aircraft markers provide flight-related information through their labels/tooltips.

Visual hierarchy

Focus and selected states use clear visual changes so users can identify the active flight or filter.

The interface also maintains sufficient contrast between the dark background, primary text, secondary text, and interactive elements.

## 9. Design Trade-offs and Future Improvements

Mock data instead of a backend

The application uses local mock flight data maintained by FlightService.

This was chosen because the application requirements do not require a backend. It allows the implementation to focus on Angular architecture, RxJS, UI/UX, and Leaflet integration.

The service boundary also makes it straightforward to replace the mock source with a REST API or WebSocket stream later.

Frontend live simulation

The application includes a local simulation for en-route aircraft.

The simulation updates positions and progress every second and publishes the updated state through FlightService.

This demonstrates reactive updates without adding backend infrastructure that is outside the current scope.

Direct route visualization

The selected flight is represented using a direct route line between origin and destination.

A production implementation could instead use real aviation airway data or great-circle route visualization.

Component structure

The current dashboard is intentionally kept as a focused feature because the application has a single primary workflow.

The model and service layers are separated from the UI, while the dashboard coordinates the main interactions.

As the application grows, the dashboard could be decomposed into reusable standalone components such as:

KpiCardsComponent
FlightDirectoryComponent
FlightMapComponent
FlightDetailsComponent
AlertStripComponent

This would improve reuse if similar operational views were introduced elsewhere.

Future improvements

Potential production enhancements include:

REST/WebSocket integration for live flight data
Real-time aircraft tracking
Weather and airspace overlays
Flight history and timeline playback
Marker clustering for larger flight networks
Real aviation route/airway data
Authentication and role-based access
Persistent operator preferences
Automated unit and component tests
More granular reusable standalone components
A full accessibility audit
Conclusion

AeroVista was designed as a focused operational workspace where network status, filtering, geographic context, and flight-level information work together within a single responsive interface.

The implementation uses Angular's component and service architecture together with Reactive Forms and RxJS to maintain consistent application state. Leaflet provides the geographic visualization, while the responsive layout ensures that the same workflow remains usable across desktop, tablet, and mobile screens.
