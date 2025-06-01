import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../styles/map-markers.css';
import { createRoute } from '../utils/mapbox';

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
  const driverMarkersRef = useRef<{[key: string]: mapboxgl.Marker}>({});
  const routeRef = useRef<mapboxgl.Layer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      console.error('❌ Token do Mapbox não encontrado nas variáveis de ambiente');
      return;
    }

    console.log('✅ Token do Mapbox configurado com sucesso');
    mapboxgl.accessToken = mapboxToken;

    // Usar coordenadas padrão para o centro do mapa se não houver origem
    const initialCoordinates: [number, number] = origin || [-43.9345, -19.9279];
    
    console.log('🗺️ Inicializando mapa nas coordenadas:', initialCoordinates);
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCoordinates,
      zoom: 13,
      maxZoom: 18
    });
    
    // Adicionar controles de navegação ao mapa
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Map load event handler
    map.current.on('load', () => {
      console.log('✅ Mapa carregado com sucesso');
      
      // Forçar uma revalidação do tamanho do mapa
      map.current?.resize();
      
      if (onlineDrivers.length > 0) {
        console.log('🚗 Atualizando marcadores após carregamento do mapa');
        updateDriverMarkers();
      }
    });

    // Adicionar listener para erros do mapa
    map.current.on('error', (e) => {
      console.error('❌ Erro no mapa:', e);
    });

    return () => {
      // Cleanup
      Object.values(driverMarkersRef.current).forEach(marker => {
        console.log('🧹 Removendo marcador:', marker);
        marker.remove();
      });
      driverMarkersRef.current = {};
      
      if (map.current) {
        console.log('🧹 Removendo mapa');
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Função para atualizar os marcadores dos motoristas
  const updateDriverMarkers = () => {
    const currentMap = map.current;
    if (!currentMap) {
      return;
    }

    // Remove existing markers
    Object.values(driverMarkersRef.current).forEach(marker => {
      marker.remove();
    });
    driverMarkersRef.current = {};

    // Add new markers for each online driver
    onlineDrivers?.forEach(driver => {
      if (!driver.currentLocation || !Array.isArray(driver.currentLocation)) {
        return;
      }

      try {
        // Create marker element
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.style.zIndex = '999';

        // Add pulse effect
        const pulse = document.createElement('div');
        pulse.className = 'driver-marker-pulse';
        el.appendChild(pulse);

        // Add icon
        const icon = document.createElement('div');
        icon.className = 'driver-marker-icon';
        icon.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L17 10c-.5-.3-1.1-.1-1.3.4l-2.2 4.2" />
            <path d="M14 17H9" />
            <path d="M5 17H3c-.6 0-1-.4-1-1v-3c0-.9.7-1.7 1.5-1.9L7 10c.5-.3 1.1-.1 1.3.4l2.2 4.2" />
            <path d="M6.5 13h11" />
          </svg>
        `;
        el.appendChild(icon);

        // Create marker with offset
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          offset: [0, 0]
        })
          .setLngLat(driver.currentLocation)
          .addTo(currentMap);

        // Add popup with driver info
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: [0, -15],
          maxWidth: '300px',
          className: 'driver-popup'
        });

        // Create popup content
        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 min-w-[200px]';
        popupContent.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h3 class="font-medium text-gray-900">${driver.name || 'Motorista'}</h3>
                ${driver.rating ? `
                  <div class="flex items-center text-yellow-500">
                    <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    <span class="ml-1 text-sm font-medium">${driver.rating.toFixed(1)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
            ${driver.vehicle ? `
              <div class="space-y-1.5">
                <div class="flex items-center text-gray-600">
                  <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L17 10c-.5-.3-1.1-.1-1.3.4l-2.2 4.2" />
                    <path d="M14 17H9" />
                    <path d="M5 17H3c-.6 0-1-.4-1-1v-3c0-.9.7-1.7 1.5-1.9L7 10c.5-.3 1.1-.1 1.3.4l2.2 4.2" />
                    <path d="M6.5 13h11" />
                  </svg>
                  <span class="text-sm">${driver.vehicle.model || ''} • ${driver.vehicle.color || ''}</span>
                </div>
                <div class="flex items-center text-gray-600">
                  <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span class="text-sm font-medium">${driver.vehicle.plate || ''}</span>
                </div>
              </div>
            ` : ''}
          </div>
        `;

        // Add click event to marker
        el.addEventListener('click', () => {
          popup.setLngLat(driver.currentLocation)
            .setDOMContent(popupContent)
            .addTo(currentMap);
        });

        // Adicionar o marcador à referência
        driverMarkersRef.current[driver.id] = marker;

        // Centralizar o mapa no primeiro motorista
        if (Object.keys(driverMarkersRef.current).length === 1) {
          currentMap.flyTo({
            center: driver.currentLocation,
            zoom: 14,
            essential: true,
            animate: false
          });
        }
      } catch (error) {
        console.error('Erro ao adicionar marcador:', error);
      }
    });
  };

  // Update driver markers when onlineDrivers prop changes
  useEffect(() => {
    if (!map.current || !map.current.loaded()) {
      console.log('⏳ Aguardando carregamento do mapa...');
      
      // Esperar o mapa carregar antes de adicionar os marcadores
      map.current?.once('load', () => {
        console.log('✅ Mapa carregado, atualizando marcadores...');
        updateDriverMarkers();
      });
      return;
    }

    console.log('🔄 Atualizando marcadores dos motoristas:', onlineDrivers);
    updateDriverMarkers();
  }, [onlineDrivers]);

  // Adicionar listener para eventos de erro do mapa
  useEffect(() => {
    if (!map.current) return;

    const handleError = (e: any) => {
      console.error('❌ Erro no mapa:', e);
    };

    map.current.on('error', handleError);

    return () => {
      map.current?.off('error', handleError);
    };
  }, []);

  return <div ref={mapContainer} className={className} style={{ width: '100%', height: '100%' }} />;
};

export default Map;