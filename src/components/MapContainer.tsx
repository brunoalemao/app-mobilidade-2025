import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../styles/map-markers.css';
import { createRoute } from '../utils/mapbox';

interface MapContainerProps {
  className?: string;
  origin?: [number, number];
  destination?: [number, number];
  showRoute?: boolean;
  onlineDrivers?: Array<{
    id: string;
    currentLocation: [number, number];
    name?: string;
    vehicle?: {
      model?: string;
      plate?: string;
      color?: string;
    };
    rating?: number;
  }>;
}

const MapContainer = ({ 
  className = '', 
  origin,
  destination,
  showRoute = false,
  onlineDrivers = []
}: MapContainerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarkersRef = useRef<{[key: string]: mapboxgl.Marker}>({});
  const routeRef = useRef<string | null>(null); // Armazenar apenas o ID da camada

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not found in environment variables');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Usar coordenadas padrão para o centro do mapa se não houver origem
    const initialCoordinates: [number, number] = origin || [-43.9345, -19.9279];
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCoordinates,
      zoom: 13
    });
    
    // Adicionar controles de navegação ao mapa
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Map load event handler
    map.current.on('load', () => {
      console.log('Mapa carregado com sucesso');
      
      // Adicionar marcadores e rota quando o mapa carregar
      if (origin) {
        addOriginMarker(origin);
      }
      
      if (destination) {
        addDestinationMarker(destination);
      }
      
      if (showRoute && origin && destination) {
        drawRoute(origin, destination);
      }
      
      // Adicionar marcadores de motoristas online
      if (onlineDrivers.length > 0) {
        onlineDrivers.forEach(driver => {
          addDriverMarker(driver);
        });
      }
    });
    
    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Update markers and route when props change
  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;
    
    // Atualizar marcador de origem
    if (origin) {
      addOriginMarker(origin);
      
      // Centralizar mapa na origem se não houver destino
      if (!destination) {
        map.current.flyTo({
          center: origin,
          zoom: 14,
          essential: true
        });
      }
    }
    
    // Atualizar marcador de destino
    if (destination) {
      addDestinationMarker(destination);
    }
    
    // Atualizar rota
    if (showRoute && origin && destination) {
      drawRoute(origin, destination);
      
      // Ajustar visualização para mostrar toda a rota
      const bounds = new mapboxgl.LngLatBounds()
        .extend(origin)
        .extend(destination);
      
      map.current.fitBounds(bounds, {
        padding: 100,
        maxZoom: 15,
        duration: 1000
      });
    }
    
    // Atualizar marcadores de motoristas
    updateDriverMarkers(onlineDrivers);
    
  }, [origin, destination, showRoute, onlineDrivers]);
  
  // Função para adicionar marcador de origem
  const addOriginMarker = (coordinates: [number, number]) => {
    if (!map.current) return;
    
    // Criar elemento personalizado para o marcador de origem
    const originEl = document.createElement('div');
    originEl.className = 'origin-marker';
    originEl.innerHTML = `
      <div class="origin-marker-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z" />
        </svg>
      </div>
    `;
    
    // Adicionar marcador de origem ao mapa
    new mapboxgl.Marker(originEl)
      .setLngLat(coordinates)
      .addTo(map.current);
  };
  
  // Função para adicionar marcador de destino
  const addDestinationMarker = (coordinates: [number, number]) => {
    if (!map.current) return;
    
    // Criar elemento personalizado para o marcador de destino
    const destEl = document.createElement('div');
    destEl.className = 'destination-marker';
    destEl.innerHTML = `
      <div class="destination-marker-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z" />
        </svg>
      </div>
    `;
    
    // Adicionar marcador de destino ao mapa
    new mapboxgl.Marker(destEl)
      .setLngLat(coordinates)
      .addTo(map.current);
  };
  
  // Função para desenhar rota entre origem e destino
  const drawRoute = async (origin: [number, number], destination: [number, number]) => {
    if (!map.current) return;
    
    try {
      const routeData = await createRoute(origin, destination);
      
      // Verificar se já existe uma camada de rota e removê-la
      if (map.current.getSource('route')) {
        map.current.removeLayer('route-layer');
        map.current.removeSource('route');
      }
      
      // Adicionar a nova rota ao mapa
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeData.geometry
        }
      });
      
      map.current.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#4F46E5',
          'line-width': 6,
          'line-opacity': 0.8
        }
      });
      
      routeRef.current = 'route-layer'; // Armazenar o ID da camada
      
    } catch (error) {
      console.error('Erro ao desenhar rota:', error);
    }
  };
  
  // Função para adicionar marcador de motorista
  const addDriverMarker = (driver: { id: string; currentLocation: [number, number]; name?: string; }) => {
    if (!map.current) return;
    
    // Criar elemento personalizado para o marcador de motorista
    const driverEl = document.createElement('div');
    driverEl.className = 'driver-marker';
    driverEl.innerHTML = `
      <div class="driver-marker-pulse"></div>
      <div class="driver-marker-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
      </div>
    `;
    
    // Adicionar tooltip com informações do motorista
    if (driver.name) {
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false
      }).setHTML(`
        <div class="p-2">
          <p class="font-medium">${driver.name}</p>
        </div>
      `);
      
      // Adicionar marcador de motorista ao mapa
      const marker = new mapboxgl.Marker(driverEl)
        .setLngLat(driver.currentLocation)
        .setPopup(popup)
        .addTo(map.current);
      
      // Mostrar popup ao passar o mouse sobre o marcador
      driverEl.addEventListener('mouseenter', () => {
        if (map.current) {
          marker.getPopup().addTo(map.current);
        }
      });
      
      // Esconder popup ao retirar o mouse do marcador
      driverEl.addEventListener('mouseleave', () => {
        marker.getPopup().remove();
      });
      
      // Armazenar referência do marcador
      driverMarkersRef.current[driver.id] = marker;
    }
  };
  
  // Função para atualizar marcadores de motoristas
  const updateDriverMarkers = (drivers: Array<{ id: string; currentLocation: [number, number]; name?: string; }>) => {
    if (!map.current) return;
    
    // Remover marcadores que não estão mais na lista
    Object.keys(driverMarkersRef.current).forEach(driverId => {
      if (!drivers.find(d => d.id === driverId)) {
        driverMarkersRef.current[driverId].remove();
        delete driverMarkersRef.current[driverId];
      }
    });
    
    // Atualizar ou adicionar marcadores
    drivers.forEach(driver => {
      if (driverMarkersRef.current[driver.id]) {
        // Atualizar posição do marcador existente
        driverMarkersRef.current[driver.id].setLngLat(driver.currentLocation);
      } else {
        // Adicionar novo marcador
        addDriverMarker(driver);
      }
    });
  };

  return (
    <div className={`w-full h-full ${className}`} ref={mapContainer} />
  );
};

export default MapContainer;
