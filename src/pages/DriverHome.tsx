import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getDoc, getDocs, addDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, COLLECTIONS } from '../utils/firebase';
import { MapPin, Clock, User as UserIcon, DollarSign, Car, Star, Route, CreditCard, CheckCircle, TrendingUp, X, Bell, Power, Navigation, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateDistance, getCurrentLocation } from '../utils/mapbox';
import Map from '../components/Map';
import { Ride, Driver } from '../types/user';
import { sendNotification, NotificationSounds, requestNotificationPermission } from '../utils/notifications';
import { Link, useNavigate } from 'react-router-dom';

const DriverHome = () => {
  const { user } = useAuth();
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [showPickupRoute, setShowPickupRoute] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const mountedRef = useRef(true);
  const locationAttempts = useRef(0);
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Verificar status do motorista
  useEffect(() => {
    if (!user) {
      console.log('🚫 Sem usuário logado');
      setLoading(false);
      return;
    }

    console.log('🔄 Iniciando monitoramento de status para:', user.uid);

    // Listener para status do motorista
    const unsubscribe = onSnapshot(
      doc(db, 'drivers', user.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const status = Boolean(data.isOnline);
          console.log('📡 Status recebido do Firestore:', {
            raw: data.isOnline,
            converted: status,
            lastUpdate: data.lastUpdate?.toDate(),
            driverId: user.uid
          });
          setIsOnline(status);
        } else {
          console.log('⚠️ Documento do motorista não encontrado');
        }
        setLoading(false);
      },
      (error) => {
        console.error('❌ Erro ao monitorar status:', error);
        setLoading(false);
      }
    );

    // Verificar status inicial diretamente
    getDoc(doc(db, 'drivers', user.uid)).then(docSnap => {
      if (docSnap.exists()) {
        console.log('🔍 Status inicial:', {
          isOnline: docSnap.data().isOnline,
          lastUpdate: docSnap.data().lastUpdate?.toDate()
        });
      }
    });

    return () => {
      console.log('🔄 Removendo listener de status');
      unsubscribe();
    };
  }, [user]);

  // Função para alternar estado online/offline
  const toggleOnlineStatus = async () => {
    if (!user || isProcessing) {
      console.log('🚫 Toggle bloqueado:', { isProcessing, hasUser: !!user });
      return;
    }
    
    setIsProcessing(true);
    const newStatus = !isOnline;
    console.log('🔄 Tentando alterar status:', {
      de: isOnline,
      para: newStatus,
      userId: user.uid
    });

    try {
      const driverRef = doc(db, 'drivers', user.uid);
      const updateData = {
        isOnline: newStatus,
        lastUpdate: Timestamp.now()
      };

      console.log('📝 Atualizando documento:', {
        ref: driverRef.path,
        data: updateData
      });

      await updateDoc(driverRef, updateData);

      console.log('✅ Status atualizado com sucesso');

      // Limpar corridas se ficar offline
      if (!newStatus) {
        console.log('🧹 Limpando corridas disponíveis');
        setAvailableRides([]);
      }

      toast.success(newStatus ? 'Você está online!' : 'Você está offline');
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');

      // Verificar estado atual no Firestore
      try {
        const currentDoc = await getDoc(doc(db, 'drivers', user.uid));
        if (currentDoc.exists()) {
          console.log('🔍 Estado atual no Firestore:', {
            isOnline: currentDoc.data().isOnline,
            lastUpdate: currentDoc.data().lastUpdate?.toDate()
          });
        }
      } catch (verifyError) {
        console.error('❌ Erro ao verificar estado atual:', verifyError);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Log quando o estado local muda
  useEffect(() => {
    console.log('🔄 Estado local alterado:', {
      isOnline,
      timestamp: new Date().toISOString()
    });
  }, [isOnline]);

  // Função para obter localização com fallback
  const getLocationWithFallback = async (): Promise<[number, number]> => {
    try {
      const coords = await getCurrentLocation();
      return coords;
    } catch (error) {
      console.error('❌ Erro ao obter localização precisa:', error);
      
      // Fallback para última localização conhecida no Firestore
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.currentLocation) {
              console.log('📍 Usando última localização conhecida do Firestore');
              return userData.currentLocation as [number, number];
            }
          }
        } catch (fbError) {
          console.error('❌ Erro ao buscar localização do Firestore:', fbError);
        }
      }

      // Fallback para uma localização padrão (centro da cidade)
      console.log('📍 Usando localização padrão');
      return [-16.3285, -48.9535]; // Coordenadas do centro de Goiânia
    }
  };

  // Obter localização atual do motorista
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const loadCurrentLocation = async () => {
      try {
        console.log('📍 Tentando obter localização atual...');
        locationAttempts.current += 1;

        const coords = await getLocationWithFallback();
        if (mountedRef.current) {
          console.log('📍 Localização obtida:', coords);
        setCurrentLocation(coords);
          setLocationError(null);
          locationAttempts.current = 0;
        }
      } catch (error) {
        console.error('❌ Erro ao obter localização:', error);
        if (mountedRef.current) {
          setLocationError('Erro ao obter localização');
          // Se falhar 3 vezes, continuar com a localização padrão
          if (locationAttempts.current >= 3) {
            console.log('📍 Usando localização padrão após várias tentativas');
            setCurrentLocation([-16.3285, -48.9535]);
          }
        }
      }
    };

    loadCurrentLocation();
    intervalId = setInterval(loadCurrentLocation, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user]);

  const handleNotifyArrival = async () => {
    if (!selectedRide) {
      toast.error('Nenhuma corrida selecionada');
      return;
    }

    try {
      // Verificar permissão de notificação primeiro
      if (Notification.permission !== 'granted') {
        const permission = await requestNotificationPermission();
        if (!permission) {
          toast.error('Permissão de notificação necessária');
          return;
        }
      }

      const loadingToast = toast.loading('Notificando passageiro...');

      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, selectedRide.id!);
      await updateDoc(rideRef, {
        driverArrived: true,
        arrivedAt: Timestamp.now()
      });

      // Enviar notificação para o passageiro
      const notificationTitle = 'Motorista chegou! 🚗';
      const notificationBody = `${user?.displayName || user?.email?.split('@')[0] || 'Seu motorista'} chegou ao local de origem.`;

      // Enviar notificação para o passageiro
      if (selectedRide.userId) {
        const notificationRef = collection(db, 'notifications');
        await addDoc(notificationRef, {
          userId: selectedRide.userId,
          title: notificationTitle,
          body: notificationBody,
          type: 'driver_arrived',
          rideId: selectedRide.id,
          createdAt: Timestamp.now(),
          read: false
        });
      }

      // Enviar notificação local
      await sendNotification(notificationTitle, {
        body: notificationBody,
        icon: '/car-icon.svg',
        sound: NotificationSounds.DRIVER_ARRIVED,
        tag: 'driver-arrived',
        requireInteraction: true
      });

      setShowPickupRoute(false);

      toast.dismiss(loadingToast);
      toast.success('Passageiro notificado da sua chegada!', {
        icon: '✅'
      });
    } catch (error) {
      console.error('Erro ao notificar chegada:', error);
      toast.error('Erro ao notificar passageiro. Tente novamente.');
    }
  };

  const handleStartRide = async (ride: Ride) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const loadingToast = toast.loading('Iniciando corrida...');
      
      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      await updateDoc(rideRef, {
        status: 'inProgress',
        startedAt: Timestamp.now()
      });

      setSelectedRide({ ...ride, status: 'inProgress' });
      setShowPickupRoute(false);
      setShowRouteMap(true);

      toast.dismiss(loadingToast);
      toast.success('Corrida iniciada!');
    } catch (error) {
      console.error('Erro ao iniciar corrida:', error);
      toast.error('Erro ao iniciar corrida. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteRide = async (ride: Ride) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const loadingToast = toast.loading('Finalizando corrida...');

      // Mover a corrida para completedRides usando o mesmo ID
      const completedRideRef = doc(db, COLLECTIONS.COMPLETED_RIDES, ride.id);
      await setDoc(completedRideRef, {
        ...ride,
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: user?.uid,
        finalLocation: currentLocation
      });

      // Remover da coleção activeRides
      const activeRideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      await deleteDoc(activeRideRef);

      setMyRides(current => current.filter(r => r.id !== ride.id));
      setSelectedRide(null);
      setShowRouteMap(false);
      setShowPickupRoute(true);

      toast.dismiss(loadingToast);
      toast.success('Corrida finalizada com sucesso!');
      
      // Enviar notificação de corrida finalizada
      sendNotification('Corrida finalizada! ✅', {
        body: 'A corrida foi concluída com sucesso.',
        icon: '/car-icon.svg',
        sound: NotificationSounds.RIDE_COMPLETED
      });
    } catch (error) {
      console.error('Erro ao finalizar corrida:', error);
      toast.error('Erro ao finalizar corrida. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Memoizar o renderização do mapa
  const renderFullScreenMap = useCallback(() => {
    if (!showRouteMap || !selectedRide) return null;

    // Memoizar as coordenadas para evitar re-renders desnecessários
    const origin = showPickupRoute ? (currentLocation || undefined) : selectedRide.origin?.coordinates;
    const destination = showPickupRoute ? selectedRide.origin?.coordinates : selectedRide.destination?.coordinates;

    return (
      <div className="fixed inset-0 bg-white z-50">
        <div className="bg-white shadow-sm p-2 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={() => {
                  setShowRouteMap(false);
                  if (selectedRide.status === 'accepted') {
                    setShowPickupRoute(true);
                  }
                }}
                className="mr-2 sm:mr-4 p-1.5 sm:p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} className="text-gray-600" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-semibold">
                  {showPickupRoute ? 'Rota até o passageiro' : 'Rota até o destino'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate max-w-[200px] sm:max-w-none">
                  {showPickupRoute 
                    ? selectedRide.origin?.address 
                    : selectedRide.destination?.address}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2">
              {selectedRide.status === 'accepted' && (
                <>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.[0]},${currentLocation?.[1]}&destination=${selectedRide.origin?.coordinates[0]},${selectedRide.origin?.coordinates[1]}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500 text-white px-2 py-1.5 rounded-lg hover:bg-blue-600 flex items-center text-[11px] sm:text-base whitespace-normal"
                  >
                    <Navigation size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="whitespace-normal text-center">Navegar até Passageiro</span>
                  </a>
                  <button
                    onClick={() => handleNotifyArrival()}
                    className="bg-yellow-500 text-white px-2 py-1.5 rounded-lg hover:bg-yellow-600 flex items-center text-[11px] sm:text-base whitespace-normal"
                  >
                    <Bell size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="whitespace-normal text-center">Avisar Chegada</span>
                  </button>
                  <button
                    onClick={() => handleStartRide(selectedRide)}
                    className="bg-primary-600 text-white px-2 py-1.5 rounded-lg hover:bg-primary-700 flex items-center text-[11px] sm:text-base whitespace-normal"
                  >
                    <Car size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="whitespace-normal text-center">Iniciar Corrida</span>
                  </button>
                </>
              )}
              {selectedRide.status === 'inProgress' && (
                <>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.[0]},${currentLocation?.[1]}&destination=${selectedRide.destination?.coordinates[0]},${selectedRide.destination?.coordinates[1]}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500 text-white px-2 py-1.5 rounded-lg hover:bg-blue-600 flex items-center text-[11px] sm:text-base whitespace-normal"
                  >
                    <Navigation size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="whitespace-normal text-center">Navegar até Destino</span>
                  </a>
                  <button
                    onClick={() => handleCompleteRide(selectedRide)}
                    className="bg-green-600 text-white px-2 py-1.5 rounded-lg hover:bg-green-700 flex items-center text-[11px] sm:text-base whitespace-normal"
                  >
                    <CheckCircle size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="whitespace-normal text-center">Finalizar Corrida</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="h-[calc(100vh-56px)] sm:h-[calc(100vh-72px)]">
          <Map
            key={`${origin}-${destination}-${showPickupRoute}`}
            className="w-full h-full"
            origin={origin}
            destination={destination}
            showRoute={true}
            driverLocation={currentLocation || undefined}
            autoUpdate={false}
          />
        </div>
      </div>
    );
  }, [showRouteMap, selectedRide, currentLocation, showPickupRoute, handleNotifyArrival, handleStartRide, handleCompleteRide]);

  // Efeito principal para gerenciar corridas
  useEffect(() => {
    if (!user || !isOnline) {
      setAvailableRides([]);
      setLoading(false);
      return;
    }

    console.log('🔄 Iniciando configuração dos listeners...');

    let unsubscribeAvailable: () => void;
    let unsubscribeMyRides: () => void;

    const setupListeners = async () => {
      try {
        console.log('🔄 Configurando listeners de corridas...');

        // Listener para corridas disponíveis (apenas da coleção activeRides)
        const availableRidesQuery = query(
          collection(db, COLLECTIONS.ACTIVE_RIDES),
          where('status', '==', 'pending'),
          where('driverId', '==', null)
        );

        console.log('🔍 Query de corridas disponíveis:', {
          collection: COLLECTIONS.ACTIVE_RIDES,
          conditions: [
            { field: 'status', operator: '==', value: 'pending' },
            { field: 'driverId', operator: '==', value: null }
          ]
        });

        unsubscribeAvailable = onSnapshot(availableRidesQuery, (snapshot) => {
          if (!mountedRef.current) {
            console.log('❌ Componente desmontado, ignorando snapshot');
            return;
          }

          const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Ride[];

          // Notificar sobre novas corridas disponíveis
          const newRides = rides.filter(ride => !availableRides.find(r => r.id === ride.id));
          if (newRides.length > 0) {
            newRides.forEach(ride => {
              sendNotification('Nova corrida disponível! 🚖', {
                body: `Origem: ${ride.origin.address}\nDestino: ${ride.destination.address}`,
                icon: '/car-icon.svg',
                sound: NotificationSounds.NEW_RIDE
              });
            });
          }

          console.log('✅ Corridas disponíveis processadas:', rides.length);
          setAvailableRides(rides);
          setLoading(false);
        }, (error) => {
          console.error('❌ Erro no listener de corridas:', error);
          setError('Erro ao carregar corridas disponíveis');
          setLoading(false);
        });

        // Listener para minhas corridas ativas
        const myRidesQuery = query(
          collection(db, COLLECTIONS.ACTIVE_RIDES),
          where('driverId', '==', user.uid),
          where('status', 'in', ['accepted', 'inProgress'])
        );

        unsubscribeMyRides = onSnapshot(myRidesQuery, (snapshot) => {
          if (!mountedRef.current) return;

          const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Ride[];

          console.log('🚗 Minhas corridas ativas:', rides.length);
          setMyRides(rides);
          setLoading(false);
        });

      } catch (error) {
        console.error('❌ Erro ao configurar listeners:', error);
        if (mountedRef.current) {
          setError('Erro ao carregar dados. Por favor, tente novamente.');
          setLoading(false);
        }
      }
    };

    setupListeners();

    return () => {
      console.log('🔄 Removendo listeners...');
      unsubscribeAvailable?.();
      unsubscribeMyRides?.();
    };
  }, [user, isOnline]);

  // Atualizar localização do motorista
  useEffect(() => {
    if (!user || !mountedRef.current) return;

    const updateLocation = async () => {
      try {
        // Obter localização atual
        const location = await getLocationWithFallback();
        if (!location) return;

        // Atualizar localização na coleção users
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          currentLocation: location,
          lastLocationUpdate: Timestamp.now()
        });

        // Atualizar localização na coleção drivers
        const driverRef = doc(db, 'drivers', user.uid);
        await updateDoc(driverRef, {
          currentLocation: location,
          lastLocationUpdate: Timestamp.now(),
          isOnline: true // Garantir que o status online seja mantido
        });
        
        if (mountedRef.current) {
          setCurrentLocation(location);
        }
      } catch (error) {
        console.error('Erro ao atualizar localização:', error);
      }
    };

    // Atualizar localização imediatamente
    updateLocation();

    // Configurar intervalo para atualização periódica
    const intervalId = setInterval(updateLocation, 15000); // Atualizar a cada 15 segundos

    return () => {
      clearInterval(intervalId);
      // Ao desmontar, marcar motorista como offline
      if (user) {
        const driverRef = doc(db, 'drivers', user.uid);
        updateDoc(driverRef, {
          isOnline: false,
          lastLocationUpdate: Timestamp.now()
        }).catch(error => {
          console.error('Erro ao marcar motorista como offline:', error);
        });
      }
    };
  }, [user]);

  // Memoizar o cálculo de distâncias
  const updateDistances = useCallback(async () => {
      if (!currentLocation || availableRides.length === 0) return;

      const updatedRides = await Promise.all(
        availableRides.map(async (ride) => {
          try {
            if (!ride.origin.coordinates || !ride.destination.coordinates) {
              return ride;
            }

            const pickupDistance = await calculateDistance(
              currentLocation,
              ride.origin.coordinates
            );

            const rideDistance = await calculateDistance(
              ride.origin.coordinates,
              ride.destination.coordinates
            );

            if (pickupDistance && rideDistance) {
              return {
                ...ride,
                distanceToPickup: pickupDistance.distance,
                durationToPickup: pickupDistance.duration,
                distance: rideDistance.distance,
                duration: rideDistance.duration
              };
            }

            return ride;
          } catch (error) {
            console.error('Erro ao calcular distância para corrida:', ride.id, error);
            return ride;
          }
        })
      );

      setAvailableRides(updatedRides);
  }, [currentLocation, availableRides]);

  // Atualizar distâncias com debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateDistances();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [updateDistances]);

  // Função para atualizar estados com debounce
  const updateStatesWithDebounce = (rides: Ride[]) => {
    const now = Date.now();
    if (now - lastUpdateTime < 1000) { // Evitar atualizações em menos de 1 segundo
      return;
    }

    setLastUpdateTime(now);
    setAvailableRides(rides);
  };

  const handleAcceptRide = async (ride: Ride) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const loadingToast = toast.loading('Aceitando corrida...');

      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      const rideDoc = await getDoc(rideRef);
      
      if (!rideDoc.exists()) {
        toast.error('Esta corrida não está mais disponível');
        return;
      }

      const rideData = rideDoc.data();
      if (rideData.status !== 'pending' || rideData.driverId) {
        toast.error('Esta corrida já foi aceita por outro motorista');
        return;
      }

      // Buscar dados do motorista no Firestore
      const driverRef = doc(db, 'drivers', user!.uid);
      const driverDoc = await getDoc(driverRef);
      
      if (!driverDoc.exists()) {
        toast.error('Dados do motorista não encontrados');
        return;
      }

      const driverData = driverDoc.data();
      console.log('🚗 Dados completos do motorista:', JSON.stringify(driverData, null, 2));
      
      // Validação detalhada do veículo usando os campos corretos
      const model = driverData.carModel;
      const plate = driverData.carPlate;
      const color = driverData.carColor;
      
      console.log('🚗 Campos do veículo:', {
        model: model || 'undefined',
        plate: plate || 'undefined',
        color: color || 'undefined'
      });
      
      if (!model || !plate || !color) {
        console.log('❌ Dados do veículo incompletos:', {
          temModelo: !!model,
          temPlaca: !!plate,
          temCor: !!color
        });

        // Mensagem específica sobre qual campo está faltando
        let mensagem = 'Por favor, complete os seguintes dados do veículo no seu perfil: ';
        const camposFaltantes = [];
        if (!model) camposFaltantes.push('modelo');
        if (!plate) camposFaltantes.push('placa');
        if (!color) camposFaltantes.push('cor');
        
        mensagem += camposFaltantes.join(', ');
        toast.error(mensagem);
        navigate('/driver/profile');
        return;
      }

      // Buscar dados do passageiro no Firestore
      const passengerDoc = await getDoc(doc(db, 'users', ride.userId));
      const passengerData = passengerDoc.data();

      const driverInfo = {
        id: user!.uid,
        name: driverData.name || driverData.displayName || 'Motorista',
        phone: driverData.phone || '',
        rating: driverData.rating || 5.0,
        vehicle: {
          model: model.trim(),
          plate: plate.trim().toUpperCase(),
          color: color.trim()
        },
        currentLocation: currentLocation || [0, 0]
      };

      console.log('✅ Dados do motorista validados com sucesso:', JSON.stringify(driverInfo, null, 2));

      // Atualizar a corrida com os dados do motorista
      await updateDoc(rideRef, {
        status: 'accepted',
        driverId: user!.uid,
        driver: driverInfo,
        acceptedAt: Timestamp.now(),
        userName: passengerData?.name || passengerData?.displayName || 'Usuário'
      });

      toast.success('Corrida aceita com sucesso!');
      toast.dismiss(loadingToast);
      
      // Enviar notificação para o passageiro
      sendNotification('Motorista encontrado! 🚗', {
        body: `${driverInfo.name} está a caminho do seu local`,
        icon: '/car-icon.svg'
      });
    } catch (error) {
      console.error('❌ Erro ao aceitar corrida:', error);
      toast.error('Erro ao aceitar corrida');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRide = async (ride: Ride) => {
    try {
      const loadingToast = toast.loading('Recusando corrida...');

      // Mover para cancelledRides
      const cancelledRideRef = collection(db, COLLECTIONS.CANCELLED_RIDES);
      await addDoc(cancelledRideRef, {
        ...ride,
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy: 'driver',
        driverId: user?.uid
      });

      // Remover da coleção activeRides
      const activeRideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      await deleteDoc(activeRideRef);

      setAvailableRides(current => current.filter(r => r.id !== ride.id));
      
      if (selectedRide?.id === ride.id) {
        setSelectedRide(null);
        setShowRouteMap(false);
        setShowPickupRoute(true);
      }

      toast.dismiss(loadingToast);
      toast.success('Corrida recusada');
    } catch (error) {
      console.error('Erro ao recusar corrida:', error);
      toast.error('Erro ao recusar corrida. Tente novamente.');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDistance = (distance: number) => {
    // Garantir que a distância está em metros
    const distanceInMeters = distance;
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)} m`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.round(duration / 60);
    return `${minutes} min`;
  };

  const formatDistanceToPickup = (meters: number | undefined) => {
    if (!meters) return '-- km';
    // Garantir que a distância está em metros
    const distanceInMeters = meters;
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)} m`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  };

  const formatDurationToPickup = (seconds: number | undefined) => {
    if (!seconds) return '-- min';
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  // Adicionar função para renderizar a barra de configurações
  const renderSettingsBar = () => {
    if (!showSettings) return null;

    return (
      <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-lg z-50 p-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Configurações</h3>
          <button
            onClick={() => setShowSettings(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <Link
            to="/driver/profile"
            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg"
          >
            <UserIcon size={20} />
            <span>Meu Perfil</span>
          </Link>
          
          <Link
            to="/historico"
            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg"
          >
            <Clock size={20} />
            <span>Histórico</span>
          </Link>
          
          <Link
            to="/ganhos"
            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg"
          >
            <DollarSign size={20} />
            <span>Meus Ganhos</span>
          </Link>
          
          <Link
            to="/veiculo"
            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg"
          >
            <Car size={20} />
            <span>Meu Veículo</span>
          </Link>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600 text-center">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">
          {!currentLocation ? 'Obtendo sua localização...' : 'Carregando...'}
        </p>
        {locationError && (
          <p className="text-yellow-600 text-sm mt-2">
            Tentando obter sua localização. Por favor, verifique as permissões de GPS.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-100">
      {/* Botão de configurações */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-4 right-4 z-50 bg-white p-2 rounded-full shadow-lg hover:bg-gray-50"
      >
        <Settings size={24} className="text-gray-700" />
      </button>

      {/* Barra de configurações */}
      {renderSettingsBar()}

      {/* Mapa em tela cheia */}
      <div className="fixed inset-0">
        <Map
          className="w-full h-full"
          origin={undefined}
          destination={undefined}
          showRoute={false}
          driverLocation={currentLocation || undefined}
          autoUpdate={true}
        />
      </div>

      {/* Painel deslizante sobreposto */}
      <div className="relative z-10 h-screen overflow-y-auto bg-gradient-to-b from-black/50 to-transparent pt-2 sm:pt-4">
        <div className="container mx-auto px-2 sm:px-4 max-w-6xl">
          {/* Header com botão de online/offline */}
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-2 sm:p-4 mb-2 sm:mb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-base sm:text-xl font-semibold">Corridas Disponíveis</h1>
              <button
                onClick={toggleOnlineStatus}
                disabled={isProcessing}
                className={`flex items-center px-2 sm:px-4 py-1 sm:py-2 rounded-full transition-colors text-[11px] sm:text-base ${
                  isOnline 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                <Power size={14} className="mr-1 sm:mr-2" />
                {isProcessing ? 'Atualizando...' : (isOnline ? 'Online' : 'Offline')}
              </button>
            </div>
          </div>

          {/* Corridas em andamento */}
          {myRides.length > 0 && (
            <div className="mb-3 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-3 text-white drop-shadow-lg">Minhas Corridas em Andamento</h2>
              <div className="grid gap-2 sm:gap-4">
                {myRides.map((ride) => (
                  <div key={ride.id} className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4 bg-gray-50/80 p-2 sm:p-3 rounded-lg">
                      <UserIcon className="text-primary-600 w-5 h-5 sm:w-6 sm:h-6" />
                      <div>
                        <span className="font-semibold text-base sm:text-lg text-gray-900 block">{ride.userName || 'Usuário'}</span>
                        <span className="text-xs sm:text-sm text-gray-500">Passageiro da corrida</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-3 sm:mb-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="text-primary-600 mt-1 w-4 h-4 sm:w-5 sm:h-5" />
                        <div>
                          <p className="text-xs sm:text-sm font-medium">Origem</p>
                          <p className="text-xs sm:text-sm text-gray-600">{ride.origin?.address || 'Endereço não disponível'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="text-primary-600 mt-1 w-4 h-4 sm:w-5 sm:h-5" />
                        <div>
                          <p className="text-xs sm:text-sm font-medium">Destino</p>
                          <p className="text-xs sm:text-sm text-gray-600">{ride.destination?.address || 'Endereço não disponível'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4 bg-gray-50/80 p-2 sm:p-3 rounded-lg">
                      <div className="text-center">
                        <DollarSign className="mx-auto text-gray-500 w-4 h-4 sm:w-5 sm:h-5" />
                        <p className="text-xs sm:text-sm font-medium">{formatPrice(ride.price || 0)}</p>
                      </div>
                      <div className="text-center">
                        <Car className="mx-auto text-gray-500 w-4 h-4 sm:w-5 sm:h-5" />
                        <p className="text-xs sm:text-sm font-medium">{formatDistance(ride.distance || 0)}</p>
                      </div>
                      <div className="text-center">
                        <Clock className="mx-auto text-gray-500 w-4 h-4 sm:w-5 sm:h-5" />
                        <p className="text-xs sm:text-sm font-medium">{formatDuration(ride.duration || 0)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {ride.status === 'accepted' && (
                        <>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.[0]},${currentLocation?.[1]}&destination=${ride.origin?.coordinates[0]},${ride.origin?.coordinates[1]}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-500 text-white py-2 px-2 rounded-lg hover:bg-blue-600 flex items-center justify-center text-[11px] sm:text-base"
                            onClick={() => setSelectedRide(ride)}
                          >
                            <Navigation size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="whitespace-normal text-center">Navegar até Passageiro</span>
                          </a>
                          <button
                            onClick={() => {
                              setSelectedRide(ride);
                              handleNotifyArrival();
                            }}
                            className="flex-1 bg-yellow-500 text-white py-2 px-2 rounded-lg hover:bg-yellow-600 flex items-center justify-center text-[11px] sm:text-base"
                          >
                            <Bell size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="whitespace-normal text-center">Avisar Chegada</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRide(ride);
                              handleStartRide(ride);
                            }}
                            className="flex-1 bg-primary-600 text-white py-2 px-2 rounded-lg hover:bg-primary-700 flex items-center justify-center text-[11px] sm:text-base"
                          >
                            <Car size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="whitespace-normal text-center">Iniciar Corrida</span>
                          </button>
                        </>
                      )}

                      {ride.status === 'inProgress' && (
                        <>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.[0]},${currentLocation?.[1]}&destination=${ride.destination?.coordinates[0]},${ride.destination?.coordinates[1]}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-500 text-white py-2 px-2 rounded-lg hover:bg-blue-600 flex items-center justify-center text-[11px] sm:text-base"
                          >
                            <Navigation size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="whitespace-normal text-center">Navegar até Destino</span>
                          </a>
                          <button
                            onClick={() => handleCompleteRide(ride)}
                            className="flex-1 bg-green-600 text-white py-2 px-2 rounded-lg hover:bg-green-700 flex items-center justify-center text-[11px] sm:text-base"
                          >
                            <CheckCircle size={14} className="mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="whitespace-normal text-center">Finalizar Corrida</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status atual */}
          {!isOnline && (
            <div className="text-center py-8 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg">
              <Car size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Você está offline. Fique online para receber corridas.</p>
            </div>
          )}

          {/* Lista de corridas disponíveis */}
          {isOnline && (
            <div className="space-y-2 sm:space-y-4">
              {loading ? (
                <div className="text-center py-4 sm:py-8 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-3 text-gray-500 text-sm sm:text-base">Carregando corridas...</p>
                </div>
              ) : error ? (
                <div className="text-center py-4 sm:py-8 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg text-red-500 text-sm sm:text-base">
                  <p>{error}</p>
                </div>
              ) : availableRides.length === 0 ? (
                <div className="text-center py-4 sm:py-8 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg">
                  <Car size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500 text-sm sm:text-base">Nenhuma corrida disponível no momento</p>
                </div>
              ) : (
                <div className="grid gap-2 sm:gap-4 pb-4">
                  {availableRides.map((ride) => (
                    <div key={ride.id} className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
                      {/* Cabeçalho com Preço */}
                      <div className="bg-white/90 p-2 sm:p-4 border-b border-gray-200/50">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <UserIcon className="text-primary-600 w-4 h-4 sm:w-6 sm:h-6" />
                              <div>
                                <span className="font-semibold text-sm sm:text-lg text-gray-900">{ride.userName}</span>
                                <p className="text-[10px] sm:text-sm text-gray-500">Passageiro</p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center">
                              <span className="text-lg sm:text-2xl font-bold text-primary-600">R$ {(ride.price || 0).toFixed(2)}</span>
                            </div>
                            <div className="text-[8px] sm:text-xs text-gray-500 text-right">
                              +R$ {((ride.price || 0) * 0.2).toFixed(2)} incluído
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Corpo do Card */}
                      <div className="p-2 sm:p-4 space-y-2 sm:space-y-4">
                        {/* Distância e Tempo até o Passageiro */}
                        <div className="text-[10px] sm:text-sm">
                          <div className="flex items-baseline space-x-1.5 sm:space-x-2">
                            <span className="font-medium">{formatDistanceToPickup(ride.distanceToPickup)}</span>
                            <span className="text-gray-500">até o passageiro</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-500">{formatDurationToPickup(ride.durationToPickup)}</span>
                          </div>
                        </div>

                        {/* Endereços */}
                        <div className="relative pl-4 sm:pl-6">
                          <div className="absolute left-1 sm:left-2 top-2 bottom-2 w-0.5 bg-gray-200">
                            <div className="absolute top-0 h-1.5 w-1.5 -left-[3px] rounded-full bg-black"></div>
                            <div className="absolute bottom-0 h-1.5 w-1.5 -left-[3px] rounded-full bg-black"></div>
                          </div>
                          
                          <div className="space-y-2 sm:space-y-4">
                            <div>
                              <p className="font-medium text-[10px] sm:text-sm truncate">{ride.origin?.address || 'Endereço não disponível'}</p>
                              <p className="text-[8px] sm:text-xs text-gray-500">Pegar passageiro</p>
                            </div>
                            <div>
                              <p className="font-medium text-[10px] sm:text-sm truncate">{ride.destination?.address || 'Endereço não disponível'}</p>
                              <p className="text-[8px] sm:text-xs text-gray-500">
                                Destino final • {formatDistance(ride.distance || 0)} • {formatDuration(ride.duration || 0)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Indicador de Alta Demanda */}
                        <div className="flex items-center text-primary-600 text-[10px] sm:text-sm">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          <span>Oferta de valor alto</span>
                        </div>
                      </div>

                      {/* Botões de Aceitar/Recusar */}
                      <div className="flex gap-0.5 sm:gap-2">
                        <button
                          onClick={() => handleRejectRide(ride)}
                          className="w-1/2 bg-red-50 text-red-600 py-2 sm:py-3 text-[11px] sm:text-base font-medium hover:bg-red-100 transition-colors"
                        >
                          Recusar
                        </button>
                        <button
                          onClick={() => handleAcceptRide(ride)}
                          className="w-1/2 bg-primary-600 text-white py-2 sm:py-3 text-[11px] sm:text-base font-medium hover:bg-primary-700 transition-colors"
                        >
                          Aceitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mapa em tela cheia quando visualizando rota */}
      {renderFullScreenMap()}
    </div>
  );
};

export default DriverHome; 