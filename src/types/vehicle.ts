export interface VehicleCategory {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerKm: number;
  minPrice: number;
  icon: string;
  dynamicPricing: {
    rainMultiplier: number;
    peakHoursMultiplier: number;
    peakHours: Array<{
      start: string; // formato "HH:mm"
      end: string; // formato "HH:mm"
    }>;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  color: string;
  year: number;
  categoryId: string;
  driverId: string;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: Date;
  updatedAt?: Date;
} 