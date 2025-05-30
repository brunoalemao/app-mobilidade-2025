import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';
import AdminLayout from './components/layouts/AdminLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import RideRequest from './pages/RideRequest';
import RideHistory from './pages/RideHistory';
import Profile from './pages/Profile';
import DriverRegister from './pages/DriverRegister';
import DriverHome from './pages/DriverHome';
import DriverPending from './pages/DriverPending';
import DriverProfile from './pages/driver/Profile';
import Dashboard from './pages/admin/Dashboard';
import Categories from './pages/admin/Categories';
import Drivers from './pages/admin/Drivers';
import Sponsors from './pages/admin/Sponsors';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './utils/firebase';
import { useEffect, useState } from 'react';
import { isMobileDevice, requestNotificationPermission } from './utils/notifications';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Driver route component
const DriverRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDriverStatus = async () => {
      if (user?.uid) {
        try {
          const driverDoc = await getDoc(doc(db, 'drivers', user.uid));
          if (driverDoc.exists()) {
            setDriverStatus(driverDoc.data().status);
          }
        } catch (error) {
          console.error('Erro ao verificar status do motorista:', error);
        }
        setLoading(false);
      }
    };

    checkDriverStatus();
  }, [user]);

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user || user.role !== 'driver') {
    return <Navigate to="/" replace />;
  }

  // Se o motorista estiver aprovado, não pode acessar a página pending
  if (driverStatus === 'approved' && location.pathname === '/driver/pending') {
    return <Navigate to="/driver/home" replace />;
  }

  // Se o motorista estiver pendente, só pode acessar a página pending
  if (driverStatus !== 'approved' && location.pathname !== '/driver/pending') {
    return <Navigate to="/driver/pending" replace />;
  }

  return <>{children}</>;
};

// Admin route component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user || user.email !== 'adm@gmail.com') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Passenger route component
const PassengerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user || user.role !== 'passenger') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  const { user } = useAuth();
  const [driverStatus, setDriverStatus] = useState<string | null>(null);

  useEffect(() => {
    const checkDriverStatus = async () => {
      if (user?.role === 'driver') {
        const driverDoc = await getDoc(doc(db, 'drivers', user.uid));
        if (driverDoc.exists()) {
          setDriverStatus(driverDoc.data().status);
        }
      }
    };

    if (user) {
      checkDriverStatus();
    }
  }, [user]);

  // Solicitar permissão de notificação ao iniciar o app em dispositivos móveis
  useEffect(() => {
    const checkNotificationPermission = async () => {
      if (isMobileDevice()) {
        const hasPermission = await requestNotificationPermission();
        if (hasPermission) {
          console.log('Permissão de notificação concedida');
        }
      }
    };

    checkNotificationPermission();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/driver/register" element={<DriverRegister />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={
            <AdminRoute>
              <Dashboard />
            </AdminRoute>
          } />
          <Route path="/admin/categorias" element={
            <AdminRoute>
              <Categories />
            </AdminRoute>
          } />
          <Route path="/admin/motoristas" element={
            <AdminRoute>
              <Drivers />
            </AdminRoute>
          } />
          <Route path="/admin/patrocinadores" element={
            <AdminRoute>
              <Sponsors />
            </AdminRoute>
          } />
        </Route>

        {/* Main Routes */}
        <Route element={<MainLayout />}>
          {/* Página inicial - redireciona baseado no tipo de usuário */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                {user?.email === 'adm@gmail.com' && <Navigate to="/admin" replace />}
                {user?.role === 'driver' && driverStatus === 'pending' && <Navigate to="/driver/pending" replace />}
                {user?.role === 'driver' && driverStatus === 'approved' && <Navigate to="/driver/home" replace />}
                {user?.role === 'passenger' && <Home />}
                {!user?.role && <Navigate to="/login" replace />}
              </ProtectedRoute>
            } 
          />

          {/* Passenger Routes */}
          <Route path="/solicitar" element={
            <PassengerRoute>
              <RideRequest />
            </PassengerRoute>
          } />
          <Route path="/historico" element={
            <PassengerRoute>
              <RideHistory />
            </PassengerRoute>
          } />
          <Route path="/perfil" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          {/* Driver Routes */}
          <Route path="/driver/home" element={
            <DriverRoute>
              <DriverHome />
            </DriverRoute>
          } />
          <Route path="/driver/pending" element={
            <DriverRoute>
              <DriverPending />
            </DriverRoute>
          } />
          <Route path="/driver/profile" element={
            <DriverRoute>
              <DriverProfile />
            </DriverRoute>
          } />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" />
    </div>
  );
};

export default App;