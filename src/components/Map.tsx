import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoute } from '../utils/mapbox';

// Add driver marker styles to the document head
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .driver-marker {
    width: 40px;
    height: 40px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .driver-marker-pulse {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(79, 70, 229, 0.2);
    animation: pulse 2s ease-out infinite;
    z-index: 0;
  }

  .driver-marker-icon {
    width: 32px !important;
    height: 32px !important;
    position: relative;
    z-index: 1;
    background: white;
    border-radius: 50%;
    padding: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  .driver-tooltip {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: white;
    padding: 8px 12px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    white-space: nowrap;
    z-index: 2;
  }

  .driver-marker:hover .driver-tooltip {
    display: block;
  }
`;
document.head.appendChild(styleSheet);

interface MapProps {
  className?: string;
  origin?: [number, number];
  destination?: [number, number];
  showRoute?: boolean;
  driverLocation?: [number, number];
  autoUpdate?: boolean;
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

const Map = ({ 
  className = '', 
  origin, 
  destination, 
  showRoute = false,
  driverLocation,
  autoUpdate = false,
  onlineDrivers = []
}: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const driverMarkersRef = useRef<{[key: string]: mapboxgl.Marker}>({});
  const routeRef = useRef<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      console.error('Token do Mapbox não encontrado nas variáveis de ambiente');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Usar coordenadas padrão apenas se não houver motoristas
    const defaultCoordinates: [number, number] = [-53.2, -10.3]; // Centro aproximado do Brasil
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: defaultCoordinates,
      zoom: 4 // Zoom mais afastado para mostrar mais área
    });

    // Aguardar o carregamento do mapa
    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      // Limpar todos os marcadores
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      
      Object.values(driverMarkersRef.current).forEach(marker => marker.remove());
      driverMarkersRef.current = {};

      // Remover o mapa
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Inicializar apenas uma vez

  // Atualizar marcadores e rota
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Limpar marcadores existentes
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Adicionar marcadores apenas se showRoute for true
    if (showRoute) {
      // Adicionar marcador de origem
      if (origin) {
        const originMarker = new mapboxgl.Marker({ color: '#4F46E5' })
          .setLngLat(origin)
          .addTo(map.current);
        markersRef.current.push(originMarker);
      }

      // Adicionar marcador de destino
      if (destination) {
        const destinationMarker = new mapboxgl.Marker({ color: '#7C3AED' })
          .setLngLat(destination)
          .addTo(map.current);
        markersRef.current.push(destinationMarker);
      }
    }

    // Centralizar mapa na origem ou em coordenadas padrão
    const centerCoordinates = origin || [-43.9345, -19.9279];
    map.current.easeTo({
      center: centerCoordinates,
      zoom: 13,
      duration: 1000
    });

    // Atualizar rota se necessário
    if (showRoute && origin && destination && map.current) {
      createRoute(origin, destination).then(route => {
        if (!map.current) return;

        // Remover rota anterior se existir
        if (routeRef.current && map.current.getLayer(routeRef.current)) {
          map.current.removeLayer(routeRef.current);
          map.current.removeSource(routeRef.current);
        }

        const routeId = `route-${Date.now()}`;
        routeRef.current = routeId;

        map.current.addSource(routeId, {
          type: 'geojson',
          data: route
        });

        map.current.addLayer({
          id: routeId,
          type: 'line',
          source: routeId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#4F46E5',
            'line-width': 4,
            'line-opacity': 0.75
          }
        });

        // Ajustar o zoom para mostrar a rota completa
        const coordinates = route.geometry.coordinates as [number, number][];
        const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
          return bounds.extend(coord as mapboxgl.LngLatLike);
        }, new mapboxgl.LngLatBounds(coordinates[0] as mapboxgl.LngLatLike, coordinates[0] as mapboxgl.LngLatLike));

        map.current.fitBounds(bounds, {
          padding: 50,
          duration: 1000
        });
      });
    }
  }, [origin, destination, showRoute, mapLoaded]);

  // Atualizar marcadores dos motoristas
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    console.log('🔄 Atualizando marcadores dos motoristas:', onlineDrivers.length);

    const currentMap = map.current;
    const currentDrivers = new Set(onlineDrivers.map(d => d.id));
    const updatedMarkers: {[key: string]: mapboxgl.Marker} = {};

    // Atualizar ou criar marcadores
    onlineDrivers.forEach(driver => {
      if (!driver.currentLocation || !Array.isArray(driver.currentLocation) || driver.currentLocation.length !== 2) {
        console.log('🚫 Motorista sem localização válida:', driver.id);
        return;
      }

      console.log('📍 Adicionando marcador para motorista:', {
        id: driver.id,
        location: driver.currentLocation,
        name: driver.name
      });

      // Criar elemento personalizado para o marcador
      const createMarkerElement = () => {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        
        // Adicionar elemento de pulso
        const pulse = document.createElement('div');
        pulse.className = 'driver-marker-pulse';
        el.appendChild(pulse);
        
        // Adicionar ícone do carro
        const icon = document.createElement('img');
        icon.src = '/car-icon.svg';
        icon.className = 'driver-marker-icon';
        icon.style.width = '32px';
        icon.style.height = '32px';
        icon.onerror = () => {
          console.error('❌ Erro ao carregar ícone do carro');
          icon.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjEuNSw5LjVMMjAuNSw1LjRjLTAuMi0wLjgtMC45LTEuNC0xLjgtMS40aC0xM2MtMC45LDAtMS42LDAuNi0xLjgsMS40TDIuNSw5LjVDMS45LDkuNywxLjUsMTAuMywxLjUsMTF2M2MwLDAuNiwwLjQsMSwxLDFoMC41YzAsMS4xLDAuOSwyLDIsMnMyLTAuOSwyLTJoMTBjMCwxLjEsMC45LDIsMiwyczItMC45LDItMmgwLjVjMC42LDAsMS0wLjQsMS0xdi0zQzIyLjUsMTAuMywyMi4xLDkuNywyMS41LDkuNXogTTcsMTRjLTAuNiwwLTEtMC40LTEtMXMwLjQtMSwxLTFzMSwwLjQsMSwxUzcuNiwxNCw3LDE0eiBNMTcsMTRjLTAuNiwwLTEtMC40LTEtMXMwLjQtMSwxLTFzMSwwLjQsMSwxUzE3LjYsMTQsMTcsMTR6IE00LDEwbDEtNGgxNGwxLDRINHoiIGZpbGw9IiM0RjQ2RTUiLz48L3N2Zz4=';
        };
        el.appendChild(icon);

        // Adicionar tooltip com informações do motorista
        const tooltip = document.createElement('div');
        tooltip.className = 'driver-tooltip';
        tooltip.innerHTML = `
          <div class="font-medium">${driver.name || 'Motorista'}</div>
          ${driver.vehicle ? `
            <div class="text-gray-500 text-xs">
              ${driver.vehicle.model} • ${driver.vehicle.plate}
            </div>
          ` : ''}
          ${driver.rating ? `
            <div class="flex items-center text-yellow-400 text-xs mt-1">
              ${'★'.repeat(Math.round(driver.rating))}
              <span class="text-gray-500 ml-1">${driver.rating.toFixed(1)}</span>
            </div>
          ` : ''}
        `;
        el.appendChild(tooltip);

        return el;
      };

      if (driverMarkersRef.current[driver.id]) {
        // Atualizar posição do marcador existente
        driverMarkersRef.current[driver.id].setLngLat(driver.currentLocation);
        updatedMarkers[driver.id] = driverMarkersRef.current[driver.id];
      } else {
        // Criar novo marcador
        const marker = new mapboxgl.Marker(createMarkerElement())
          .setLngLat(driver.currentLocation)
          .addTo(currentMap);

        updatedMarkers[driver.id] = marker;
      }
    });

    // Remover marcadores de motoristas que não estão mais online
    Object.entries(driverMarkersRef.current).forEach(([id, marker]) => {
      if (!currentDrivers.has(id)) {
        marker.remove();
      }
    });

    driverMarkersRef.current = updatedMarkers;

    // Ajustar o mapa para mostrar todos os motoristas
    if (onlineDrivers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      onlineDrivers.forEach(driver => {
        if (driver.currentLocation) {
          bounds.extend(driver.currentLocation);
        }
      });

      // Adicionar padding para não cortar os marcadores
      currentMap.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
        duration: 1000
      });
    }
  }, [onlineDrivers, mapLoaded]);

  // Atualizar localização do motorista
  useEffect(() => {
    if (!map.current || !mapLoaded || !driverLocation || !autoUpdate) return;

    map.current.easeTo({
      center: driverLocation,
      duration: 1000
    });
  }, [driverLocation, autoUpdate, mapLoaded]);

  return <div ref={mapContainer} className={className} />;
};

export default Map;