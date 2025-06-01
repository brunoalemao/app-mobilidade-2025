import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Car } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';
import Map from '../components/Map';
import { toast } from 'react-hot-toast';

// Types
interface Driver {
  id: string;
  currentLocation: [number, number];
  name: string;
  vehicle?: {
    model: string;
    plate: string;
    color: string;
  };
  rating?: number;
  lastUpdate: Date;
  isOnline: boolean;
  status: string;
}

const Home = () => {
  const { user } = useAuth();
  const [quickDestinations, setQuickDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[]>([]);

  // Monitorar motoristas online
  useEffect(() => {
    console.log('🔄 Iniciando monitoramento de motoristas online...');

    const driversRef = collection(db, 'drivers');
    const onlineDriversQuery = query(
      driversRef,
      where('status', '==', 'approved'),
      where('isOnline', '==', true)
    );

    const unsubscribe = onSnapshot(onlineDriversQuery, (snapshot) => {
      console.log('📥 Dados recebidos do Firestore:', snapshot.docs.length, 'motoristas');
      
      const drivers = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('🚗 Dados do motorista:', {
          id: doc.id,
          name: data.name,
          isOnline: data.isOnline,
          status: data.status,
          currentLocation: data.currentLocation,
          lastUpdate: data.lastUpdate?.toDate()
        });
        
        // Verificar se a localização é válida
        if (!data.currentLocation || !Array.isArray(data.currentLocation) || data.currentLocation.length !== 2) {
          console.warn('⚠️ Localização inválida para motorista:', doc.id);
          return null;
        }
        
        return {
          id: doc.id,
          currentLocation: data.currentLocation as [number, number],
          name: data.name || 'Motorista',
          vehicle: data.vehicle || {
            model: 'Veículo não informado',
            plate: '',
            color: ''
          },
          rating: data.rating || 0,
          lastUpdate: data.lastUpdate?.toDate() || new Date(),
          isOnline: data.isOnline || false,
          status: data.status || 'approved'
        } as Driver;
      }).filter((driver): driver is Driver => {
        if (!driver) return false;
        
        // Aumentar o tempo de inatividade para 15 minutos
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const isRecent = !driver.lastUpdate || driver.lastUpdate > fifteenMinutesAgo;
        
        if (!isRecent) {
          console.log('⚠️ Motorista removido por inatividade:', {
            id: driver.id,
            lastUpdate: driver.lastUpdate,
            threshold: fifteenMinutesAgo
          });
        } else {
          console.log('✅ Motorista ativo:', {
            id: driver.id,
            lastUpdate: driver.lastUpdate
          });
        }
        
        return isRecent;
      });

      console.log('✅ Motoristas filtrados e processados:', {
        total: drivers.length,
        motoristas: drivers.map(d => ({
          id: d.id,
          name: d.name,
          currentLocation: d.currentLocation
        }))
      });
      setOnlineDrivers(drivers);
    }, (error) => {
      console.error('❌ Erro ao monitorar motoristas:', error);
      toast.error('Erro ao atualizar motoristas próximos');
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
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadQuickDestinations();

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
            onlineDrivers={onlineDrivers.map(driver => {
              console.log('🚗 Passando dados do motorista para o mapa:', {
                id: driver.id,
                currentLocation: driver.currentLocation,
                name: driver.name,
                vehicle: driver.vehicle
              });
              return {
                id: driver.id,
                currentLocation: driver.currentLocation,
                name: driver.name,
                vehicle: driver.vehicle,
                rating: driver.rating
              };
            })}
          />
        </div>
      </div>

      {/* Destinos rápidos */}
      {quickDestinations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Destinos rápidos</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickDestinations.map((dest) => (
              <Link
                key={dest.id}
                to={`/solicitar?dest=${encodeURIComponent(dest.destination.place)}`}
                className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-start space-x-3">
                  <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium">{dest.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{dest.destination.address}</p>
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