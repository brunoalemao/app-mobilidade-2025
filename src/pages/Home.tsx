import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Star, Car } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, limit, getDocs, Timestamp, where, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { formatFirestoreTimestamp } from '../utils/date';
import Map from '../components/Map';
import { getCurrentLocation } from '../utils/mapbox';

// Types
interface Ride {
  id: string;
  destination: {
    place: string;
    address: string;
  };
  completedAt: Timestamp;
  price: number;
  duration: string;
}

interface Driver {
  id: string;
  currentLocation: [number, number];
  lastOnline: {
    toDate: () => Date;
  };
  status: string;
  isOnline: boolean;
  name: string;
  vehicle?: {
    model: string;
    plate: string;
    color: string;
  };
  rating?: number;
}

const Home = () => {
  const { user } = useAuth();
  const [quickDestinations, setQuickDestinations] = useState<any[]>([]);
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const isLoadingRef = useRef(false);

  // Obter localização atual
  useEffect(() => {
    const loadCurrentLocation = async () => {
      try {
        const coords = await getCurrentLocation();
        setCurrentLocation(coords);
      } catch (error) {
        console.error('Erro ao obter localização:', error);
        // Usar localização padrão em caso de erro
        setCurrentLocation([-16.3285, -48.9535]);
      }
    };

    loadCurrentLocation();
  }, []);

  // Monitorar motoristas online
  useEffect(() => {
    console.log('🔄 Iniciando monitoramento de motoristas online...');

    const driversRef = collection(db, 'drivers');
    const onlineDriversQuery = query(
      driversRef,
      where('isOnline', '==', true),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(onlineDriversQuery, (snapshot) => {
      const drivers = snapshot.docs.map(doc => {
        const data = doc.data();
        // Filtrar manualmente por lastLocationUpdate
        const now = Timestamp.now();
        const fiveMinutesAgo = new Timestamp(now.seconds - 300, now.nanoseconds);
        
        if (!data.lastLocationUpdate || data.lastLocationUpdate.toDate() < fiveMinutesAgo.toDate()) {
          return null;
        }

        // Verificar se o motorista tem localização válida
        if (!data.currentLocation || !Array.isArray(data.currentLocation) || data.currentLocation.length !== 2) {
          console.log('🚫 Motorista sem localização válida:', doc.id);
          return null;
        }
        return {
          id: doc.id,
          ...data
        } as Driver;
      }).filter(driver => driver !== null) as Driver[];

      console.log('🚗 Motoristas online:', drivers.length);
      setOnlineDrivers(drivers);
    }, (error) => {
      console.error('❌ Erro ao monitorar motoristas:', error);
    });

    return () => {
      console.log('🔄 Removendo listener de motoristas online');
      unsubscribe();
    };
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    let isMounted = true;

    // Carregar destinos rápidos
    const loadQuickDestinations = async () => {
      if (!user) return;
      
      try {
        const quickDestRef = collection(db, 'quickDestinations');
        const quickDestQuery = query(
          quickDestRef,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(4)
        );
        
        const snapshot = await getDocs(quickDestQuery);
        if (isMounted) {
          const destinations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setQuickDestinations(destinations);
        }
      } catch (error) {
        console.error('Erro ao carregar destinos rápidos:', error);
      }
    };

    // Carregar corridas recentes
    const loadRecentRides = async () => {
      if (!user) return;
      
      try {
        const ridesRef = collection(db, 'completedRides');
        const ridesQuery = query(
          ridesRef,
          where('userId', '==', user.uid),
          orderBy('completedAt', 'desc'),
          limit(3)
        );
        
        const snapshot = await getDocs(ridesQuery);
        if (isMounted) {
          const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Ride[];
          setRecentRides(rides);
        }
      } catch (error) {
        console.error('Erro ao carregar corridas recentes:', error);
      }
    };

    Promise.all([
      loadQuickDestinations(),
      loadRecentRides()
    ]).finally(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mapa com motoristas online */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Motoristas Próximos</h2>
            <div className="flex items-center text-sm text-gray-600">
              <Car className="w-4 h-4 mr-1" />
              <span>{onlineDrivers.length} online</span>
            </div>
          </div>
        </div>
        <div className="h-[300px]">
          <Map
            className="w-full h-full"
            onlineDrivers={onlineDrivers.map(driver => ({
              id: driver.id,
              currentLocation: driver.currentLocation,
              name: driver.name,
              vehicle: driver.vehicle,
              rating: driver.rating
            }))}
            showRoute={false}
            autoUpdate={false}
          />
        </div>
      </div>

      {/* Destinos rápidos */}
      {quickDestinations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Destinos rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {quickDestinations.map((dest) => (
              <Link
                key={dest.id}
                to={`/solicitar?dest=${encodeURIComponent(dest.destination.place)}`}
                className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-start space-x-3">
                  <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm sm:text-base truncate">{dest.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{dest.destination.address}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Corridas recentes */}
      {recentRides.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Corridas recentes</h2>
          <div className="space-y-3">
            {recentRides.map((ride) => (
              <Link
                key={ride.id}
                to={`/solicitar?dest=${encodeURIComponent(ride.destination.place)}`}
                className="block bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium">{ride.destination.place}</h3>
                      <p className="text-sm text-gray-500">{ride.destination.address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {formatFirestoreTimestamp(ride.completedAt)}
                    </p>
                    <p className="font-medium text-primary-600">
                      R$ {ride.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;