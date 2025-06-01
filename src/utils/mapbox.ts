import mapboxgl from 'mapbox-gl';
import { RouteResponse } from '../types/mapbox';

// Configurar token do Mapbox (substitua pelo seu token)
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Coordenadas aproximadas de Catalão, GO
const CATALAO_COORDINATES = {
  longitude: -47.9466,
  latitude: -18.1661
};

// Bounding box para região de Catalão (aproximadamente 50km ao redor)
const CATALAO_BBOX = [
  -48.4466, // min longitude
  -18.6661, // min latitude
  -47.4466, // max longitude
  -17.6661  // max latitude
];

// Função para obter localização atual
export const getCurrentLocation = (): Promise<[number, number]> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.longitude, position.coords.latitude]);
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};

// Função para geocodificação reversa (coordenadas para endereço)
export const reverseGeocode = async (coordinates: [number, number]) => {
  try {
    const [lng, lat] = coordinates;
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&country=BR`
    );

    if (!response.ok) {
      throw new Error('Erro ao buscar endereço');
    }

    const data = await response.json();
    const firstResult = data.features[0];

    if (!firstResult) {
      throw new Error('Nenhum resultado encontrado');
    }

    return {
      placeName: firstResult.place_name,
      address: firstResult.place_name,
      coordinates: firstResult.center as [number, number]
    };
  } catch (error) {
    console.error('Erro na geocodificação reversa:', error);
    throw error;
  }
};

// Função para geocodificação de endereços
export const geocodeAddress = async (query: string) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${mapboxgl.accessToken}&country=BR&proximity=${CATALAO_COORDINATES.longitude},${CATALAO_COORDINATES.latitude}&bbox=${CATALAO_BBOX.join(',')}`
    );

    if (!response.ok) {
      throw new Error('Erro ao buscar endereço');
    }

    const data = await response.json();
    const firstResult = data.features[0];

    if (!firstResult) {
      throw new Error('Nenhum resultado encontrado');
    }

    return {
      placeName: firstResult.place_name,
      address: firstResult.place_name,
      coordinates: firstResult.center as [number, number]
    };
  } catch (error) {
    console.error('Erro na geocodificação:', error);
    throw error;
  }
};

// Função para criar o mapa
export const createMap = async (container: HTMLElement): Promise<mapboxgl.Map> => {
  try {
    // Tentar obter a localização atual
    const coordinates = await getCurrentLocation();
    
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: coordinates,
      zoom: 13,
      bounds: [
        [CATALAO_BBOX[0], CATALAO_BBOX[1]], // Sudoeste
        [CATALAO_BBOX[2], CATALAO_BBOX[3]]  // Nordeste
      ] as mapboxgl.LngLatBoundsLike
    });

    // Adicionar controle de geolocalização
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      })
    );

    // Restringir os limites do mapa para a região de Catalão
    map.setMaxBounds([
      [CATALAO_BBOX[0] - 0.5, CATALAO_BBOX[1] - 0.5], // Sudoeste
      [CATALAO_BBOX[2] + 0.5, CATALAO_BBOX[3] + 0.5]  // Nordeste
    ]);

    return map;
  } catch (error) {
    console.error('Erro ao obter localização, usando localização padrão:', error);
    // Fallback para Catalão se não conseguir obter a localização
    return new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [CATALAO_COORDINATES.longitude, CATALAO_COORDINATES.latitude],
      zoom: 13,
      bounds: [
        [CATALAO_BBOX[0], CATALAO_BBOX[1]], // Sudoeste
        [CATALAO_BBOX[2], CATALAO_BBOX[3]]  // Nordeste
      ] as mapboxgl.LngLatBoundsLike
    });
  }
};

// Função para criar rota entre dois pontos
export const createRoute = async (
  origin: [number, number],
  destination: [number, number]
): Promise<RouteResponse> => {
  try {
    // Verificar se temos todos os dados necessários
    if (!origin || !destination) {
      throw new Error('Origem ou destino não fornecidos');
    }

    // Fazer a requisição para a API de direções do Mapbox
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Erro ao obter rota');
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('Nenhuma rota encontrada');
    }

    const route = data.routes[0];

    // Retornar um GeoJSON Feature válido
    return {
      type: 'Feature',
      properties: {
        distance: route.distance,
        duration: route.duration
      },
      geometry: route.geometry
    };
  } catch (error) {
    console.error('Erro ao criar rota:', error);
    throw error;
  }
};

// Função para calcular distância entre dois pontos usando Mapbox Directions API
export const calculateDistance = async (
  start: [number, number],
  end: [number, number]
): Promise<{ distance: number; duration: number } | null> => {
  try {
    // Validar coordenadas
    if (!start || !end || start.length !== 2 || end.length !== 2 ||
        !isValidCoordinate(start[0], start[1]) || !isValidCoordinate(end[0], end[1])) {
      console.error('Coordenadas inválidas:', { start, end });
      return null;
    }

    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );

    if (!response.ok) {
      console.error('Erro na resposta do Mapbox:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error('Nenhuma rota encontrada para as coordenadas:', { start, end });
      return null;
    }

    const route = data.routes[0];
    return {
      distance: route.distance, // em metros
      duration: route.duration // em segundos
    };
  } catch (error) {
    console.error('Erro ao calcular distância:', error);
    return null;
  }
};

// Função auxiliar para validar coordenadas
function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    typeof lng === 'number' && 
    typeof lat === 'number' && 
    !isNaN(lng) && 
    !isNaN(lat) && 
    lng >= -180 && 
    lng <= 180 && 
    lat >= -90 && 
    lat <= 90
  );
} 