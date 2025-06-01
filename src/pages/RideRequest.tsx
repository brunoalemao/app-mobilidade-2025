import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Navigation, X, ChevronRight, Car, UserCheck, ShieldCheck, CreditCard, User as UserIcon, Star, Phone, Bell } from 'lucide-react';
import { collection, query, getDocs, addDoc, Timestamp, doc, deleteDoc, updateDoc, getDoc, onSnapshot, where } from 'firebase/firestore';
import { db, COLLECTIONS } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import { geocodeAddress, getCurrentLocation, reverseGeocode, createRoute } from '../utils/mapbox';
import Map from '../components/Map';
import MapContainer from '../components/MapContainer';
import { toast } from 'react-hot-toast';
import { calculatePrice } from '../utils/pricing';
import { Location, RouteResponse } from '../types/mapbox';
import { User } from '../types/user';
import type { Ride as RideType } from '../types/user';
import { sendNotification, requestNotificationPermission } from '../utils/notifications';
import { User as FirebaseUser } from 'firebase/auth';

type LocationType = {
  id: string;
  place: string;
  address: string;
  coordinates: [number, number];
};

interface DriverType {
  id: string;
  name: string;
  currentLocation?: [number, number] | null;  // Pode ser undefined ou null
  rating?: number;
  vehicle?: {
    model: string;
    plate: string;
    color: string;
  };
  phone?: string;
}

interface VehicleCategory {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerKm: number;
  pricePerMinute: number;
  minPrice: number;
  icon: string;
  dynamicPricing: {
    rainMultiplier: number;
    peakHoursMultiplier: number;
    peakHours: {
      start: string;
      end: string;
    }[];
  };
  estimatedPrice?: number;
  estimatedTime?: string;
}

type PaymentMethod = 'pix' | 'card' | 'cash';

type Step = 'location' | 'categories' | 'confirmation';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

interface CustomUser extends FirebaseUser {
  phoneNumber: string | null;
}

interface MapProps {
  className?: string;
  origin?: [number, number];
  destination?: [number, number];
  showRoute?: boolean;
  onlineDrivers: Array<{
    id: string;
    currentLocation: [number, number];
  }>;
}

interface Ride extends RideType {}

const RideRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialDestination = searchParams.get('dest') || '';
  const initialOrigin = searchParams.get('orig') || '';
  
  const [origin, setOrigin] = useState<LocationType | null>(null);
  const [destination, setDestination] = useState<LocationType | null>(null);
  const [originQuery, setOriginQuery] = useState(initialOrigin);
  const [destinationQuery, setDestinationQuery] = useState(initialDestination);
  const [searchResults, setSearchResults] = useState<LocationType[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('pix');
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [rideId, setRideId] = useState<string | null>(null);
  const [driver, setDriver] = useState<DriverType | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [quickDestinationName, setQuickDestinationName] = useState('');
  
  // Adicionar novo state para controlar o intervalo de verificação
  const [checkingDrivers, setCheckingDrivers] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout>();

  // Solicitar permissão de notificação ao montar o componente
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
          toast.error('Para melhor experiência, permita as notificações do app', {
            duration: 5000,
            icon: '🔔'
          });
        }
      } catch (error) {
        console.error('Erro ao configurar notificações:', error);
      }
    };

    setupNotifications();
  }, []);

  // Carregar categorias de veículos com atualização em tempo real
  useEffect(() => {
    console.log('Iniciando monitoramento de categorias...');
    
    const categoriesRef = collection(db, 'vehicleCategories');
    const unsubscribe = onSnapshot(
      categoriesRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        console.log('📦 Recebendo atualização de categorias:', snapshot.size);
        
        const loadedCategories = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Dados da categoria:', { id: doc.id, ...data });
          
          return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            basePrice: Number(data.basePrice) || 0,
            pricePerKm: Number(data.pricePerKm) || 0,
            pricePerMinute: Number(data.pricePerMinute) || 0,
            minPrice: Number(data.minPrice) || 0,
            icon: data.icon || '🚗',
            dynamicPricing: {
              rainMultiplier: Number(data.dynamicPricing?.rainMultiplier) || 1.2,
              peakHoursMultiplier: Number(data.dynamicPricing?.peakHoursMultiplier) || 1.5,
              peakHours: Array.isArray(data.dynamicPricing?.peakHours) ? 
                data.dynamicPricing.peakHours : [
                  { start: "07:00", end: "09:00" },
                  { start: "17:00", end: "19:00" }
                ]
            }
          };
        });
        
        console.log('Categorias processadas:', loadedCategories);
        setCategories(loadedCategories);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao monitorar categorias:', error);
        toast.error('Erro ao carregar categorias de veículos');
        setLoading(false);
      }
    );

    // Limpar listener quando o componente for desmontado
    return () => {
      console.log('Limpando monitoramento de categorias');
      unsubscribe();
    };
  }, []); // Remover dependências desnecessárias

  // Atualizar preços e tempos estimados quando origem ou destino mudarem
  useEffect(() => {
    if (origin && destination && categories.length > 0) {
      const updatedCategories = categories.map(category => {
        const distance = calculateDistance(
          origin.coordinates,
          destination.coordinates
        );
        
        // Calcular tempo estimado
        const timeInHours = distance / 30000; // Assumindo velocidade média de 30 km/h
        const timeInMinutes = Math.ceil(timeInHours * 60);
        
        // Calcular preço com a nova lógica
        const price = calculatePrice(distance, timeInMinutes, category);
        
        return {
          ...category,
          estimatedPrice: price,
          estimatedTime: `${timeInMinutes} min`
        };
      });
      
      console.log('Categorias atualizadas com preços:', updatedCategories);
      setCategories(updatedCategories);
    }
  }, [origin, destination]);

  // Carregar localização atual ao montar o componente
  useEffect(() => {
    const loadCurrentLocation = async () => {
      try {
        const coordinates = await getCurrentLocation();
        const address = await reverseGeocode(coordinates);
        
        const currentLocation: LocationType = {
          id: 'current-location',
          place: address.placeName.split(',')[0],
          address: address.address,
          coordinates: coordinates
        };
        
        setOrigin(currentLocation);
        setOriginQuery(currentLocation.place);
      } catch (error) {
        console.error('Erro ao obter localização atual:', error);
      }
    };

    loadCurrentLocation();
  }, []);

  // Carregar endereços iniciais da URL
  useEffect(() => {
    const loadAddressFromUrl = async () => {
      if (initialOrigin) {
        try {
          const result = await geocodeAddress(initialOrigin);
          const location: LocationType = {
            id: result.placeName,
            place: result.placeName.split(',')[0],
            address: result.address,
            coordinates: result.coordinates
          };
          setOrigin(location);
        } catch (error) {
          console.error('Erro ao carregar endereço de origem:', error);
        }
      }

      if (initialDestination) {
        try {
          const result = await geocodeAddress(initialDestination);
          const location: LocationType = {
            id: result.placeName,
            place: result.placeName.split(',')[0],
            address: result.address,
            coordinates: result.coordinates
          };
          setDestination(location);
        } catch (error) {
          console.error('Erro ao carregar endereço de destino:', error);
        }
      }
    };

    loadAddressFromUrl();
  }, [initialOrigin, initialDestination]);

  // Atualizar a busca de endereços
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      const query = origin ? destinationQuery : originQuery;
      
      if (!query || query.length < 3) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      
      try {
        const results = await geocodeAddress(query);
        if (Array.isArray(results)) {
          const locations = results.map(result => ({
            id: result.placeName,
            place: result.placeName.split(',')[0],
            address: result.address,
            coordinates: result.coordinates
          }));
          setSearchResults(locations);
        } else {
          const location = {
            id: results.placeName,
            place: results.placeName.split(',')[0],
            address: results.address,
            coordinates: results.coordinates
          };
          setSearchResults([location]);
        }
      } catch (error) {
        console.error('Erro ao buscar endereço:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [originQuery, destinationQuery, origin]);
  
  const handleSelectLocation = (location: LocationType) => {
    if (!origin) {
      setOrigin(location);
      setOriginQuery('');
      // Focus destination input automatically
      setTimeout(() => {
        const destInput = document.getElementById('destination-input');
        if (destInput) destInput.focus();
      }, 100);
    } else {
      setDestination(location);
      setDestinationQuery('');
      // Não avançar automaticamente para a próxima etapa
    }
  };
  
  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };
  
  const handleResetLocation = (type: 'origin' | 'destination') => {
    if (type === 'origin') {
      setOrigin(null);
      setOriginQuery('');
      // Reset destination too if user wants to change origin
      if (currentStep !== 'location') {
        setDestination(null);
        setDestinationQuery('');
        setCurrentStep('location');
      }
    } else {
      setDestination(null);
      setDestinationQuery('');
      if (currentStep !== 'location') {
        setCurrentStep('location');
      }
    }
  };
  
  // Função para verificar motoristas online
  const checkOnlineDrivers = async () => {
    try {
      console.log('Verificando motoristas online...');
      const driversRef = collection(db, 'drivers');
      // Simplificar a query para verificar apenas isOnline
      const q = query(driversRef, where('isOnline', '==', true));
      const querySnapshot = await getDocs(q);
      
      console.log('Motoristas encontrados:', querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
      
      if (!querySnapshot.empty && checkingDrivers) {
        const onlineDrivers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Motoristas online:', onlineDrivers);
        
        toast.success(`${querySnapshot.size} motorista(s) disponível(is)! Você já pode solicitar sua corrida.`, {
          duration: 5000,
          icon: '🚗'
        });
        setCheckingDrivers(false);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      }
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Erro ao verificar motoristas:', error);
      return false;
    }
  };

  // Limpar intervalo quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const handleConfirmRide = async () => {
    if (!user || !origin || !destination || !selectedCategory) return;
    
    try {
      setLoading(true);
      console.log('Iniciando solicitação de corrida...');
      
      // Verificar motoristas online
      const driversRef = collection(db, 'drivers');
      const q = query(driversRef, where('isOnline', '==', true));
      const querySnapshot = await getDocs(q);
      
      const onlineDrivers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Motoristas online encontrados:', onlineDrivers);
      
      if (querySnapshot.empty) {
        toast.error('Não há motoristas disponíveis no momento. Continuaremos procurando e te avisaremos quando encontrarmos um motorista.', {
          duration: 8000,
          icon: '🚗'
        });
        
        // Iniciar verificação periódica
        setCheckingDrivers(true);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        checkIntervalRef.current = setInterval(async () => {
          const hasDrivers = await checkOnlineDrivers();
          if (hasDrivers) {
            // Quando encontrar motoristas, tentar criar a corrida automaticamente
            handleConfirmRide();
          }
        }, 3000);
        
        setLoading(false);
        return;
      }

      // Criar a corrida no Firestore
      const selectedVehicle = categories.find(c => c.id === selectedCategory);
      if (!selectedVehicle) {
        toast.error('Categoria de veículo não encontrada');
        return;
      }

      const distance = calculateDistance(origin.coordinates, destination.coordinates);
      const timeInMinutes = Math.ceil((distance / 30000) * 60); // Assumindo velocidade média de 30 km/h
      const price = calculatePrice(distance, timeInMinutes, selectedVehicle);
      
      const rideData = {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Usuário',
        userPhone: (user as CustomUser).phoneNumber || '',
        origin: {
          place: origin.place,
          address: origin.address,
          coordinates: origin.coordinates
        },
        destination: {
          place: destination.place,
          address: destination.address,
          coordinates: destination.coordinates
        },
        category: {
          id: selectedCategory,
          name: selectedVehicle.name,
          basePrice: Number(selectedVehicle.basePrice) || 0,
          pricePerKm: Number(selectedVehicle.pricePerKm) || 0,
          pricePerMinute: Number(selectedVehicle.pricePerMinute) || 0,
          minPrice: Number(selectedVehicle.minPrice) || 0,
          dynamicPricing: {
            rainMultiplier: Number(selectedVehicle.dynamicPricing?.rainMultiplier) || 1.2,
            peakHoursMultiplier: Number(selectedVehicle.dynamicPricing?.peakHoursMultiplier) || 1.5,
            peakHours: selectedVehicle.dynamicPricing?.peakHours || [
              { start: "07:00", end: "09:00" },
              { start: "17:00", end: "19:00" }
            ]
          }
        },
        price,
        estimatedTime: `${timeInMinutes} min`,
        distance,
        duration: timeInMinutes,
        status: 'pending',
        paymentMethod: selectedPayment,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        driverId: '',
        driver: null,
        availableDrivers: onlineDrivers.map(driver => driver.id)
      };

      console.log('Dados da corrida a ser criada:', rideData);

      // Criar a corrida com retry
      const createRideWithRetry = async (retryCount = 0) => {
        try {
          const ridesRef = collection(db, COLLECTIONS.ACTIVE_RIDES);
          const docRef = await addDoc(ridesRef, rideData);
          console.log('Corrida criada com sucesso, ID:', docRef.id);
          setRideId(docRef.id);
          
          // Notificar o usuário
          toast.success('Corrida solicitada com sucesso! Procurando motorista próximo...', {
            duration: 5000,
            icon: '🚗'
          });

          // Quando um motorista aceitar a corrida
          if (
            rideData.status === 'accepted' &&
            rideData.driver &&
            typeof rideData.driver === 'object' &&
            ride?.status !== 'accepted' // Só notifica na primeira vez que aceitar
          ) {
            const driverName = (rideData.driver as any).name || 'Seu motorista';
            console.log('Motorista aceitou a corrida:', driverName);
            await sendNotification(
              'Motorista encontrado! 🚗',
              {
                body: `${driverName} está a caminho`,
                icon: '/driver-accepted.png',
                badge: '/logo192.png',
                tag: `ride-${docRef.id}-accepted`,
                requireInteraction: true,
                data: {
                  rideId: docRef.id,
                  type: 'driver_accepted'
                }
              },
              user.uid
            );
          }

          // Quando o motorista chegar ao ponto de embarque
          if (
            rideData.status === 'arrived' &&
            rideData.driver &&
            typeof rideData.driver === 'object' &&
            ride?.status !== 'arrived' // Só notifica na primeira vez que chegar
          ) {
            const driverName = (rideData.driver as any).name || 'Seu motorista';
            console.log('Motorista chegou ao local:', driverName);
            await sendNotification(
              'Motorista chegou! 🚗',
              {
                body: `${driverName} está no ponto de embarque`,
                icon: '/driver-arrived.png',
                badge: '/logo192.png',
                tag: `ride-${docRef.id}-arrived`,
                requireInteraction: true,
                data: {
                  rideId: docRef.id,
                  type: 'driver_arrived'
                }
              },
              user.uid
            );
          }
        } catch (error) {
          console.error('Erro ao criar corrida:', error);
          if (error instanceof Error && error.message.includes('quota') && retryCount < 3) {
            console.log(`Tentativa ${retryCount + 1} falhou, tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return createRideWithRetry(retryCount + 1);
          }
          throw error;
        }
      };

      await createRideWithRetry();
    } catch (error) {
      console.error('Erro ao criar corrida:', error);
      toast.error('Erro ao solicitar corrida. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!rideId) return;

    try {
      // Delete the ride from Firestore
      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, rideId);
      await deleteDoc(rideRef);

      // Reset local state
      setOrigin(null);
      setDestination(null);
      setOriginQuery('');
      setDestinationQuery('');
      setSelectedCategory('');
      setSelectedPayment('pix');
      setRideId(null);
      setCurrentStep('location');

      // Navigate back to home
      navigate('/');
    } catch (error) {
      console.error('Erro ao cancelar corrida:', error);
    }
  };
  
  const handleSaveQuickDestination = async () => {
    if (!origin || !destination || !quickDestinationName.trim()) return;

    try {
      const quickDestRef = collection(db, 'quickDestinations');
      await addDoc(quickDestRef, {
        name: quickDestinationName.trim(),
        origin: {
          place: origin.place,
          address: origin.address,
          coordinates: origin.coordinates
        },
        destination: {
          place: destination.place,
          address: destination.address,
          coordinates: destination.coordinates
        },
        userId: user?.uid,
        icon: '📍',
        createdAt: Timestamp.now()
      });

      toast.success('Destino rápido salvo com sucesso!');
      setShowSaveModal(false);
      setQuickDestinationName('');
    } catch (error) {
      console.error('Erro ao salvar destino rápido:', error);
      toast.error('Erro ao salvar destino rápido');
    }
  };
  
  const renderLocationStep = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 bg-white shadow-sm">
          <h1 className="text-2xl font-bold font-heading mb-4">Para onde vamos?</h1>
          
          {/* Campos de origem e destino */}
          <div className="bg-white space-y-4">
            <div className="space-y-4">
              {/* Origin input */}
              <div className="relative">
                {origin ? (
                  <div className="flex items-center px-3 py-2 bg-blue-50 rounded-lg">
                    <MapPin size={16} className="text-primary-600 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900">{origin.place}</div>
                      <div className="text-xs text-gray-500 truncate">{origin.address}</div>
                    </div>
                    <button 
                      className="ml-2 text-gray-400 hover:text-gray-600"
                      onClick={() => handleResetLocation('origin')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                        <MapPin size={16} className="text-primary-600" />
                      </div>
                    </div>
                    <input
                      id="origin-input"
                      type="text"
                      className="input pl-12 w-full rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="Digite o endereço de origem"
                      value={originQuery}
                      onChange={(e) => setOriginQuery(e.target.value)}
                      autoFocus
                    />
                  </>
                )}
              </div>
              
              {/* Destination input */}
              <div className="relative">
                {destination ? (
                  <div className="flex items-center px-3 py-2 bg-blue-50 rounded-lg">
                    <Navigation size={16} className="text-secondary-600 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900">{destination.place}</div>
                      <div className="text-xs text-gray-500 truncate">{destination.address}</div>
                    </div>
                    <button 
                      className="ml-2 text-gray-400 hover:text-gray-600"
                      onClick={() => handleResetLocation('destination')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-secondary-100 flex items-center justify-center">
                        <Navigation size={16} className="text-secondary-600" />
                      </div>
                    </div>
                    <input
                      id="destination-input"
                      type="text"
                      className="input pl-12 w-full rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="Digite o endereço de destino"
                      value={destinationQuery}
                      onChange={(e) => setDestinationQuery(e.target.value)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Search results */}
            {((!origin && originQuery.length > 2) || (origin && !destination && destinationQuery.length > 2)) && (
              <div className="absolute left-4 right-4 bg-white mt-1 rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
                {isSearching ? (
                  <div className="p-3 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-gray-500">
                    Nenhum resultado encontrado
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {searchResults.map(result => (
                      <li key={result.id}>
                        <button
                          className="w-full p-3 text-left hover:bg-gray-50 flex items-start space-x-3"
                          onClick={() => handleSelectLocation(result)}
                        >
                          <MapPin size={18} className="text-gray-400 flex-shrink-0 mt-1" />
                          <div className="overflow-hidden">
                            <p className="font-medium text-gray-900 truncate">{result.place}</p>
                            <p className="text-sm text-gray-500 truncate">{result.address}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Mapa com traçado da rota */}
          <div className="flex-1 p-4">
            <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-200 shadow-md">
              <MapContainer
                className="w-full h-full"
                origin={origin?.coordinates}
                destination={destination?.coordinates}
                showRoute={!!(origin && destination)}
                onlineDrivers={[]}
              />
            </div>
          </div>
          
          {/* Informações da rota quando origem e destino estão selecionados */}
          {origin && destination && (
            <div className="px-4 pb-4">
              <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">Distância estimada:</p>
                    <p className="text-sm text-gray-600">
                      {(calculateDistance(origin.coordinates, destination.coordinates) / 1000).toFixed(1)} km
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Tempo estimado:</p>
                    <p className="text-sm text-gray-600">
                      {calculateEstimatedTime(origin.coordinates, destination.coordinates)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3 mt-auto">
            {origin && destination && (
              <>
                <button
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center"
                  onClick={() => setCurrentStep('categories')}
                >
                  Confirmar endereços
                  <ChevronRight size={20} className="ml-2" />
                </button>

                <button
                  className="w-full bg-white border border-primary-600 text-primary-600 py-3 rounded-lg font-medium hover:bg-primary-50 transition-colors flex items-center justify-center"
                  onClick={() => setShowSaveModal(true)}
                >
                  Salvar como destino rápido
                  <Star size={20} className="ml-2" />
                </button>
              </>
            )}
          </div>
        </div>

        {showSaveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
              <h2 className="text-xl font-bold">Salvar destino rápido</h2>
              
              <div className="space-y-2">
                <label htmlFor="quick-dest-name" className="block text-sm font-medium text-gray-700">
                  Nome do destino
                </label>
                <input
                  id="quick-dest-name"
                  type="text"
                  className="input"
                  placeholder="Ex: Casa, Trabalho, Academia"
                  value={quickDestinationName}
                  onChange={(e) => setQuickDestinationName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Origem</p>
                    <p className="font-medium">{origin?.place}</p>
                    <p className="text-sm text-gray-500">{origin?.address}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Navigation size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Destino</p>
                    <p className="font-medium">{destination?.place}</p>
                    <p className="text-sm text-gray-500">{destination?.address}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setQuickDestinationName('');
                  }}
                  className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveQuickDestination}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  disabled={!quickDestinationName.trim()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sponsors */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 -mt-2">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Patrocinadores</h3>
          <div className="grid grid-cols-4 gap-3">
            {/* Example sponsors - replace with real sponsor data */}
            <div className="aspect-[4/2] bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
              <span className="text-gray-400">Sponsor 1</span>
            </div>
            <div className="aspect-[4/2] bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
              <span className="text-gray-400">Sponsor 2</span>
            </div>
            <div className="aspect-[4/2] bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
              <span className="text-gray-400">Sponsor 3</span>
            </div>
            <div className="aspect-[4/2] bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
              <span className="text-gray-400">Sponsor 4</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderCategoriesStep = () => (
    <div className="space-y-3">
      <div className="flex items-center mb-3">
        <button 
          onClick={() => setCurrentStep('location')}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <X size={20} className="text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold font-heading">Escolha o tipo de veículo</h1>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <MapPin size={16} className="mr-1" />
            <span className="truncate">{origin?.place}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Navigation size={16} className="mr-1" />
            <span className="truncate">{destination?.place}</span>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="w-full h-24 bg-gray-100 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {categories.map(category => (
              <button
                key={category.id}
                className={`w-full bg-white p-4 rounded-lg border transition-all flex items-center justify-between ${
                  selectedCategory === category.id 
                    ? 'border-primary-500 bg-primary-50 shadow-md' 
                    : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                }`}
                onClick={() => handleSelectCategory(category.id)}
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                    <Car size={24} className="text-gray-700" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500">{category.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R$ {category.estimatedPrice ? category.estimatedPrice.toFixed(2) : '0.00'}</p>
                  <p className="text-sm text-gray-500">{category.estimatedTime || '0 min'}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Formas de Pagamento</h3>
            <div className="space-y-3">
              <button 
                onClick={() => setSelectedPayment('pix')}
                className={`w-full flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                  selectedPayment === 'pix' ? 'border-green-500 bg-green-50' : ''
                }`}
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-green-600 font-bold text-sm">PIX</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Pix</p>
                  <p className="text-sm text-gray-500">Pagamento instantâneo</p>
                </div>
              </button>

              <button 
                onClick={() => setSelectedPayment('card')}
                className={`w-full flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                  selectedPayment === 'card' ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <CreditCard size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Cartão</p>
                  <p className="text-sm text-gray-500">Crédito ou débito</p>
                </div>
              </button>

              <button 
                onClick={() => setSelectedPayment('cash')}
                className={`w-full flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                  selectedPayment === 'cash' ? 'border-yellow-500 bg-yellow-50' : ''
                }`}
              >
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-yellow-600 font-bold">R$</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Dinheiro</p>
                  <p className="text-sm text-gray-500">Pagamento em espécie</p>
                </div>
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            className="btn-primary w-full flex items-center justify-center"
            onClick={() => {
              if (selectedCategory && selectedPayment) {
                setCurrentStep('confirmation');
              }
            }}
            disabled={!selectedCategory || !selectedPayment}
          >
            Continuar
            <ChevronRight size={20} className="ml-2" />
          </button>
        </>
      )}
    </div>
  );
  
  const renderConfirmationStep = () => {
    const selectedVehicle = categories.find(c => c.id === selectedCategory);
    if (!selectedVehicle || !origin || !destination) return null;
    
    const formatDistance = (distance: number) => {
      // Garantir que a distância está em metros
      const distanceInMeters = distance;
      if (distanceInMeters < 1000) {
        return `${Math.round(distanceInMeters)} m`;
      }
      return `${(distanceInMeters / 1000).toFixed(1)} km`;
    };

    const formatDuration = (duration: string) => {
      // Convert duration from string to seconds
      const seconds = Math.round(parseFloat(duration) / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    return (
      <div className="space-y-3">
        {/* Route info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-start">
            <div className="mr-4 flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary-500"></div>
              <div className="w-0.5 h-10 bg-gray-200 my-1"></div>
              <div className="w-3 h-3 rounded-full bg-secondary-500"></div>
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <p className="font-medium truncate">{origin.place}</p>
                <p className="text-sm text-gray-500 truncate">{origin.address}</p>
              </div>
              <div>
                <p className="font-medium truncate">{destination.place}</p>
                <p className="text-sm text-gray-500 truncate">{destination.address}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Vehicle info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
              <Car size={24} className="text-gray-700" />
            </div>
            <div>
              <h3 className="font-medium">{selectedVehicle.name}</h3>
              <p className="text-sm text-gray-500">{selectedVehicle.description}</p>
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center text-gray-600">
              <UserCheck size={16} className="mr-2" />
              <span>Motorista verificado</span>
            </div>
            <div className="flex items-center text-gray-600">
              <ShieldCheck size={16} className="mr-2" />
              <span>Viagem protegida</span>
            </div>
          </div>
        </div>
        
        {/* Payment info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-3">Detalhes do pagamento</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Forma de pagamento:</span>
              <span className="font-medium">
                {selectedPayment === 'pix' && 'PIX'}
                {selectedPayment === 'card' && 'Cartão'}
                {selectedPayment === 'cash' && 'Dinheiro'}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Valor estimado:</span>
              <span className="font-medium">R$ {selectedVehicle.estimatedPrice?.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tempo estimado:</span>
              <span className="font-medium">{selectedVehicle.estimatedTime}</span>
            </div>
          </div>
        </div>
        
        {/* Confirm button */}
        <button
          className="btn-primary w-full flex items-center justify-center"
          onClick={handleConfirmRide}
          disabled={loading}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              Confirmar corrida
              <ChevronRight size={20} className="ml-2" />
            </>
          )}
        </button>
      </div>
    );
  };

  // Atualizar monitoramento de corrida
  useEffect(() => {
    if (!rideId || !user) return;

    console.log('🔄 Iniciando monitoramento da corrida:', rideId);

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.ACTIVE_RIDES, rideId),
      { includeMetadataChanges: false },
      async (snapshot) => {
        console.log('📩 Snapshot recebido:', {
          exists: snapshot.exists(),
          id: snapshot.id,
          data: snapshot.data()
        });

        // Se o documento não existe mais no activeRides
        if (!snapshot.exists()) {
          console.log('🔍 Documento não existe mais em activeRides, verificando em completedRides');
          
          // Verificar se foi movido para completedRides
          const completedRideRef = doc(db, COLLECTIONS.COMPLETED_RIDES, rideId);
          const completedRideDoc = await getDoc(completedRideRef);

          if (completedRideDoc.exists()) {
            console.log('✅ Corrida encontrada em completedRides, mostrando modal de avaliação');
            const completedRideData = completedRideDoc.data() as Ride;
            setRide(completedRideData);
            setShowRatingModal(true);
            
            // Enviar notificação de corrida finalizada
            await sendNotification(
              'Viagem finalizada! 🎉',
              {
                body: 'Sua viagem foi concluída. Não se esqueça de avaliar o motorista!',
                icon: '/ride-completed.png',
                badge: '/logo192.png',
                tag: `ride-${rideId}-completed`,
                requireInteraction: true,
                data: {
                  rideId,
                  type: 'ride_completed'
                }
              },
              user.uid
            );
          } else {
            console.log('❌ Corrida não encontrada em completedRides, limpando estados');
            toast.error('A corrida foi finalizada ou cancelada');
            setShowRatingModal(false);
            clearRideStates();
            navigate('/');
          }
          return;
        }

        // Se o documento ainda existe em activeRides
        const rideData = { id: snapshot.id, ...snapshot.data() } as Ride;
        console.log('📝 Dados da corrida:', {
          id: rideData.id,
          status: rideData.status,
          driver: rideData.driver
        });

        // Atualizar os estados primeiro
        setRide(rideData);
        if (rideData.driver) {
          setDriver(rideData.driver);
        }
        
        // Se o status mudou para completed
        if (rideData.status === 'completed') {
          console.log('✅ Status da corrida é completed, mostrando modal de avaliação');
          setShowRatingModal(true);
          await sendNotification(
            'Viagem finalizada! 🎉',
            {
              body: 'Sua viagem foi concluída. Não se esqueça de avaliar o motorista!',
              icon: '/ride-completed.png',
              badge: '/logo192.png',
              tag: `ride-${rideId}-completed`,
              requireInteraction: true,
              data: {
                rideId,
                type: 'ride_completed'
              }
            },
            user.uid
          );
          return;
        }

        // Se o status mudou para cancelled
        if (rideData.status === 'cancelled') {
          console.log('❌ Status da corrida é cancelled, limpando estados');
          toast.error('A corrida foi cancelada');
          setShowRatingModal(false);
          clearRideStates();
          navigate('/');
          return;
        }

        // Se o motorista chegou
        if (rideData.driverArrived && !ride?.driverArrived) {
          console.log('🚗 Motorista chegou ao local');
          await sendNotification(
            'Motorista chegou! 🚗',
            {
              body: `${rideData.driver?.name || 'Seu motorista'} está no ponto de embarque`,
              icon: '/driver-arrived.png',
              badge: '/logo192.png',
              tag: `ride-${rideId}-arrived`,
              requireInteraction: true,
              data: {
                rideId,
                type: 'driver_arrived'
              }
            },
            user.uid
          );
        }

        // Se o motorista aceitou a corrida
        if (rideData.status === 'accepted' && ride?.status !== 'accepted') {
          console.log('✅ Motorista aceitou a corrida');
          toast.success('Motorista encontrado! O motorista está a caminho.');
          await sendNotification(
            'Motorista encontrado! 🚗',
            {
              body: `${rideData.driver?.name || 'Seu motorista'} está a caminho`,
              icon: '/driver-accepted.png',
              badge: '/logo192.png',
              tag: `ride-${rideId}-accepted`,
              requireInteraction: true,
              data: {
                rideId,
                type: 'driver_accepted'
              }
            },
            user.uid
          );
        }
      },
      (error) => {
        console.error('❌ Erro ao monitorar corrida:', error);
        toast.error('Erro ao monitorar corrida');
        clearRideStates();
        navigate('/');
      }
    );

    return () => {
      console.log('🧹 Limpando listener da corrida');
      unsubscribe();
    };
  }, [rideId, navigate, user, ride?.status, ride?.driverArrived]);

  // Função para limpar os estados da corrida
  const clearRideStates = useCallback(() => {
    console.log('🧹 Limpando estados da corrida');
    setOrigin(null);
    setDestination(null);
    setSelectedCategory('');
    setDriver(null);
    setRide(null);
    setRideId(null);
    setCurrentStep('location');
    setShowRatingModal(false);
    setRating(5);
    setRatingComment('');
  }, []);

  const handleSubmitRating = async () => {
    if (!ride || !ride.driver) {
      console.log('❌ Tentativa de enviar avaliação sem ride ou driver');
      return;
    }

    try {
      console.log('📝 Iniciando envio de avaliação:', {
        rideId: ride.id,
        driverId: ride.driver.id,
        rating,
        comment: ratingComment
      });
      
      // Primeiro, atualizar apenas a avaliação da corrida
      const rideRef = doc(db, COLLECTIONS.COMPLETED_RIDES, ride.id);
      await updateDoc(rideRef, {
        rating,
        ratingComment,
        ratedAt: Timestamp.now()
      });

      console.log('✅ Avaliação da corrida salva com sucesso');

      try {
        // Em uma segunda operação, tentar atualizar a avaliação do motorista
        const driverRef = doc(db, 'drivers', ride.driver.id);
        const driverDoc = await getDoc(driverRef);
        
        if (driverDoc.exists()) {
          const driverData = driverDoc.data();
          const totalRatings = driverData.totalRatings || 0;
          const currentRating = driverData.rating || 5;
          
          const newRating = ((currentRating * totalRatings) + rating) / (totalRatings + 1);
          
          console.log('📊 Calculando nova avaliação do motorista:', {
            totalRatings,
            currentRating,
            newRating
          });

          await updateDoc(driverRef, {
            rating: newRating,
            totalRatings: totalRatings + 1
          });

          console.log('✅ Avaliação do motorista atualizada');
        }
      } catch (driverError) {
        console.error('❌ Erro ao atualizar avaliação do motorista:', driverError);
      }

      console.log('🧹 Finalizando processo de avaliação');
      setShowRatingModal(false);
      setRating(5);
      setRatingComment('');
      clearRideStates();
      toast.success('Obrigado pela sua avaliação!');
      
      // Pequeno delay antes de navegar para garantir que o usuário veja o toast
      setTimeout(() => {
        console.log('🔄 Redirecionando para home');
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('❌ Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação. Tente novamente.');
    }
  };

  // Se tiver uma corrida completa e showRatingModal for true, mostrar apenas o modal
  if (showRatingModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 m-4">
          <h2 className="text-2xl font-bold text-center">Como foi sua viagem?</h2>
          
          {/* Informações do motorista */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-lg">{ride?.driver?.name || 'Motorista'}</h3>
              <p className="text-gray-500">{ride?.driver?.vehicle?.model || ''} • {ride?.driver?.vehicle?.plate || ''}</p>
            </div>
          </div>

          {/* Estrelas para avaliação */}
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>

          {/* Campo de comentário */}
          <textarea
            className="w-full p-3 border rounded-lg resize-none"
            placeholder="Deixe um comentário sobre sua viagem (opcional)"
            rows={3}
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
          />

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowRatingModal(false);
                setRating(5);
                setRatingComment('');
                clearRideStates();
                navigate('/');
              }}
              className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Pular
            </button>
            <button
              onClick={handleSubmitRating}
              className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Avaliar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar modal de avaliação
  const renderRatingModal = () => {
    if (!ride?.driver) return null;

    const driverVehicle = ride.driver.vehicle;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
          <h2 className="text-2xl font-bold text-center">Como foi sua viagem?</h2>
          
          {/* Informações do motorista */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-lg">{ride.driver.name}</h3>
              {driverVehicle && (
                <p className="text-gray-500">
                  {driverVehicle.model} • {driverVehicle.plate}
                </p>
              )}
            </div>
          </div>

          {/* Estrelas para avaliação */}
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>

          {/* Campo de comentário */}
          <textarea
            className="w-full p-3 border rounded-lg resize-none"
            placeholder="Deixe um comentário sobre sua viagem (opcional)"
            rows={3}
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
          />

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowRatingModal(false)}
              className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Pular
            </button>
            <button
              onClick={handleSubmitRating}
              className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Avaliar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render driver info and map
  const renderDriverInfo = (driver: DriverType) => {
    if (!driver) return null;

    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-5 flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
        <div className="flex items-center gap-3 w-full mb-2">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
            {driver.name?.[0]?.toUpperCase() || <UserIcon size={28} />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg capitalize">{driver.name}</span>
              <span className="flex items-center text-yellow-500 text-sm font-medium">
                <Star size={16} className="mr-1" /> {driver.rating?.toFixed(1) || '5.0'}
              </span>
            </div>
            <div className="text-xs text-gray-500">Motorista</div>
          </div>
        </div>
        <div className="w-full flex flex-col gap-1 mt-2 text-base">
          <div className="flex items-center gap-2">
            <Car size={18} className="text-gray-400" />
            <span className="font-semibold">Carro:</span>
            <span className="capitalize">{driver.vehicle?.model}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Cor:</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs capitalize">{driver.vehicle?.color}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Placa:</span>
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono tracking-wider">{driver.vehicle?.plate}</span>
          </div>
        </div>
        <a
          href={`tel:${driver.phone}`}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition"
        >
          <Phone size={18} /> Ligar para motorista
        </a>
      </div>
    );
  };

  // Regular flow
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto bg-white">
        {/* Header */}
        <header className="px-4 py-3 border-b">
          <button 
            onClick={() => navigate(-1)} 
            className="text-gray-600 hover:text-gray-900"
          >
            <X size={24} />
          </button>
        </header>

        {/* Content */}
        <div className="p-4">
          {ride && ride.status === 'accepted' ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                <p className="text-center font-medium">Motorista encontrado! 🚗</p>
              </div>
              {driver && renderDriverInfo(driver)}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin size={16} className="mr-1" />
                    <span className="truncate">{origin?.place}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Navigation size={16} className="mr-1" />
                    <span className="truncate">{destination?.place}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCancelRide}
                className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700"
              >
                Cancelar corrida
              </button>
            </div>
          ) : (
            <>
              {currentStep === 'location' && renderLocationStep()}
              {currentStep === 'categories' && renderCategoriesStep()}
              {currentStep === 'confirmation' && renderConfirmationStep()}
            </>
          )}
        </div>
      </div>
      {/* Sempre renderizar o modal se showRatingModal for true */}
      {showRatingModal && renderRatingModal()}
    </div>
  );
};

