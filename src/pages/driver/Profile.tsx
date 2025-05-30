import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { toast } from 'react-hot-toast';
import { FaCar, FaUser, FaPhone } from 'react-icons/fa';

interface DriverProfile {
  name: string;
  phone: string;
  carModel: string;
  carPlate: string;
  carColor: string;
  carYear: string;
}

const DriverProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DriverProfile>({
    name: '',
    phone: '',
    carModel: '',
    carPlate: '',
    carColor: '',
    carYear: ''
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const driverDoc = await getDoc(doc(db, 'drivers', user.uid));
        if (driverDoc.exists()) {
          const data = driverDoc.data();
          setProfile({
            name: data.name || '',
            phone: data.phone || '',
            carModel: data.carModel || '',
            carPlate: data.carPlate || '',
            carColor: data.carColor || '',
            carYear: data.carYear || ''
          });
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        toast.error('Erro ao carregar dados do perfil');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validar campos obrigatórios
    if (!profile.name.trim() || !profile.phone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    // Validar dados do veículo
    if (!profile.carModel.trim() || !profile.carPlate.trim() || !profile.carColor.trim() || !profile.carYear.trim()) {
      toast.error('Todos os dados do veículo são obrigatórios');
      return;
    }

    try {
      await updateDoc(doc(db, 'drivers', user.uid), {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        carModel: profile.carModel.trim(),
        carPlate: profile.carPlate.trim().toUpperCase(),
        carColor: profile.carColor.trim(),
        carYear: profile.carYear.trim(),
        updatedAt: new Date()
      });

      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao atualizar perfil');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Perfil do Motorista</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados pessoais */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center">
            <FaUser className="mr-2" />
            Dados Pessoais
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="input"
              placeholder="Seu nome completo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FaPhone className="inline mr-1" />
              Telefone
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="input"
              placeholder="(00) 00000-0000"
              required
            />
          </div>
        </div>

        {/* Dados do veículo */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center">
            <FaCar className="mr-2" />
            Dados do Veículo
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelo do veículo
            </label>
            <input
              type="text"
              value={profile.carModel}
              onChange={(e) => setProfile({ ...profile, carModel: e.target.value })}
              className="input"
              placeholder="Ex: Honda Civic"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placa
            </label>
            <input
              type="text"
              value={profile.carPlate}
              onChange={(e) => setProfile({ ...profile, carPlate: e.target.value.toUpperCase() })}
              className="input"
              placeholder="ABC1234"
              maxLength={7}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cor
            </label>
            <input
              type="text"
              value={profile.carColor}
              onChange={(e) => setProfile({ ...profile, carColor: e.target.value })}
              className="input"
              placeholder="Ex: Prata"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>
            <input
              type="text"
              value={profile.carYear}
              onChange={(e) => setProfile({ ...profile, carYear: e.target.value })}
              className="input"
              placeholder="Ex: 2020"
              maxLength={4}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Salvar Alterações
        </button>
      </form>
    </div>
  );
};

export default DriverProfile; 