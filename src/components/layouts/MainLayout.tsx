import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Car, Home, MapPin, User, Clock, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isAdmin = user?.email === 'adm@gmail.com';
  const isDriver = user?.role === 'driver';

  // Menu items para passageiros
  const passengerNavItems = [
    { name: 'Início', path: '/', icon: <Home size={20} /> },
    { name: 'Solicitar', path: '/solicitar', icon: <MapPin size={20} /> },
    { name: 'Histórico', path: '/historico', icon: <Clock size={20} /> },
    { name: 'Perfil', path: '/perfil', icon: <User size={20} /> },
  ];

  // Menu items para motoristas
  const driverNavItems = [
    { name: 'Painel', path: '/driver/home', icon: <Home size={20} /> },
    { name: 'Perfil', path: '/perfil', icon: <User size={20} /> },
  ];

  // Seleciona os itens de menu baseado no tipo de usuário
  const navItems = isDriver ? driverNavItems : passengerNavItems;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Car className="text-primary-600" size={28} />
            <span className="text-xl font-bold font-heading text-gray-900">MobiGo</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {!isAdmin && navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-1 text-sm font-medium ${
                  location.pathname === item.path 
                    ? 'text-primary-600' 
                    : 'text-gray-600 hover:text-primary-600'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-primary-600"
            >
              <LogOut size={20} />
              <span>Sair</span>
            </button>
          </nav>
          
          {/* Mobile Menu Button */}
          {!isAdmin && (
            <button 
              className="md:hidden text-gray-600"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>
      </header>
      
      {/* Mobile Menu */}
      {!isAdmin && isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 animate-fade-in">
          <nav className="container mx-auto py-4 px-6 flex flex-col space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 p-2 rounded-lg ${
                  location.pathname === item.path 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={closeMobileMenu}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 p-2 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <LogOut size={20} />
              <span>Sair</span>
            </button>
          </nav>
        </div>
      )}
      
      {/* Main Content */}
      <main className="flex-1 container mx-auto p-6">
        <Outlet />
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6">
        <div className="container mx-auto text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} MobiGo - Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;