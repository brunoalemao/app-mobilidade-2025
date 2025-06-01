import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addDoc, Timestamp } from 'firebase/firestore';
import { activeRidesRef, COLLECTIONS } from '../utils/firebase';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { calculatePrice } from '../utils/pricing';
import Map from '../components/Map';
import { Location } from '../types/user';

const RequestRide = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const handleRequestRide = async () => {
    if (!origin || !destination || !user) {
      toast.error('Por favor, selecione origem e destino');
      return;
    }

    setIsLoading(true);
    try {
      // Calcular preço baseado na distância e duração
      const price = calculatePrice(distance, duration);

      // Criar nova corrida na coleção activeRides
      const rideData = {
        userId: user.uid,
        userName: user.email?.split('@')[0] || 'Usuário',
        origin: {
          coordinates: origin.coordinates,
          address: origin.address,
          place: origin.place
        },
        destination: {
          coordinates: destination.coordinates,
          address: destination.address,
          place: destination.place
        },
        status: 'pending',
        createdAt: Timestamp.now(),
        distance,
        duration,
        price,
        driverId: null,
        driver: null
      };

      console.log('📝 Criando nova corrida:', rideData);
      const rideRef = await addDoc(activeRidesRef, rideData);
      console.log('✅ Corrida criada com ID:', rideRef.id);
      
      toast.success('Corrida solicitada com sucesso!');
      navigate(`/ride/${rideRef.id}`);
    } catch (error) {
      console.error('Erro ao solicitar corrida:', error);
      toast.error('Erro ao solicitar corrida. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // ... resto do código do componente (UI, etc)
}; 