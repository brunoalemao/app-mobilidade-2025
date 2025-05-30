export interface VehicleCategory {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerKm: number;
  minDistance: number;
  minPrice: number;
  image: string;
  icon: string;
  dynamicPricing: {
    rainMultiplier: number;
    peakHoursMultiplier: number;
    peakHours: {
      start: string;
      end: string;
    }[];
  };
}

export const DEFAULT_CATEGORIES: VehicleCategory[] = [
  {
    id: 'economico',
    name: 'Econômico',
    description: 'Carro Básico',
    basePrice: 8,
    pricePerKm: 2,
    minDistance: 3,
    minPrice: 8,
    image: '/images/categories/basic.png',
    icon: 'car',
    dynamicPricing: {
      rainMultiplier: 1.2,
      peakHoursMultiplier: 1.5,
      peakHours: [
        { start: "07:00", end: "09:00" },
        { start: "17:00", end: "19:00" }
      ]
    }
  },
  {
    id: 'confort',
    name: 'Confort',
    description: 'Carro Sedan',
    basePrice: 10,
    pricePerKm: 3,
    minDistance: 3,
    minPrice: 10,
    image: '/images/categories/basic.png',
    icon: 'car-sport',
    dynamicPricing: {
      rainMultiplier: 1.2,
      peakHoursMultiplier: 1.5,
      peakHours: [
        { start: "07:00", end: "09:00" },
        { start: "17:00", end: "19:00" }
      ]
    }
  }
];