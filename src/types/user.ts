import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  name?: string;
  phone?: string;
  role?: 'passenger' | 'driver';
  status?: 'pending' | 'approved' | 'rejected';
  currentLocation?: [number, number];
  lastLocationUpdate?: Timestamp;
}

export interface Location {
  coordinates: [number, number];
  address: string;
  place?: string;
}

export interface Vehicle {
  model: string;
  plate: string;
  color: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  vehicle: Vehicle;
  currentLocation?: [number, number];
  lastLocationUpdate?: Timestamp;
}

export interface Ride {
  id: string;
  userId: string;
  userName: string;
  origin: Location;
  destination: Location;
  status: 'pending' | 'accepted' | 'inProgress' | 'completed' | 'cancelled';
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  distance: number;
  duration: number;
  price: number;
  driverId: string | null;
  driver: Driver | null;
  cancelledBy?: 'driver' | 'passenger';
  driverArrived?: boolean;
  finalLocation?: [number, number];
  distanceToPickup?: number;
  durationToPickup?: number;
} 