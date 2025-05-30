import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { RiUserLine, RiCarLine, RiTimeLine, RiMoneyDollarCircleLine } from 'react-icons/ri';

interface Stats {
  totalUsers: number;
  totalDrivers: number;
  onlineDrivers: number;
  pendingDrivers: number;
  todayRides: number;
  totalRevenue: number;
  weeklyRides: number[];
}

interface OnlineDriver {
  id: string;
  isOnline: boolean;
  lastUpdate?: Timestamp;
  status: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDrivers: 0,
    onlineDrivers: 0,
    pendingDrivers: 0,
    todayRides: 0,
    totalRevenue: 0,
    weeklyRides: [0, 0, 0, 0, 0, 0, 0]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    // Atualizar a cada 30 segundos para manter o número de motoristas online atualizado
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Carregando estatísticas...');

      // Buscar usuários
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const totalUsers = usersSnapshot.size;

      console.log('👥 Total de usuários:', totalUsers);

      // Buscar motoristas
      const driversRef = collection(db, 'drivers');
      const driversSnapshot = await getDocs(driversRef);
      const allDrivers = driversSnapshot.docs;
      const totalDrivers = allDrivers.length;
      const pendingDrivers = allDrivers.filter(doc => doc.data().status === 'pending').length;

      console.log('🚗 Dados dos motoristas:', {
        total: totalDrivers,
        pendentes: pendingDrivers
      });

      // Buscar motoristas online
      const onlineDriversQuery = query(
        driversRef,
        where('status', '==', 'approved'),
        where('isOnline', '==', true)
      );

      console.log('🔍 Buscando motoristas online...');
      
      const onlineDriversSnapshot = await getDocs(onlineDriversQuery);
      const onlineDrivers = onlineDriversSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OnlineDriver[];

      console.log('🚦 Motoristas online encontrados:', {
        total: onlineDrivers.length,
        motoristas: onlineDrivers.map(d => ({
          id: d.id,
          isOnline: d.isOnline,
          lastUpdate: d.lastUpdate?.toDate(),
          status: d.status
        }))
      });

      // Buscar corridas do dia
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ridesRef = collection(db, 'completedRides');
      const todayRidesQuery = query(
        ridesRef,
        where('completedAt', '>=', Timestamp.fromDate(today))
      );
      const todayRidesSnapshot = await getDocs(todayRidesQuery);
      const todayRides = todayRidesSnapshot.size;

      console.log('🎯 Corridas hoje:', todayRides);

      // Calcular receita total
      let totalRevenue = 0;
      todayRidesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.price) {
          totalRevenue += data.price;
        }
      });

      // Buscar corridas da semana
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const weeklyRidesQuery = query(
        ridesRef,
        where('completedAt', '>=', Timestamp.fromDate(weekStart))
      );
      const weeklyRidesSnapshot = await getDocs(weeklyRidesQuery);
      
      // Agrupar corridas por dia da semana
      const weeklyRides = new Array(7).fill(0);
      weeklyRidesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.completedAt) {
          const date = data.completedAt.toDate();
          const dayIndex = 6 - Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          if (dayIndex >= 0 && dayIndex < 7) {
            weeklyRides[dayIndex]++;
          }
        }
      });

      console.log('📊 Estatísticas calculadas:', {
        totalUsers,
        totalDrivers,
        onlineDrivers: onlineDrivers.length,
        pendingDrivers,
        todayRides,
        totalRevenue,
        weeklyRides
      });

      setStats({
        totalUsers,
        totalDrivers,
        onlineDrivers: onlineDrivers.length,
        pendingDrivers,
        todayRides,
        totalRevenue,
        weeklyRides
      });

    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      setError('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {error ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando estatísticas...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <RiUserLine size={24} className="transform rotate-0 transition-transform duration-200 hover:rotate-12" />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Total de Usuários</h3>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-lg text-green-600">
                  <RiCarLine size={24} className="transform rotate-0 transition-transform duration-200 hover:-translate-x-1" />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Motoristas Online</h3>
              <p className="text-2xl font-bold">{stats.onlineDrivers}</p>
              <p className="text-sm text-gray-500 mt-1">de {stats.totalDrivers} motoristas</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <RiTimeLine size={24} className="transform rotate-0 transition-transform duration-200 hover:rotate-180" />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Corridas Hoje</h3>
              <p className="text-2xl font-bold">{stats.todayRides}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <RiMoneyDollarCircleLine size={24} className="transform rotate-0 transition-transform duration-200 hover:scale-110" />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Receita Hoje</h3>
              <p className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Weekly Rides Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Corridas da Semana</h3>
            <div className="h-64">
              <div className="flex h-full items-end space-x-2">
                {stats.weeklyRides.map((rides, index) => {
                  const height = rides > 0 ? (rides / Math.max(...stats.weeklyRides)) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-primary-100 rounded-t"
                        style={{ height: `${height}%` }}
                      ></div>
                      <p className="text-xs text-gray-500 mt-2">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][index]}
                      </p>
                      <p className="text-xs font-medium">{rides}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard; 