// Função para calcular distância entre dois pontos (Haversine)
const calculateDistance = (
  originCoords: [number, number],
  destinationCoords: [number, number]
) => {
  const [lat1, lon1] = originCoords;
  const [lat2, lon2] = destinationCoords;
  
  const R = 6371e3; // metros
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const toRad = (value: number) => {
  return (value * Math.PI) / 180;
};

// Função para calcular preço estimado
const calculateEstimatedPrice = (
  category: VehicleCategory,
  originCoords: [number, number],
  destinationCoords: [number, number]
) => {
  // Calcular distância em km
  const distance = calculateDistance(originCoords, destinationCoords);
  
  // Calcular preço base
  let price = category.basePrice + (distance * category.pricePerKm);
  
  // Aplicar multiplicador de chuva se estiver chovendo (exemplo)
  const isRaining = false; // Você pode implementar uma verificação real do clima
  if (isRaining) {
    price *= category.dynamicPricing.rainMultiplier;
  }
  
  // Verificar se é horário de pico
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const isPeakHour = category.dynamicPricing.peakHours.some(period => {
    return currentTime >= period.start && currentTime <= period.end;
  });
  
  if (isPeakHour) {
    price *= category.dynamicPricing.peakHoursMultiplier;
  }
  
  // Garantir preço mínimo
  return Math.max(price, category.minPrice);
};

// Função para calcular tempo estimado
const calculateEstimatedTime = (originCoords: [number, number], destinationCoords: [number, number]) => {
  const distance = calculateDistance(originCoords, destinationCoords);
  const timeInHours = distance / 30000; // Assumindo velocidade média de 30 km/h
  const timeInMinutes = Math.ceil(timeInHours * 60);
  return `${timeInMinutes} min`;
};

// Atualizar a função de envio de notificação
const sendRideNotification = async (title: string, options: NotificationOptions = {}) => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Permissão para notificações não concedida');
      return;
    }

    const notification = await sendNotification(title, {
      ...options,
      icon: '/car-icon.png',
      badge: '/logo192.png',
      requireInteraction: true
    });

    if (notification) {
      console.log('Notificação enviada com sucesso');
    }
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
};

export default RideRequest;