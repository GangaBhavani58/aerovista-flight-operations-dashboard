export type FlightStatus =
  | 'En route'
  | 'Delayed'
  | 'Boarding'
  | 'Arrived'
  | 'Scheduled';
export interface Airport {
  code: string;
  city: string;
  coords: [number, number];
}
export interface Flight {
  id: string;
  number: string;
  callsign: string;
  aircraft: string;
  origin: Airport;
  destination: Airport;
  status: FlightStatus;
  etd: string;
  eta: string;
  position: [number, number];
  heading: number;
  altitude: number;
  speed: number;
  progress: number;
}
