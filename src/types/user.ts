import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  name?: string;
  phone?: string;
  role?: 'passenger' | 'driver' | 'admin';
  status?: 'pending' | 'approved' | 'rejected';
  currentLocation?: [number, number];
  lastLocationUpdate?: Timestamp;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
  userPhone?: string;
  origin: {
    place: string;
    address: string;
    coordinates: [number, number];
  };
  destination: {
    place: string;
    address: string;
    coordinates: [number, number];
  };
  status: 'pending' | 'accepted' | 'arrived' | 'inProgress' | 'completed' | 'cancelled';
  price: number;
  distance?: number;
  duration?: number;
  distanceToPickup?: number;
  durationToPickup?: number;
  category: {
    id: string;
    name: string;
    basePrice: number;
    pricePerKm: number;
    pricePerMinute: number;
    minPrice: number;
    dynamicPricing: {
      rainMultiplier: number;
      peakHoursMultiplier: number;
      peakHours: Array<{ start: string; end: string }>;
    };
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    vehicle: {
      model: string;
      plate: string;
      color: string;
    };
    currentLocation?: [number, number];
  };
  driverId?: string;
  createdAt: any; // Timestamp
  acceptedAt?: any; // Timestamp
  startedAt?: any; // Timestamp
  completedAt?: any; // Timestamp
  cancelledAt?: any; // Timestamp
  driverArrived?: boolean;
  arrivedAt?: any; // Timestamp
  lastStatus?: string;
  driverLocation?: [number, number];
  estimatedTime?: string;
  paymentMethod?: 'pix' | 'card' | 'cash';
  updatedAt?: any; // Timestamp
  availableDrivers?: string[];
} 