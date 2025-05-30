import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Lock, Phone, Car, FileText, AlertCircle } from 'lucide-react';
import { collection, addDoc, Timestamp, setDoc, doc } from 'firebase/firestore';
import { db, auth } from '../utils/firebase';
import { toast } from 'react-hot-toast';

// Form validation schema
const driverRegisterSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirme sua senha'),
  cpf: z.string().min(11, 'CPF inválido'),
  cnh: z.string().min(11, 'CNH inválida'),
  carModel: z.string().min(3, 'Modelo do carro é obrigatório'),
  carYear: z.string().min(4, 'Ano do carro é obrigatório'),
  carPlate: z.string().min(7, 'Placa do carro é obrigatória'),
  carColor: z.string().min(3, 'Cor do carro é obrigatória'),
  terms: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar os termos e condições',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type DriverRegisterFormData = z.infer<typeof driverRegisterSchema>;

const DriverRegister = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<DriverRegisterFormData>({
    resolver: zodResolver(driverRegisterSchema),
  });

  const onSubmit = async (data: DriverRegisterFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      console.log('Tentando registrar motorista com dados:', {
        name: data.name,
        email: data.email,
        phone: data.phone
      });

      // Registrar usuário como motorista
      await registerUser(data.name, data.email, data.password, data.phone, 'driver');

      // Atualizar dados adicionais do motorista
      if (auth.currentUser) {
        await setDoc(doc(db, 'drivers', auth.currentUser.uid), {
          name: data.name,
          email: data.email,
          phone: data.phone,
          cpf: data.cpf,
          cnh: data.cnh,
          vehicle: {
            model: data.carModel,
            year: data.carYear,
            plate: data.carPlate,
            color: data.carColor
          },
          status: 'pending',
          rating: 5.0,
          totalRides: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        // Mostrar mensagem de sucesso e redirecionar para página de pendente
        toast.success('Cadastro recebido! Envie seus documentos para aprovação.');
            
        // Redirecionar para a página de cadastro pendente
        navigate('/driver/pending', { 
          replace: true,
          state: { 
            phone: '11999999999', // Número do WhatsApp para envio dos documentos
            documents: [
              'CNH (frente e verso)',
              'Documento do veículo (CRLV)',
              'Foto de perfil (rosto visível)',
              'Certidão de antecedentes criminais'
            ]
          }
        });
      }
    } catch (error) {
      console.error('Erro no cadastro:', error);
      setError(error instanceof Error ? error.message : 'Erro ao cadastrar motorista');
      toast.error('Erro ao criar conta. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading mb-2">Cadastre-se como Motorista</h1>
        <p className="text-gray-600">Junte-se à nossa plataforma e comece a ganhar dinheiro</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-error-50 border border-error-200 text-error-700 rounded-lg animate-fade-in flex items-center">
          <AlertCircle size={20} className="mr-2 flex-shrink-0" />
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informações Pessoais */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Informações Pessoais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-error-600 text-sm">{errors.name.message}</p>
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
                <p className="text-error-600 text-sm">{errors.email.message}</p>
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
                <p className="text-error-600 text-sm">{errors.phone.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">
                CPF
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText size={18} className="text-gray-400" />
                </div>
                <input
                  id="cpf"
                  type="text"
                  className={`input pl-10 ${errors.cpf ? 'border-error-500 focus:ring-error-500' : ''}`}
                  placeholder="000.000.000-00"
                  {...register('cpf')}
                />
              </div>
              {errors.cpf && (
                <p className="text-error-600 text-sm">{errors.cpf.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="cnh" className="block text-sm font-medium text-gray-700">
                CNH
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText size={18} className="text-gray-400" />
                </div>
                <input
                  id="cnh"
                  type="text"
                  className={`input pl-10 ${errors.cnh ? 'border-error-500 focus:ring-error-500' : ''}`}
                  placeholder="00000000000"
                  {...register('cnh')}
                />
              </div>
              {errors.cnh && (
                <p className="text-error-600 text-sm">{errors.cnh.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Informações do Veículo */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Informações do Veículo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="carModel" className="block text-sm font-medium text-gray-700">
                Modelo do Carro
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Car size={18} className="text-gray-400" />
                </div>
                <input
                  id="carModel"
                  type="text"
                  className={`input pl-10 ${errors.carModel ? 'border-error-500 focus:ring-error-500' : ''}`}
                  placeholder="Ex: Honda Civic"
                  {...register('carModel')}
                />
              </div>
              {errors.carModel && (
                <p className="text-error-600 text-sm">{errors.carModel.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="carYear" className="block text-sm font-medium text-gray-700">
                Ano do Carro
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Car size={18} className="text-gray-400" />
                </div>
                <input
                  id="carYear"
                  type="text"
                  className={`input pl-10 ${errors.carYear ? 'border-error-500 focus:ring-error-500' : ''}`}
                  placeholder="Ex: 2020"
                  {...register('carYear')}
                />
              </div>
              {errors.carYear && (
                <p className="text-error-600 text-sm">{errors.carYear.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="carPlate" className="block text-sm font-medium text-gray-700">
                Placa do Carro
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Car size={18} className="text-gray-400" />
                </div>
                <input
                  id="carPlate"
                  type="text"
                  className={`input pl-10 ${errors.carPlate ? 'border-error-500 focus:ring-error-500' : ''}`}
                  placeholder="Ex: ABC1234"
                  {...register('carPlate')}
                />
              </div>
              {errors.carPlate && (
                <p className="text-error-600 text-sm">{errors.carPlate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="carColor" className="block text-sm font-medium text-gray-700">
                Cor do Carro
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Car size={18} className="text-gray-400" />
                </div>
                <input
                  id="carColor"
                  type="text"
                  className={`input pl-10 ${errors.carColor ? 'border-error-500 focus:ring-error-500' : ''}`}
                  placeholder="Ex: Prata"
                  {...register('carColor')}
                />
              </div>
              {errors.carColor && (
                <p className="text-error-600 text-sm">{errors.carColor.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Senha */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Senha de Acesso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-error-600 text-sm">{errors.password.message}</p>
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
                <p className="text-error-600 text-sm">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Termos e Condições */}
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
          className="btn-primary w-full flex justify-center py-3 text-lg"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
          ) : (
            'Cadastrar como Motorista'
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

export default DriverRegister;