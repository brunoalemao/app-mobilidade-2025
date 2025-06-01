import { VehicleCategory } from '../types/vehicle';

// Constantes para cálculo de preço
const BASE_DISTANCE_KM = 3.0; // Distância base em km

interface PricingFactors {
  isRaining: boolean;
  currentTime: Date;
  distance: number; // em metros
  duration: number; // em minutos
}

interface PeakHourPeriod {
  start: string;
  end: string;
}

export const calculatePrice = (
  distanceInMeters: number,
  durationInMinutes: number,
  category: VehicleCategory
): number => {
  // Converter distância de metros para quilômetros
  const distanceInKm = distanceInMeters / 1000;
  
  // 1. Preço base (inclui até 3km)
  let totalPrice = Number(category.basePrice) || 0;
  
  // 2. Se a distância for maior que 3km, adicionar preço por km adicional
  if (distanceInKm > BASE_DISTANCE_KM) {
    const extraDistance = distanceInKm - BASE_DISTANCE_KM;
    totalPrice += extraDistance * (Number(category.pricePerKm) || 0);
  }
  
  // 3. Adicionar preço por minuto
  totalPrice += durationInMinutes * (Number(category.pricePerMinute) || 0);
  
  // Garantir preço mínimo
  totalPrice = Math.max(totalPrice, Number(category.minPrice) || 0);
  
  // Arredondar para 2 casas decimais
  return Math.round(totalPrice * 100) / 100;
};

export const calculateDynamicPrice = (
  category: VehicleCategory,
  { isRaining, currentTime, distance, duration }: PricingFactors
): number => {
  // Calcular preço base com a nova lógica
  let finalPrice = calculatePrice(distance, duration, category);

  // Verificar se é horário de pico
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

  const isPeakHour = category.dynamicPricing?.peakHours?.some((period: PeakHourPeriod) => {
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
    finalPrice *= Number(category.dynamicPricing?.peakHoursMultiplier) || 1;
  }

  // Aplicar multiplicador de chuva
  if (isRaining) {
    finalPrice *= Number(category.dynamicPricing?.rainMultiplier) || 1;
  }

  // Arredondar para 2 casas decimais
  return Math.round(finalPrice * 100) / 100;
}; 