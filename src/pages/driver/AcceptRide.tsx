import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { getDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../utils/firebase';
import { sendNotification } from '../../utils/notifications';

interface Vehicle {
  model: string;
  plate: string;
  color: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  currentLocation?: [number, number];
  vehicle: Vehicle;
}

interface Ride {
  id: string;
  status: string;
  userId: string;
  driverId?: string;
  driver?: Driver;
}

const AcceptRide: React.FC = () => {
  const navigate = useNavigate();
  const { rideId } = useParams();
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRide = async () => {
      if (!rideId) return;

      try {
        const rideDoc = await getDoc(doc(db, COLLECTIONS.ACTIVE_RIDES, rideId));
        if (rideDoc.exists()) {
          setRide({ id: rideDoc.id, ...rideDoc.data() } as Ride);
        }
      } catch (error) {
        console.error('Erro ao carregar corrida:', error);
        toast.error('Erro ao carregar dados da corrida');
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [rideId]);

  const handleAcceptRide = async () => {
    try {
      if (!user || !ride) {
        toast.error('Erro: Dados da corrida não encontrados');
        return;
      }

      // Buscar dados do motorista
      const driverDoc = await getDoc(doc(db, 'drivers', user.uid));
      if (!driverDoc.exists()) {
        toast.error('Erro: Dados do motorista não encontrados');
        return;
      }

      const driverData = driverDoc.data();
      console.log('Dados do motorista:', driverData); // Log para debug

      // Validação detalhada do veículo
      if (!driverData.vehicle) {
        console.log('Erro: Dados do veículo não encontrados');
        toast.error('Por favor, complete os dados do seu veículo no perfil');
        navigate('/driver/profile');
        return;
      }

      const { model, plate, color } = driverData.vehicle;
      
      if (!model || !plate || !color) {
        console.log('Dados do veículo incompletos:', {
          model,
          plate,
          color
        });
        toast.error('Por favor, preencha todos os dados do veículo no seu perfil');
        navigate('/driver/profile');
        return;
      }

      // Atualizar a corrida com os dados do motorista
      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      await updateDoc(rideRef, {
        status: 'accepted',
        driverId: user.uid,
        driver: {
          id: user.uid,
          name: driverData.name || user.displayName || 'Motorista',
          phone: driverData.phone || '',
          rating: driverData.rating || 5,
          currentLocation: driverData.currentLocation || null,
          vehicle: {
            model: model.trim(),
            plate: plate.trim().toUpperCase(),
            color: color.trim()
          }
        },
        acceptedAt: Timestamp.now()
      });

      // Notificar o passageiro
      sendNotification('Corrida aceita! 🚗', {
        body: `${driverData.name || 'Seu motorista'} está a caminho`,
        icon: '/car-icon.svg'
      });

      toast.success('Corrida aceita com sucesso!');
      navigate(`/driver/ride/${ride.id}`);
    } catch (error) {
      console.error('Erro ao aceitar corrida:', error);
      toast.error('Erro ao aceitar corrida. Por favor, tente novamente.');
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
    <div className="p-4">
      {ride && (
        <button
          onClick={handleAcceptRide}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Aceitar Corrida
        </button>
      )}
    </div>
  );
};

export default AcceptRide; 