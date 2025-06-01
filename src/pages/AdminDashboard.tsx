import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Car, CheckCircle, XCircle, Clock, DollarSign, Cloud, Sun, X } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { toast } from 'react-hot-toast';

// Tipos
interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
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
      start: string; // formato "HH:mm"
      end: string; // formato "HH:mm"
    }[];
  };
}

interface Stats {
  totalUsers: number;
  totalDrivers: number;
  activeDrivers: number;
  pendingDrivers: number;
  todayRides: number;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    pendingDrivers: 0,
    todayRides: 0
  });
  const [loading, setLoading] = useState(true);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VehicleCategory | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<VehicleCategory>>({
    name: '',
    description: '',
    basePrice: 0,
    pricePerKm: 0,
    pricePerMinute: 0,
    minPrice: 0,
    icon: '🚗',
    dynamicPricing: {
      rainMultiplier: 1.2,
      peakHoursMultiplier: 1.5,
      peakHours: [
        { start: "07:00", end: "09:00" },
        { start: "17:00", end: "19:00" }
      ]
    }
  });

  // Se não for admin, redirecionar para página inicial
  if (!user || user.email !== 'adm@gmail.com') {
    return <Navigate to="/" replace />;
  }

  // Carregar estatísticas, motoristas e categorias
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Buscar usuários
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const totalUsers = usersSnapshot.size;

        // Buscar motoristas
        const driversRef = collection(db, 'drivers');
        const driversSnapshot = await getDocs(driversRef);
        const allDrivers = driversSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Driver[];

        // Buscar categorias de veículos
        const categoriesRef = collection(db, 'vehicleCategories');
        const categoriesSnapshot = await getDocs(categoriesRef);
        const loadedCategories = categoriesSnapshot.docs.map(doc => {
          const data = doc.data();
          // Garantir valores padrão para todos os campos
          return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            basePrice: data.basePrice || 0,
            pricePerKm: data.pricePerKm || 0,
            pricePerMinute: data.pricePerMinute || 0,
            minPrice: data.minPrice || 0,
            icon: data.icon || '🚗',
            dynamicPricing: {
              rainMultiplier: data.dynamicPricing?.rainMultiplier || 1.2,
              peakHoursMultiplier: data.dynamicPricing?.peakHoursMultiplier || 1.5,
              peakHours: data.dynamicPricing?.peakHours || [
                { start: "07:00", end: "09:00" },
                { start: "17:00", end: "19:00" }
              ]
            }
          } as VehicleCategory;
        });

        // Limpar cache se não houver categorias
        if (loadedCategories.length === 0) {
          localStorage.removeItem('vehicleCategories');
          localStorage.removeItem('vehicleCategoriesTimestamp');
        } else {
          // Atualizar cache apenas se houver categorias
          localStorage.setItem('vehicleCategories', JSON.stringify(loadedCategories));
          localStorage.setItem('vehicleCategoriesTimestamp', Date.now().toString());
        }

        setCategories(loadedCategories);

        // Buscar corridas de hoje
        const ridesRef = collection(db, 'rides');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const q = query(ridesRef, where('createdAt', '>=', today));
        const ridesSnapshot = await getDocs(q);

        // Atualizar estatísticas
        setStats({
          totalUsers: totalUsers,
          totalDrivers: driversSnapshot.size,
          activeDrivers: allDrivers.filter(d => d.status === 'approved').length,
          pendingDrivers: allDrivers.filter(d => d.status === 'pending').length,
          todayRides: ridesSnapshot.size
        });

        // Filtrar apenas motoristas pendentes para a tabela
        const pendingDrivers = allDrivers.filter(d => d.status === 'pending');
        setDrivers(pendingDrivers);

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
        // Limpar cache em caso de erro
        localStorage.removeItem('vehicleCategories');
        localStorage.removeItem('vehicleCategoriesTimestamp');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleApproveDriver = async (driverId: string) => {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      await updateDoc(driverRef, {
        status: 'approved',
        approvedAt: Timestamp.now()
      });
      
      setDrivers(prev => prev.filter(d => d.id !== driverId));
      toast.success('Motorista aprovado com sucesso!');
    } catch (error) {
      console.error('Erro ao aprovar motorista:', error);
      toast.error('Erro ao aprovar motorista');
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      await updateDoc(driverRef, {
        status: 'rejected',
        rejectedAt: Timestamp.now()
      });
      
      setDrivers(prev => prev.filter(d => d.id !== driverId));
      toast.success('Motorista rejeitado com sucesso!');
    } catch (error) {
      console.error('Erro ao rejeitar motorista:', error);
      toast.error('Erro ao rejeitar motorista');
    }
  };

  const handleSaveCategory = async () => {
    try {
      if (!newCategory.name || !newCategory.description) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      // Garantir que todos os campos numéricos são válidos e não são undefined
      const categoryData = {
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        basePrice: Number(newCategory.basePrice) || 0,
        pricePerKm: Number(newCategory.pricePerKm) || 0,
        pricePerMinute: Number(newCategory.pricePerMinute) || 0,
        minPrice: Number(newCategory.minPrice) || 0,
        icon: newCategory.icon || '🚗',
        dynamicPricing: {
          rainMultiplier: Number(newCategory.dynamicPricing?.rainMultiplier) || 1.2,
          peakHoursMultiplier: Number(newCategory.dynamicPricing?.peakHoursMultiplier) || 1.5,
          peakHours: Array.isArray(newCategory.dynamicPricing?.peakHours) ? 
            newCategory.dynamicPricing.peakHours : [
              { start: "07:00", end: "09:00" },
              { start: "17:00", end: "19:00" }
            ]
        },
        createdAt: Timestamp.now()
      };

      console.log('Dados formatados da categoria:', categoryData);

      if (editingCategory) {
        // Atualizar categoria existente
        const categoryRef = doc(db, 'vehicleCategories', editingCategory.id);
        await updateDoc(categoryRef, {
          ...categoryData,
          updatedAt: Timestamp.now()
        });
        toast.success('Categoria atualizada com sucesso!');
      } else {
        // Criar nova categoria
        const categoriesRef = collection(db, 'vehicleCategories');
        const docRef = await addDoc(categoriesRef, categoryData);
        console.log('Nova categoria criada com ID:', docRef.id);
        toast.success('Categoria criada com sucesso!');
      }

      // Forçar limpeza do cache
      localStorage.removeItem('vehicleCategories');
      localStorage.removeItem('vehicleCategoriesTimestamp');

      // Recarregar categorias
      const categoriesRef = collection(db, 'vehicleCategories');
      const categoriesSnapshot = await getDocs(categoriesRef);
      const loadedCategories = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        basePrice: Number(doc.data().basePrice) || 0,
        pricePerKm: Number(doc.data().pricePerKm) || 0,
        pricePerMinute: Number(doc.data().pricePerMinute) || 0,
        minPrice: Number(doc.data().minPrice) || 0,
        dynamicPricing: {
          rainMultiplier: Number(doc.data().dynamicPricing?.rainMultiplier) || 1.2,
          peakHoursMultiplier: Number(doc.data().dynamicPricing?.peakHoursMultiplier) || 1.5,
          peakHours: Array.isArray(doc.data().dynamicPricing?.peakHours) ? 
            doc.data().dynamicPricing.peakHours : [
              { start: "07:00", end: "09:00" },
              { start: "17:00", end: "19:00" }
            ]
        }
      })) as VehicleCategory[];

      setCategories(loadedCategories);

      // Resetar estado
      setNewCategory({
        name: '',
        description: '',
        basePrice: 0,
        pricePerKm: 0,
        pricePerMinute: 0,
        minPrice: 0,
        icon: '🚗',
        dynamicPricing: {
          rainMultiplier: 1.2,
          peakHoursMultiplier: 1.5,
          peakHours: [
            { start: "07:00", end: "09:00" },
            { start: "17:00", end: "19:00" }
          ]
        }
      });
      setShowNewCategoryModal(false);
      setEditingCategory(null);

      // Forçar recarregamento da página para atualizar os dados
      window.location.reload();
    } catch (error) {
      console.error('Erro detalhado ao salvar categoria:', error);
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    try {
      await deleteDoc(doc(db, 'vehicleCategories', categoryId));
      
      // Atualizar estado local
      const updatedCategories = categories.filter(c => c.id !== categoryId);
      setCategories(updatedCategories);

      // Atualizar cache
      if (updatedCategories.length === 0) {
        localStorage.removeItem('vehicleCategories');
        localStorage.removeItem('vehicleCategoriesTimestamp');
      } else {
        localStorage.setItem('vehicleCategories', JSON.stringify(updatedCategories));
        localStorage.setItem('vehicleCategoriesTimestamp', Date.now().toString());
      }

      toast.success('Categoria excluída com sucesso!');

      // Forçar recarregamento dos dados
      window.location.reload();
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast.error('Erro ao excluir categoria');
    }
  };

  const handleEditCategory = (category: VehicleCategory) => {
    setEditingCategory(category);
    setNewCategory(category);
    setShowNewCategoryModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Painel Administrativo</h1>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <Users size={24} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Total de Usuários</h3>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <Car size={24} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Total de Motoristas</h3>
              <p className="text-2xl font-bold">{stats.totalDrivers}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <Car size={24} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Motoristas Ativos</h3>
              <p className="text-2xl font-bold">{stats.activeDrivers}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <Clock size={24} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Aprovações Pendentes</h3>
              <p className="text-2xl font-bold">{stats.pendingDrivers}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <CheckCircle size={24} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm">Corridas Hoje</h3>
              <p className="text-2xl font-bold">{stats.todayRides}</p>
            </div>
          </div>

          {/* Vehicle Categories Section */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Categorias de Veículos</h2>
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setNewCategory({
                      name: '',
                      description: '',
                      basePrice: 0,
                      pricePerKm: 0,
                      pricePerMinute: 0,
                      minPrice: 0,
                      icon: '🚗',
                      dynamicPricing: {
                        rainMultiplier: 1.2,
                        peakHoursMultiplier: 1.5,
                        peakHours: [
                          { start: "07:00", end: "09:00" },
                          { start: "17:00", end: "19:00" }
                        ]
                      }
                    });
                    setShowNewCategoryModal(true);
                  }}
                  className="btn-primary"
                >
                  Nova Categoria
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Nome</th>
                      <th className="text-left py-3 px-4">Descrição</th>
                      <th className="text-left py-3 px-4">Preço Base</th>
                      <th className="text-left py-3 px-4">Preço/km</th>
                      <th className="text-left py-3 px-4">Preço/min</th>
                      <th className="text-left py-3 px-4">Preço Mínimo</th>
                      <th className="text-left py-3 px-4">Multiplicadores</th>
                      <th className="text-right py-3 px-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(category => (
                      <tr key={category.id} className="border-b">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <span className="mr-2">{category.icon}</span>
                            {category.name}
                          </div>
                        </td>
                        <td className="py-3 px-4">{category.description}</td>
                        <td className="py-3 px-4">R$ {category.basePrice.toFixed(2)}</td>
                        <td className="py-3 px-4">R$ {category.pricePerKm.toFixed(2)}/km</td>
                        <td className="py-3 px-4">R$ {category.pricePerMinute.toFixed(2)}/min</td>
                        <td className="py-3 px-4">R$ {category.minPrice.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center" title="Multiplicador de chuva">
                              <Cloud size={16} className="mr-1 text-blue-500" />
                              {category.dynamicPricing.rainMultiplier}x
                            </div>
                            <div className="flex items-center" title="Multiplicador de horário de pico">
                              <Clock size={16} className="mr-1 text-orange-500" />
                              {category.dynamicPricing.peakHoursMultiplier}x
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="btn-secondary text-sm mr-2"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="btn-error text-sm"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Drivers Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-6">Motoristas Pendentes</h2>
              <div className="overflow-x-auto">
                {drivers.length > 0 ? (
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Nome</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Telefone</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-right py-3 px-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map(driver => (
                        <tr key={driver.id} className="border-b">
                          <td className="py-3 px-4">{driver.name}</td>
                          <td className="py-3 px-4">{driver.email}</td>
                          <td className="py-3 px-4">{driver.phone}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                              Pendente
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleApproveDriver(driver.id)}
                              className="btn-success text-sm mr-2"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleRejectDriver(driver.id)}
                              className="btn-error text-sm"
                            >
                              Rejeitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum motorista pendente no momento
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de Nova Categoria */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  placeholder="Ex: Econômico"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full"
                  placeholder="Ex: Carros compactos para até 4 pessoas"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço Base (até 3km)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">R$</span>
                    </div>
                    <input
                      type="number"
                      value={newCategory.basePrice}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, basePrice: parseFloat(e.target.value) }))}
                      className="input pl-10 w-full"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço por KM (após 3km)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">R$</span>
                    </div>
                    <input
                      type="number"
                      value={newCategory.pricePerKm}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, pricePerKm: parseFloat(e.target.value) }))}
                      className="input pl-10 w-full"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço por Minuto
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">R$</span>
                    </div>
                    <input
                      type="number"
                      value={newCategory.pricePerMinute}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, pricePerMinute: parseFloat(e.target.value) }))}
                      className="input pl-10 w-full"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ícone
                </label>
                <input
                  type="text"
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, icon: e.target.value }))}
                  className="input w-full"
                  placeholder="Ex: 🚗"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Preços Dinâmicos</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Multiplicador de Chuva
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newCategory.dynamicPricing?.rainMultiplier}
                        onChange={(e) => setNewCategory(prev => ({
                          ...prev,
                          dynamicPricing: {
                            ...prev.dynamicPricing!,
                            rainMultiplier: parseFloat(e.target.value)
                          }
                        }))}
                        className="input w-full"
                        placeholder="1.2"
                        step="0.1"
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Multiplicador de Horário de Pico
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newCategory.dynamicPricing?.peakHoursMultiplier}
                        onChange={(e) => setNewCategory(prev => ({
                          ...prev,
                          dynamicPricing: {
                            ...prev.dynamicPricing!,
                            peakHoursMultiplier: parseFloat(e.target.value)
                          }
                        }))}
                        className="input w-full"
                        placeholder="1.5"
                        step="0.1"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horários de Pico
                  </label>
                  {newCategory.dynamicPricing?.peakHours.map((period, index) => (
                    <div key={index} className="flex items-center space-x-4 mb-2">
                      <input
                        type="time"
                        value={period.start}
                        onChange={(e) => {
                          const newPeakHours = [...newCategory.dynamicPricing!.peakHours];
                          newPeakHours[index] = { ...period, start: e.target.value };
                          setNewCategory(prev => ({
                            ...prev,
                            dynamicPricing: {
                              ...prev.dynamicPricing!,
                              peakHours: newPeakHours
                            }
                          }));
                        }}
                        className="input"
                      />
                      <span>até</span>
                      <input
                        type="time"
                        value={period.end}
                        onChange={(e) => {
                          const newPeakHours = [...newCategory.dynamicPricing!.peakHours];
                          newPeakHours[index] = { ...period, end: e.target.value };
                          setNewCategory(prev => ({
                            ...prev,
                            dynamicPricing: {
                              ...prev.dynamicPricing!,
                              peakHours: newPeakHours
                            }
                          }));
                        }}
                        className="input"
                      />
                      <button
                        onClick={() => {
                          const newPeakHours = newCategory.dynamicPricing!.peakHours.filter((_, i) => i !== index);
                          setNewCategory(prev => ({
                            ...prev,
                            dynamicPricing: {
                              ...prev.dynamicPricing!,
                              peakHours: newPeakHours
                            }
                          }));
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newPeakHours = [...newCategory.dynamicPricing!.peakHours, { start: "00:00", end: "00:00" }];
                      setNewCategory(prev => ({
                        ...prev,
                        dynamicPricing: {
                          ...prev.dynamicPricing!,
                          peakHours: newPeakHours
                        }
                      }));
                    }}
                    className="btn-secondary text-sm mt-2"
                  >
                    Adicionar Horário de Pico
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="btn-outline"
              >
                Cancelar
              </button>
              <button onClick={handleSaveCategory} className="btn-primary">
                {editingCategory ? 'Atualizar' : 'Criar'} Categoria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 