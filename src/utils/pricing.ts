import { VehicleCategory } from '../types/vehicle';

// Constantes para cálculo de preço
const BASE_FARE = 5.0;  // Taxa base
const PER_KM_RATE = 2.0;  // Taxa por km
const PER_MINUTE_RATE = 0.5;  // Taxa por minuto
const MINIMUM_FARE = 7.0;  // Preço mínimo

interface PricingFactors {
  isRaining: boolean;
  currentTime: Date;
  distance: number; // em metros
}

interface PeakHourPeriod {
  start: string;
  end: string;
}

export const calculatePrice = (
  distanceInMeters: number,
  pricePerKm: number,
  basePrice: number,
  minDistance: number = 3, // Distância mínima em km antes de começar a cobrar por km
  durationInSeconds: number = 0, // Duração em segundos
  pricePerMinute: number = 0 // Preço por minuto
): number => {
  // Converter distância de metros para quilômetros e arredondar para 1 casa decimal
  const distanceInKm = Math.round((distanceInMeters / 1000) * 10) / 10;
  
  // Calcular preço base pela distância
  let totalPrice = basePrice;
  
  // Se a distância for maior que a mínima, adiciona o preço por km extra
  if (distanceInKm > minDistance) {
    const extraKm = Math.ceil(distanceInKm - minDistance);
    const extraPrice = extraKm * pricePerKm;
    totalPrice += extraPrice;
  }

  // Adicionar preço pelo tempo (convertendo segundos para minutos)
  if (durationInSeconds > 0 && pricePerMinute > 0) {
    const durationInMinutes = Math.ceil(durationInSeconds / 60);
    const timePrice = durationInMinutes * pricePerMinute;
    totalPrice += timePrice;
  }

  return totalPrice;
};

export const calculateDynamicPrice = (
  category: VehicleCategory,
  { isRaining, currentTime, distance }: PricingFactors
): number => {
  let finalPrice = category.basePrice;

  // Adicionar preço por km
  const distanceInKm = distance / 1000;
  finalPrice += distanceInKm * category.pricePerKm;

  // Verificar se é horário de pico
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

  const isPeakHour = category.dynamicPricing.peakHours.some((period: PeakHourPeriod) => {
    const start = period.start;
    const end = period.end;
    
    // Converter horários para minutos para comparação
    const currentMinutesTotal = currentHour * 60 + currentMinutes;
    const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
    const endMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);
    
    return currentMinutesTotal >= startMinutes && currentMinutesTotal <= endMinutes;
  });

  // Aplicar multiplicador de horário de pico
  if (isPeakHour) {
    finalPrice *= category.dynamicPricing.peakHoursMultiplier;
  }

  // Aplicar multiplicador de chuva
  if (isRaining) {
    finalPrice *= category.dynamicPricing.rainMultiplier;
  }

  // Garantir preço mínimo
  finalPrice = Math.max(finalPrice, category.minPrice);

  // Arredondar para 2 casas decimais
  return Math.round(finalPrice * 100) / 100;
}; 