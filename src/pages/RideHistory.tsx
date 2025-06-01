import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Star, Calendar, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, getDocs, where, Timestamp, limit, startAfter } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { formatFirestoreTimestamp } from '../utils/date';

const RIDES_PER_PAGE = 10;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos em milissegundos

// Types
interface Ride {
  id: string;
  destination: {
    place: string;
    address: string;
  };
  date: string;
  price: number;
  duration: string;
  driverName: string;
  driverPhoto: string;
  rating: number;
  status: 'completed' | 'cancelled';
  type?: 'completed' | 'cancelled';
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  userId: string;
}

type FilterPeriod = 'all' | 'week' | 'month' | '3months';

const RideHistory = () => {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Função para carregar corridas do cache
  const loadFromCache = () => {
    const cachedData = localStorage.getItem('rideHistory');
    const cacheTimestamp = localStorage.getItem('rideHistoryTimestamp');
    
    if (cachedData && cacheTimestamp) {
      const isValid = Date.now() - Number(cacheTimestamp) < CACHE_DURATION;
      if (isValid) {
        return JSON.parse(cachedData);
      }
    }
    return null;
  };

  // Função para salvar corridas no cache
  const saveToCache = (ridesData: Ride[]) => {
    localStorage.setItem('rideHistory', JSON.stringify(ridesData));
    localStorage.setItem('rideHistoryTimestamp', Date.now().toString());
  };

  // Carregar corridas
  useEffect(() => {
    const loadRides = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Tentar carregar do cache primeiro
        const cachedRides = loadFromCache();
        if (cachedRides && filterPeriod === 'all') {
          setRides(cachedRides);
          setLoading(false);
          return;
        }

        // Criar query base para corridas completadas
        const completedRidesRef = collection(db, 'completedRides');
        const cancelledRidesRef = collection(db, 'cancelledRides');
        
        // Criar query base
        let completedQueryConstraints: any[] = [
          where('userId', '==', user.uid),
          orderBy('completedAt', 'desc'),
          limit(RIDES_PER_PAGE)
        ];

        let cancelledQueryConstraints: any[] = [
          where('userId', '==', user.uid),
          orderBy('cancelledAt', 'desc'),
          limit(RIDES_PER_PAGE)
        ];
        
        // Adicionar filtro por período
        if (filterPeriod !== 'all') {
          const now = new Date();
          let startDate = new Date();
          
          switch (filterPeriod) {
            case 'week':
              startDate.setDate(now.getDate() - 7);
              break;
            case 'month':
              startDate.setMonth(now.getMonth() - 1);
              break;
            case '3months':
              startDate.setMonth(now.getMonth() - 3);
              break;
          }
          
          completedQueryConstraints.push(where('completedAt', '>=', Timestamp.fromDate(startDate)));
          cancelledQueryConstraints.push(where('cancelledAt', '>=', Timestamp.fromDate(startDate)));
        }
        
        // Buscar corridas completadas e canceladas
        const completedQuery = query(completedRidesRef, ...completedQueryConstraints);
        const cancelledQuery = query(cancelledRidesRef, ...cancelledQueryConstraints);
        
        const [completedSnapshot, cancelledSnapshot] = await Promise.all([
          getDocs(completedQuery),
          getDocs(cancelledQuery)
        ]);
        
        // Combinar resultados
        const completedRides = completedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'completed'
        })) as unknown as Ride[];

        const cancelledRides = cancelledSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'cancelled'
        })) as unknown as Ride[];

        const allRides = [...completedRides, ...cancelledRides].sort((a, b) => {
          const dateA = a.type === 'completed' ? a.completedAt?.toDate() : a.cancelledAt?.toDate();
          const dateB = b.type === 'completed' ? b.completedAt?.toDate() : b.cancelledAt?.toDate();
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        });
        
        if (allRides.length < RIDES_PER_PAGE) {
          setHasMore(false);
        } else {
          setLastVisible({
            completed: completedSnapshot.docs[completedSnapshot.docs.length - 1],
            cancelled: cancelledSnapshot.docs[cancelledSnapshot.docs.length - 1]
          });
        }
        
        setRides(allRides);
        
        // Salvar no cache apenas se não houver filtro
        if (filterPeriod === 'all') {
          saveToCache(allRides);
        }
      } catch (error) {
        console.error('Erro ao carregar corridas:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRides();
  }, [user, filterPeriod]);

  // Função para carregar mais corridas
  const loadMoreRides = async () => {
    if (!user || !lastVisible || loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      
      const completedRidesRef = collection(db, 'completedRides');
      const cancelledRidesRef = collection(db, 'cancelledRides');

      let completedQueryConstraints: any[] = [
        where('userId', '==', user.uid),
        orderBy('completedAt', 'desc'),
        startAfter(lastVisible.completed),
        limit(RIDES_PER_PAGE)
      ];

      let cancelledQueryConstraints: any[] = [
        where('userId', '==', user.uid),
        orderBy('cancelledAt', 'desc'),
        startAfter(lastVisible.cancelled),
        limit(RIDES_PER_PAGE)
      ];
      
      if (filterPeriod !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filterPeriod) {
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case '3months':
            startDate.setMonth(now.getMonth() - 3);
            break;
        }
        
        completedQueryConstraints.push(where('completedAt', '>=', Timestamp.fromDate(startDate)));
        cancelledQueryConstraints.push(where('cancelledAt', '>=', Timestamp.fromDate(startDate)));
      }
      
      const completedQuery = query(completedRidesRef, ...completedQueryConstraints);
      const cancelledQuery = query(cancelledRidesRef, ...cancelledQueryConstraints);
      
      const [completedSnapshot, cancelledSnapshot] = await Promise.all([
        getDocs(completedQuery),
        getDocs(cancelledQuery)
      ]);
      
      if (completedSnapshot.empty && cancelledSnapshot.empty) {
        setHasMore(false);
      } else {
        setLastVisible({
          completed: completedSnapshot.docs[completedSnapshot.docs.length - 1],
          cancelled: cancelledSnapshot.docs[cancelledSnapshot.docs.length - 1]
        });
        
        const newCompletedRides = completedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'completed'
        })) as unknown as Ride[];

        const newCancelledRides = cancelledSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'cancelled'
        })) as unknown as Ride[];

        const newRides = [...newCompletedRides, ...newCancelledRides].sort((a, b) => {
          const dateA = a.type === 'completed' ? a.completedAt?.toDate() : a.cancelledAt?.toDate();
          const dateB = b.type === 'completed' ? b.completedAt?.toDate() : b.cancelledAt?.toDate();
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        });
        
        setRides(prevRides => [...prevRides, ...newRides]);
      }
    } catch (error) {
      console.error('Erro ao carregar mais corridas:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Filtrar corridas por busca
  const filteredRides = rides.filter(ride => 
    ride.destination.place.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ride.driverName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calcular total gasto no mês
  const getMonthTotal = () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return rides
      .filter(ride => new Date(ride.date) >= firstDayOfMonth)
      .reduce((total, ride) => total + ride.price, 0)
      .toFixed(2);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-primary-600 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/2422588/pexels-photo-2422588.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')] bg-cover bg-center opacity-10"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold font-heading mb-2">Histórico de Viagens</h1>
          <div className="flex items-center mt-4">
            <Calendar size={20} className="mr-2" />
            <p>Total gasto no mês: <span className="font-bold">R$ {getMonthTotal()}</span></p>
          </div>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="input pl-10"
            placeholder="Buscar por destino, motorista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="relative">
          <button
            className="btn-outline w-full flex items-center justify-between"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <span>
              {filterPeriod === 'all' && 'Todo o período'}
              {filterPeriod === 'week' && 'Última semana'}
              {filterPeriod === 'month' && 'Último mês'}
              {filterPeriod === '3months' && 'Últimos 3 meses'}
            </span>
            <ChevronDown size={18} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isFilterOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-100 z-10 animate-fade-in">
              <div className="py-2">
                {[
                  { value: 'all', label: 'Todo o período' },
                  { value: 'week', label: 'Última semana' },
                  { value: 'month', label: 'Último mês' },
                  { value: '3months', label: 'Últimos 3 meses' },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${filterPeriod === option.value ? 'bg-primary-50 text-primary-600' : ''}`}
                    onClick={() => {
                      setFilterPeriod(option.value as FilterPeriod);
                      setIsFilterOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Rides List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Carregando corridas...
          </div>
        ) : filteredRides.length > 0 ? (
          filteredRides.map(ride => (
            <Link
              key={ride.id}
              to={`/corrida/${ride.id}`}
              className="card hover:shadow-lg transition-shadow block"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-primary-100 text-primary-700">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{ride.destination.place}</p>
                    <p className="text-sm text-gray-500">
                      {ride.type === 'completed' 
                        ? (ride.completedAt ? formatFirestoreTimestamp(ride.completedAt) : 'Data não disponível')
                        : (ride.cancelledAt ? formatFirestoreTimestamp(ride.cancelledAt) : 'Data não disponível')}
                      {ride.type === 'cancelled' && ' (Cancelada)'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">R$ {ride.price.toFixed(2)}</p>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock size={14} className="mr-1" />
                    <span>{ride.duration}</span>
                  </div>
                </div>
              </div>
              
              {ride.type === 'completed' && (
                <div className="flex items-center space-x-3 mt-2 pt-3 border-t border-gray-100">
                  <img 
                    src={ride.driverPhoto} 
                    alt={ride.driverName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium">{ride.driverName}</p>
                    <div className="flex items-center">
                      <Star size={14} className="text-accent-400 mr-1" />
                      <span className="text-sm text-gray-600">{ride.rating}</span>
                    </div>
                  </div>
                </div>
              )}
            </Link>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma corrida encontrada
          </div>
        )}
        
        {hasMore && (
          <button
            onClick={loadMoreRides}
            disabled={loadingMore}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
          >
            {loadingMore ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
            ) : (
              <>
                Carregar mais
                <ChevronRight size={20} className="ml-2" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default RideHistory;