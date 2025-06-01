import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { RiDashboardLine, RiCarLine, RiUserLine, RiSettings4Line, RiLogoutBoxRLine, RiMenuLine, RiCloseLine, RiAwardLine } from 'react-icons/ri';
import { useAuth } from '../../contexts/AuthContext';

const AdminLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      name: 'Dashboard',
      path: '/admin',
      icon: <RiDashboardLine size={20} className="transition-transform duration-200 group-hover:scale-110" />
    },
    {
      name: 'Categorias',
      path: '/admin/categorias',
      icon: <RiCarLine size={20} className="transition-transform duration-200 group-hover:scale-110" />
    },
    {
      name: 'Motoristas',
      path: '/admin/motoristas',
      icon: <RiUserLine size={20} className="transition-transform duration-200 group-hover:scale-110" />
    },
    {
      name: 'Patrocinadores',
      path: '/admin/patrocinadores',
      icon: <RiAwardLine size={20} className="transition-transform duration-200 group-hover:scale-110" />
    },
    {
      name: 'Configurações',
      path: '/admin/configuracoes',
      icon: <RiSettings4Line size={20} className="transition-transform duration-200 group-hover:scale-110" />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen transition-transform 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
        bg-white border-r border-gray-200 w-64
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <Link to="/admin" className="flex items-center space-x-2">
            <RiCarLine className="text-primary-600" size={28} />
            <span className="text-xl font-bold font-heading text-gray-900">MobiGo</span>
          </Link>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`
                group flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                ${location.pathname === item.path 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              {item.icon}
              <span className="transition-transform duration-200 group-hover:translate-x-1">{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="group flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 w-full transition-colors duration-200"
          >
            <RiLogoutBoxRLine size={20} className="transition-transform duration-200 group-hover:rotate-12" />
            <span className="transition-transform duration-200 group-hover:translate-x-1">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="md:hidden text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            {isSidebarOpen ? <RiCloseLine size={24} /> : <RiMenuLine size={24} />}
          </button>
        </header>

        {/* Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 