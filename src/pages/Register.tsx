import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Lock, Phone, Loader } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { toast } from 'react-hot-toast';

// Form validation schema
const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirme sua senha'),
  terms: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar os termos e condições',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });
  
  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      console.log('Iniciando cadastro de usuário:', { name: data.name, email: data.email });
      
      // Registrar usuário como passageiro
      await registerUser(data.name, data.email, data.password, data.phone, 'passenger');
      
      // Mostrar mensagem de sucesso
      toast.success('Conta criada com sucesso! Redirecionando...');
      
      // Pequeno delay antes do redirecionamento para garantir que o usuário veja a mensagem
      setTimeout(() => {
        // Redirecionar para a página inicial
        navigate('/', { replace: true });
      }, 1500);
      
    } catch (err) {
      console.error('Erro no cadastro:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao registrar';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading mb-2">Crie sua conta</h1>
        <p className="text-gray-600">Comece a usar o MobiGo hoje mesmo</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-error-50 border border-error-200 text-error-700 rounded-lg animate-fade-in">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome completo
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User size={18} className="text-gray-400" />
            </div>
            <input
              id="name"
              type="text"
              className={`input pl-10 ${errors.name ? 'border-error-500 focus:ring-error-500' : ''}`}
              placeholder="Seu nome completo"
              {...register('name')}
            />
          </div>
          {errors.name && (
            <p className="text-error-600 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail size={18} className="text-gray-400" />
            </div>
            <input
              id="email"
              type="email"
              className={`input pl-10 ${errors.email ? 'border-error-500 focus:ring-error-500' : ''}`}
              placeholder="seu@email.com"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="text-error-600 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Telefone
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone size={18} className="text-gray-400" />
            </div>
            <input
              id="phone"
              type="tel"
              className={`input pl-10 ${errors.phone ? 'border-error-500 focus:ring-error-500' : ''}`}
              placeholder="(11) 99999-9999"
              {...register('phone')}
            />
          </div>
          {errors.phone && (
            <p className="text-error-600 text-sm mt-1">{errors.phone.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock size={18} className="text-gray-400" />
            </div>
            <input
              id="password"
              type="password"
              className={`input pl-10 ${errors.password ? 'border-error-500 focus:ring-error-500' : ''}`}
              placeholder="••••••"
              {...register('password')}
            />
          </div>
          {errors.password && (
            <p className="text-error-600 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirmar senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock size={18} className="text-gray-400" />
            </div>
            <input
              id="confirmPassword"
              type="password"
              className={`input pl-10 ${errors.confirmPassword ? 'border-error-500 focus:ring-error-500' : ''}`}
              placeholder="••••••"
              {...register('confirmPassword')}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-error-600 text-sm mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>
        
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="terms"
              type="checkbox"
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              {...register('terms')}
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="terms" className={`font-medium ${errors.terms ? 'text-error-700' : 'text-gray-700'}`}>
              Eu aceito os <a href="#" className="text-primary-600 hover:text-primary-500">Termos de Serviço</a> e a{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">Política de Privacidade</a>
            </label>
            {errors.terms && (
              <p className="text-error-600 mt-1">{errors.terms.message}</p>
            )}
          </div>
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full flex justify-center mt-6"
        >
          {isSubmitting ? (
            <Loader className="animate-spin" size={24} />
          ) : (
            'Criar conta'
          )}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;