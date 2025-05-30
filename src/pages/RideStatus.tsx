import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, updateDoc, Timestamp, getDoc, addDoc, deleteDoc, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../utils/firebase';
import { toast } from 'react-hot-toast';
import Map from '../components/Map';
import { Ride } from '../types/user';
import { MapPin, Clock, User as UserIcon, DollarSign, Car, Phone, X } from 'lucide-react';

const RideStatus = () => {
  const { rideId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rideId || !user) return;

    // Monitorar mudanças na corrida
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.ACTIVE_RIDES, rideId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          // Se a corrida não existe mais em activeRides, verificar em outras coleções
          const completedDoc = await getDoc(doc(db, COLLECTIONS.COMPLETED_RIDES, rideId));
          if (completedDoc.exists()) {
            setRide({ id: completedDoc.id, ...completedDoc.data() } as Ride);
            setLoading(false);
            return;
          }

          const cancelledDoc = await getDoc(doc(db, COLLECTIONS.CANCELLED_RIDES, rideId));
          if (cancelledDoc.exists()) {
            setRide({ id: cancelledDoc.id, ...cancelledDoc.data() } as Ride);
            setLoading(false);
            return;
          }

          // Se não encontrar em nenhuma coleção, redirecionar
          toast.error('Corrida não encontrada');
          navigate('/');
          return;
        }

        setRide({ id: snapshot.id, ...snapshot.data() } as Ride);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao monitorar corrida:', error);
        toast.error('Erro ao monitorar corrida');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [rideId, user, navigate]);

  const handleCancelRide = async () => {
    if (!ride || !user) return;

    try {
      // Mover para a coleção de corridas canceladas
      await addDoc(collection(db, COLLECTIONS.CANCELLED_RIDES), {
        ...ride,
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy: 'passenger'
      });

      // Remover da coleção de corridas ativas
      await deleteDoc(doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id));

      toast.success('Corrida cancelada com sucesso');
      navigate('/');
    } catch (error) {
      console.error('Erro ao cancelar corrida:', error);
      toast.error('Erro ao cancelar corrida');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-600 mb-4">Corrida não encontrada</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Status da Corrida */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {ride.status === 'pending' && 'Procurando motorista...'}
            {ride.status === 'accepted' && 'Motorista a caminho'}
            {ride.status === 'inProgress' && 'Em viagem'}
            {ride.status === 'completed' && 'Corrida finalizada'}
            {ride.status === 'cancelled' && 'Corrida cancelada'}
          </h2>
          {ride.status === 'pending' && (
            <button
              onClick={handleCancelRide}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Informações do Motorista */}
        {ride.driver && (
          <div className="border-t border-gray-200 pt-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="bg-gray-100 p-3 rounded-full">
                <Car className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium">{ride.driver.name}</h3>
                <p className="text-sm text-gray-600">
                  {ride.driver.vehicle.model} • {ride.driver.vehicle.plate}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4 text-gray-600" />
                  <a
                    href={`tel:${ride.driver.phone}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {ride.driver.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detalhes da Viagem */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-600 mt-1" />
            <div>
              <p className="text-sm text-gray-600">Origem</p>
              <p>{ride.origin.address}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-600 mt-1" />
            <div>
              <p className="text-sm text-gray-600">Destino</p>
              <p>{ride.destination.address}</p>
            </div>
          </div>
        </div>

        {/* Preço e Duração */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <DollarSign className="h-5 w-5 mx-auto text-gray-600 mb-1" />
            <p className="text-sm text-gray-600">Preço</p>
            <p className="font-medium">R$ {ride.price.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <Clock className="h-5 w-5 mx-auto text-gray-600 mb-1" />
            <p className="text-sm text-gray-600">Duração</p>
            <p className="font-medium">{Math.round(ride.duration / 60)} min</p>
          </div>
          <div className="text-center">
            <MapPin className="h-5 w-5 mx-auto text-gray-600 mb-1" />
            <p className="text-sm text-gray-600">Distância</p>
            <p className="font-medium">{(ride.distance / 1000).toFixed(1)} km</p>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <div className="h-[400px] rounded-lg overflow-hidden">
        <Map
          origin={ride.origin.coordinates}
          destination={ride.destination.coordinates}
          driverLocation={ride.driver?.currentLocation}
          showRoute={true}
        />
      </div>
    </div>
  );
};

export default RideStatus; 