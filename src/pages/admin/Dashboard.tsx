import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { RiUserLine, RiCarLine, RiTimeLine, RiMoneyDollarCircleLine } from 'react-icons/ri';
import AdminPageLayout from '../../components/layouts/AdminPageLayout';

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

const AdminDashboard = () => {
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

  const renderContent = () => (
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
  );

  return (
    <AdminPageLayout
      title="Dashboard"
      loading={loading}
      error={error}
    >
      {renderContent()}
    </AdminPageLayout>
  );
};

export default AdminDashboard; 