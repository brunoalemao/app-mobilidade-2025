import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { User as UserIcon, Mail, Phone, CreditCard, Shield, Map, LogOut } from 'lucide-react';
import ChevronRight from '../components/icons/ChevronRight';
import Alert from '../components/Alert';
import FormField from '../components/form/FormField';

// Form validation schema
const profileSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Profile = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  });
  
  const onSubmit = async (data: ProfileFormData) => {
    // In a real app, this would call an API to update the user profile
    console.log('Profile updated:', data);
    
    // Show success message
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setIsEditing(false);
    }, 2000);
  };
  
  // Payment methods
  const paymentMethods = [
    { id: 1, type: 'credit', last4: '4242', brand: 'Visa', isDefault: true },
    { id: 2, type: 'credit', last4: '1234', brand: 'Mastercard', isDefault: false },
  ];
  
  // Menu items
  const menuItems = [
    { icon: <Map size={20} />, label: 'Endereços favoritos', action: () => console.log('Endereços') },
    { icon: <Shield size={20} />, label: 'Segurança', action: () => console.log('Segurança') },
    { icon: <LogOut size={20} />, label: 'Sair da conta', action: logout, className: 'text-error-600' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {success && (
        <Alert
          type="success"
          message="Perfil atualizado com sucesso!"
          className="fixed top-4 right-4 shadow-md"
        />
      )}
      
      {/* Profile Info */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-heading">Seu Perfil</h1>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-outline"
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
        </div>
        
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              id="name"
              label="Nome completo"
              type="text"
              placeholder="Seu nome completo"
              icon={UserIcon}
              register={register}
              error={errors.name}
            />
            
            <FormField
              id="email"
              label="Email"
              type="email"
              placeholder="seu@email.com"
              icon={Mail}
              register={register}
              error={errors.email}
            />
            
            <FormField
              id="phone"
              label="Telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              icon={Phone}
              register={register}
              error={errors.phone}
            />
            
            <div className="pt-4">
              <button type="submit" className="btn-primary w-full">
                Salvar Alterações
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 mr-6">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name || 'Usuário'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary-100 text-primary-600">
                    <UserIcon size={32} />
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-xl font-semibold">{user?.name || 'Usuário'}</h2>
                <div className="space-y-2 mt-2 text-gray-600">
                  <div className="flex items-center">
                    <Mail size={16} className="mr-2" />
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone size={16} className="mr-2" />
                    <span>{user?.phone || 'Não informado'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Membro desde</p>
              <p>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'Data não disponível'}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Payment Methods */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold font-heading">Formas de Pagamento</h2>
          <button className="btn-outline">Adicionar</button>
        </div>
        
        <div className="space-y-4">
          {paymentMethods.map(method => (
            <div 
              key={method.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center mr-4">
                  <CreditCard size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">
                    {method.brand} •••• {method.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    {method.type === 'credit' ? 'Cartão de Crédito' : 'Cartão de Débito'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                {method.isDefault && (
                  <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-1 rounded mr-2">
                    Padrão
                  </span>
                )}
                <button className="text-gray-400 hover:text-gray-600">
                  <span className="sr-only">Menu</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="5" r="1"></circle>
                    <circle cx="12" cy="19" r="1"></circle>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Additional Options */}
      <div className="card">
        <h2 className="text-xl font-semibold font-heading mb-6">Opções</h2>
        
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-left ${item.className || ''}`}
            >
              <div className="flex items-center">
                <span className="mr-3">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;