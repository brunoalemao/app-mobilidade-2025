import { Outlet } from 'react-router-dom';
import { Car } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left side - form */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-md animate-fade-in">
          <Outlet />
        </div>
      </div>
      
      {/* Right side - image and branding (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-primary-600 flex-col items-center justify-center p-12 relative">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/3776243/pexels-photo-3776243.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260')] bg-cover bg-center opacity-20"></div>
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center mb-6">
            <Car size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white font-heading mb-6">MobiGo</h1>
          <p className="text-white text-xl max-w-md">
            Sua mobilidade urbana rápida, segura e confiável. Vá para qualquer lugar com apenas alguns cliques.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;