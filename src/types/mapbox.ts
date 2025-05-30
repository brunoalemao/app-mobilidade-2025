import { Feature, LineString } from 'geojson';

export interface RouteResponse extends Feature<LineString> {
  properties: {
    distance: number;
    duration: number;
  };
}

export interface Location {
  place: string;
  address: string;
  coordinates: [number, number];
}

export interface Driver {
  id: string;
  currentLocation: [number, number];
  lastOnline: Date;
  status: string;
} 