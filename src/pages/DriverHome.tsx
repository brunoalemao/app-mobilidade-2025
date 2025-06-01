import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getDoc, getDocs, addDoc, deleteDoc, setDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db, COLLECTIONS } from '../utils/firebase';
import { MapPin, Clock, User as UserIcon, DollarSign, Car, Star, Route, CreditCard, CheckCircle, TrendingUp, X, Bell, Power } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateDistance, getCurrentLocation } from '../utils/mapbox';
import Map from '../components/Map';
import { Ride, Driver } from '../types/user';
import { sendNotification, requestNotificationPermission } from '../utils/notifications';

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
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

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

  // Verificar e solicitar permissão de notificação ao montar o componente
  useEffect(() => {
    const checkNotificationPermission = async () => {
      try {
        console.log('🔔 Verificando permissão de notificações...');
        const permission = await requestNotificationPermission();
        setHasNotificationPermission(permission);
        
        if (!permission) {
          console.log('❌ Permissão de notificações negada');
          toast.error('Para receber solicitações de corrida, permita as notificações', {
            duration: 5000,
            icon: '🔔'
          });
        } else {
          console.log('✅ Permissão de notificações concedida');
        }
      } catch (error) {
        console.error('Erro ao verificar permissão de notificações:', error);
      }
    };

    checkNotificationPermission();
  }, []);

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
        lastUpdate: Timestamp.now(),
        currentLocation: currentLocation || null
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

  // Obter localização atual com throttle
  useEffect(() => {
    if (!user || !isOnline) {
      setCurrentLocation(null);
      return;
    }

    let watchId: number;

    const startWatchingPosition = () => {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const now = Date.now();
            // Atualizar localização apenas a cada 10 segundos
            if (now - lastUpdateTime > 10000) {
              const { latitude, longitude } = position.coords;
              setCurrentLocation([longitude, latitude]);
              setLastUpdateTime(now);
            }
          },
          (error) => {
            console.error('Erro ao obter localização:', error);
            toast.error('Erro ao atualizar localização');
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 10000
          }
        );
      }
    };

    startWatchingPosition();

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user, isOnline, lastUpdateTime]);

  const handleNotifyArrival = async () => {
    if (!selectedRide) return;

    try {
      const loadingToast = toast.loading('Notificando passageiro...');

      // Verificar permissão para notificações
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        console.log('❌ Permissão para notificações não concedida');
        toast.error('Não foi possível enviar notificação. Verifique as permissões.');
        return;
      }

      // Atualizar status no banco de dados
      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, selectedRide.id!);
      await updateDoc(rideRef, {
        driverArrived: true,
        arrivedAt: Timestamp.now(),
        lastStatus: 'driver_arrived',
        driverLocation: currentLocation
      });

      // Enviar notificação para o passageiro
      if (selectedRide.userId) {
        console.log('📱 Enviando notificação de chegada para:', selectedRide.userId);
        try {
          await sendNotification(
            'Motorista chegou! 🚗',
            {
              body: `${user?.displayName || 'Seu motorista'} está no ponto de embarque. Por favor, dirija-se ao local combinado para iniciar sua viagem.`,
              icon: '/driver-arrived.png',
              badge: '/logo192.png',
              tag: `ride-${selectedRide.id}-arrived`,
              requireInteraction: true,
              data: {
                rideId: selectedRide.id,
                type: 'driver_arrived'
              }
            },
            selectedRide.userId
          );
          console.log('✅ Notificação enviada com sucesso');
        } catch (notificationError) {
          console.error('❌ Erro ao enviar notificação:', notificationError);
          toast.error('Erro ao enviar notificação');
        }
      }

      toast.dismiss(loadingToast);
      toast.success('Passageiro foi notificado!');
    } catch (error) {
      console.error('❌ Erro ao notificar chegada:', error);
      toast.error('Erro ao notificar chegada. Tente novamente.');
    }
  };

  const handleStartRide = async (ride: Ride) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const loadingToast = toast.loading('Iniciando corrida...');

      // Verificar permissão para notificações
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        console.log('❌ Permissão para notificações não concedida');
      }
      
      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      await updateDoc(rideRef, {
        status: 'inProgress',
        startedAt: Timestamp.now()
      });

      // Enviar notificação para o passageiro
      if (ride.userId) {
        console.log('📱 Enviando notificação de início de corrida para:', ride.userId);
        try {
          await sendNotification(
            'Corrida iniciada! 🚗',
            {
              body: `${user?.displayName || 'Seu motorista'} iniciou a corrida`,
              icon: '/ride-started.png',
              badge: '/logo192.png',
              tag: `ride-${ride.id}-started`,
              requireInteraction: true,
              data: {
                rideId: ride.id,
                type: 'ride_started'
              }
            },
            ride.userId
          );
          console.log('✅ Notificação enviada com sucesso');
        } catch (notificationError) {
          console.error('❌ Erro ao enviar notificação:', notificationError);
        }
      }

      setSelectedRide({ ...ride, status: 'inProgress' });
      setShowPickupRoute(false);
      setShowRouteMap(true);

      toast.dismiss(loadingToast);
      toast.success('Corrida iniciada!');
    } catch (error) {
      console.error('❌ Erro ao iniciar corrida:', error);
      toast.error('Erro ao iniciar corrida. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteRide = async (ride: Ride) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      console.log('🔄 Iniciando finalização da corrida:', {
        rideId: ride.id,
        status: ride.status,
        driverId: ride.driverId
      });

      const loadingToast = toast.loading('Finalizando corrida...');

      // Primeiro remover da coleção activeRides
      const activeRideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      console.log('🗑️ Removendo corrida de activeRides:', activeRideRef.path);
      await deleteDoc(activeRideRef);

      // Depois mover para completedRides
      const completedRideRef = doc(db, COLLECTIONS.COMPLETED_RIDES, ride.id);
      console.log('📝 Movendo corrida para completedRides:', completedRideRef.path);
      
      const completedRideData = {
        ...ride,
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: user?.uid,
        finalLocation: currentLocation
      };
      
      console.log('📦 Dados da corrida completada:', completedRideData);
      await setDoc(completedRideRef, completedRideData);

      console.log('🧹 Limpando estados locais');
      
      // Limpar estados em ordem específica
      setSelectedRide(null);
      setShowRouteMap(false);
      setShowPickupRoute(true);
      
      // Usar uma função de callback para garantir que o estado anterior seja removido
      setMyRides(current => current.filter(r => r.id !== ride.id));

      toast.dismiss(loadingToast);
      toast.success('Corrida finalizada com sucesso!');
      
      console.log('✅ Corrida finalizada com sucesso');

      // Forçar uma atualização do estado após um pequeno delay
      setTimeout(() => {
        if (mountedRef.current) {
          console.log('🔄 Forçando atualização final dos estados');
          setSelectedRide(null);
          setShowRouteMap(false);
          setShowPickupRoute(true);
        }
      }, 500);

    } catch (error) {
      console.error('❌ Erro ao finalizar corrida:', error);
      toast.error('Erro ao finalizar corrida. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Adicionar um efeito para limpar estados quando não houver corridas
  useEffect(() => {
    if (myRides.length === 0 && selectedRide) {
      console.log('🧹 Limpando estados pois não há mais corridas');
      setSelectedRide(null);
      setShowRouteMap(false);
      setShowPickupRoute(true);
    }
  }, [myRides, selectedRide]);

  // Memoizar o renderização do mapa
  const renderFullScreenMap = useCallback(() => {
    if (!showRouteMap || !selectedRide) return null;

    // Memoizar as coordenadas para evitar re-renders desnecessários
    const origin = showPickupRoute ? (currentLocation || undefined) : selectedRide.origin?.coordinates;
    const destination = showPickupRoute ? selectedRide.origin?.coordinates : selectedRide.destination?.coordinates;

    return (
      <div className="fixed inset-0 bg-white z-50">
        <div className="bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={() => {
                  setShowRouteMap(false);
                  if (selectedRide.status === 'accepted') {
                    setShowPickupRoute(true);
                  }
                }}
                className="mr-4 p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={24} className="text-gray-600" />
              </button>
              <div>
                <h2 className="text-lg font-semibold">
                  {showPickupRoute ? 'Rota até o passageiro' : 'Rota até o destino'}
                </h2>
                <p className="text-sm text-gray-500">
                  {showPickupRoute 
                    ? selectedRide.origin?.address 
                    : selectedRide.destination?.address}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedRide.status === 'accepted' && (
                <>
                  <button
                    onClick={() => handleNotifyArrival()}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 flex items-center"
                  >
                    <Bell size={20} className="mr-2" />
                    Avisar Chegada
                  </button>
                  <button
                    onClick={() => handleStartRide(selectedRide)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center"
                  >
                    <Car size={20} className="mr-2" />
                    Iniciar Corrida
                  </button>
                </>
              )}
              {selectedRide.status === 'inProgress' && (
                <button
                  onClick={() => handleCompleteRide(selectedRide)}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center"
                >
                  <CheckCircle size={20} className="mr-2" />
                  Finalizar Corrida
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="h-[calc(100vh-72px)]">
          <Map
            className="w-full h-full"
            onlineDrivers={[{
              id: user!.uid,
              currentLocation: currentLocation || [-43.9345, -19.9279],
              name: user!.email?.split('@')[0] || 'Motorista',
              vehicle: {
                model: 'Honda Civic',
                plate: 'ABC1234',
                color: 'Prata'
              },
              rating: 5.0
            }]}
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
          where('driverId', '==', '')
        );

        unsubscribeAvailable = onSnapshot(availableRidesQuery, async (snapshot) => {
          if (!mountedRef.current) {
            console.log('❌ Componente desmontado, ignorando snapshot');
            return;
          }

          const ridesPromises = snapshot.docs.map(async (docSnapshot) => {
            const rideData = docSnapshot.data() as Ride;
            // Buscar informações do usuário
            if (rideData.userId) {
              try {
                const userDoc = await getDoc(doc(db, 'users', rideData.userId));
                const userData = userDoc.data();
                return {
                  ...rideData,
                  id: docSnapshot.id,
                  userName: userData?.displayName || userData?.name || (rideData.userName?.includes('@') ? rideData.userName.split('@')[0] : rideData.userName) || 'Usuário'
                } as Ride;
              } catch (error) {
                console.error('Erro ao buscar dados do usuário:', error);
                return {
                  ...rideData,
                  id: docSnapshot.id
                } as Ride;
              }
            }
            return {
              ...rideData,
              id: docSnapshot.id
            } as Ride;
          });

          const rides = await Promise.all(ridesPromises);
          console.log('✅ Corridas disponíveis processadas:', rides.length);
          if (mountedRef.current) {
            setAvailableRides(rides);
            setLoading(false);
          }
        }, (error) => {
          console.error('❌ Erro no listener de corridas:', error);
          if (mountedRef.current) {
            setError('Erro ao carregar corridas disponíveis');
            setLoading(false);
          }
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
    if (!user || !currentLocation || !mountedRef.current || !isOnline) return;

    const updateLocation = async () => {
      const now = Date.now();
      // Aumentar o intervalo mínimo entre atualizações para 10 segundos
      if (now - lastUpdateTime < 10000) return;

      try {
        const batch = writeBatch(db);
        
        // Atualizar localização na coleção users
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          currentLocation: currentLocation,
          lastLocationUpdate: Timestamp.now()
        });

        // Atualizar localização na coleção drivers
        const driverRef = doc(db, 'drivers', user.uid);
        batch.update(driverRef, {
          currentLocation: currentLocation,
          lastLocationUpdate: Timestamp.now()
        });

        await batch.commit();
        
        if (mountedRef.current) {
          setLastUpdateTime(now);
        }
      } catch (error) {
        console.error('Erro ao atualizar localização:', error);
      }
    };

    updateLocation();
  }, [user, currentLocation, lastUpdateTime, isOnline]);

  // Memoizar o cálculo de distâncias com debounce
  const updateDistances = useCallback(async () => {
    if (!currentLocation || availableRides.length === 0) return;

    // Verificar se as distâncias já foram calculadas e se passou tempo suficiente
    const now = Date.now();
    if (now - lastUpdateTime < 10000) return; // 10 segundos de intervalo

    const needsUpdate = availableRides.some(ride => 
      typeof ride.distanceToPickup === 'undefined' || 
      typeof ride.distance === 'undefined'
    );

    if (!needsUpdate) {
      return;
    }

    console.log('📍 Calculando distâncias para', availableRides.length, 'corridas');

    const updatedRides = await Promise.all(
      availableRides.map(async (ride) => {
        try {
          if (!ride.origin.coordinates) {
            return ride;
          }

          // Verificar se já tem distâncias calculadas
          if (ride.distanceToPickup && ride.distance) {
            return ride;
          }

          // Calcular distância até o ponto de embarque
          const pickupDistance = await calculateDistance(
            currentLocation,
            ride.origin.coordinates
          );

          // Calcular distância total da corrida
          const rideDistance = await calculateDistance(
            ride.origin.coordinates,
            ride.destination.coordinates
          );

          return {
            ...ride,
            distanceToPickup: pickupDistance?.distance || 0,
            durationToPickup: pickupDistance?.duration || 0,
            distance: rideDistance?.distance || 0,
            duration: rideDistance?.duration || 0
          };
        } catch (error) {
          console.error('❌ Erro ao calcular distância para corrida:', ride.id, error);
          return ride;
        }
      })
    );

    if (mountedRef.current) {
      setAvailableRides(updatedRides);
      setLastUpdateTime(now);
    }
  }, [currentLocation, availableRides, lastUpdateTime]);

  // Atualizar distâncias com throttle
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (currentLocation && isOnline) {
      timeoutId = setTimeout(() => {
        updateDistances();
      }, 10000); // 10 segundos de intervalo
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentLocation, updateDistances, isOnline]);

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

      // Primeiro, buscar os dados do passageiro
      const userRef = doc(db, 'users', ride.userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      // Usar o displayName do usuário ou o primeiro nome do email como fallback
      const userName = userData?.displayName || userData?.name || ride.userName?.split('@')[0] || 'Usuário';

      // Atualizar o documento da corrida com o nome correto do usuário
      const rideRef = doc(db, COLLECTIONS.ACTIVE_RIDES, ride.id);
      const rideDoc = await getDoc(rideRef);
      
      if (!rideDoc.exists()) {
        toast.error('Esta corrida não está mais disponível');
        return;
      }

      const rideData = rideDoc.data();
      if (rideData.status !== 'pending' || rideData.driverId !== '') {
        toast.error('Esta corrida já foi aceita por outro motorista');
        return;
      }

      // Verificar status do motorista
      const driverRef = doc(db, 'drivers', user!.uid);
      const driverDoc = await getDoc(driverRef);
      
      if (!driverDoc.exists()) {
        toast.error('Motorista não encontrado');
        return;
      }

      const driverData = driverDoc.data();

      // Garantir que o status está em minúsculo
      if (driverData.status.toLowerCase() !== 'approved') {
        toast.error('Você precisa ser aprovado para aceitar corridas');
        return;
      }

      const driverInfo = {
        id: user!.uid,
        name: driverData.name || user?.displayName || 'Motorista',
        phone: driverData.phone || '64992521789',
        rating: driverData.rating || 5.0,
        vehicle: {
          model: driverData.carModel || 'Honda Civic',
          plate: driverData.carPlate || 'ABC1234',
          color: driverData.carColor || 'Prata'
        },
        currentLocation: currentLocation || [0, 0]
      };

      // Atualizar o documento da corrida com o nome correto do usuário
      await updateDoc(rideRef, {
        status: 'accepted',
        driverId: user!.uid,
        driver: driverInfo,
        acceptedAt: Timestamp.now(),
        userName: userName // Atualizar com o nome correto do usuário
      });

      // Enviar notificação para o passageiro
      if (ride.userId) {
        try {
          await sendNotification(
            'Motorista a caminho! 🚗',
            {
              body: `${driverInfo.name} aceitou sua corrida.\n\nVeículo: ${driverInfo.vehicle.model} ${driverInfo.vehicle.color}\nPlaca: ${driverInfo.vehicle.plate}`,
              icon: '/driver-accepted.png',
              tag: `ride-${ride.id}`,
              requireInteraction: true,
              data: {
                rideId: ride.id,
                type: 'ride_accepted',
                driverInfo
              }
            },
            ride.userId
          );
        } catch (notificationError) {
          console.error('Erro ao enviar notificação:', notificationError);
        }
      }

      setSelectedRide({
        ...ride,
        userName: userName, // Usar o nome correto do usuário
        status: 'accepted',
        driver: driverInfo,
        driverId: user!.uid,
        acceptedAt: Timestamp.now()
      });
      setShowPickupRoute(true);
      setShowRouteMap(true);

      toast.dismiss(loadingToast);
      toast.success('Corrida aceita com sucesso!');
    } catch (error) {
      console.error('Erro ao aceitar corrida:', error);
      toast.error('Erro ao aceitar corrida. Tente novamente.');
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
      return `${Math.round(distanceInMeters)}m`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.round(duration / 60);
    return `${minutes} min`;
  };

  const formatDistanceToPickup = (meters: number | undefined) => {
    if (!meters) return '--';
    // Garantir que a distância está em metros
    const distanceInMeters = meters;
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)}`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)}`;
  };

  const formatDurationToPickup = (seconds: number | undefined) => {
    if (!seconds) return '-- min';
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
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
    <div className="container mx-auto p-4">
      {/* Corridas em andamento */}
      {myRides.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Minhas Corridas em Andamento</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myRides.map((ride) => (
              <div key={ride.id} className="bg-white rounded-lg shadow-md p-4">
                {/* Informações do Passageiro */}
                <div className="flex items-center gap-3 mb-4 bg-gray-50 p-3 rounded-lg">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <UserIcon className="text-primary-600" size={20} />
                  </div>
                  <div>
                    <span className="font-medium text-lg">{ride.userName || 'Usuário'}</span>
                    <div className="text-sm text-gray-500">Passageiro</div>
                  </div>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="text-primary-600 mt-1" size={20} />
                    <div>
                      <p className="text-sm font-medium">Origem</p>
                      <p className="text-sm text-gray-600">{ride.origin?.address || 'Endereço não disponível'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <MapPin className="text-primary-600 mt-1" size={20} />
                    <div>
                      <p className="text-sm font-medium">Destino</p>
                      <p className="text-sm text-gray-600">{ride.destination?.address || 'Endereço não disponível'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <DollarSign className="mx-auto text-gray-500" size={20} />
                    <p className="text-sm font-medium">{formatPrice(ride.price || 0)}</p>
                  </div>
                  <div className="text-center">
                    <Car className="mx-auto text-gray-500" size={20} />
                    <p className="text-sm font-medium">{formatDistance(ride.distance || 0)}</p>
                  </div>
                  <div className="text-center">
                    <Clock className="mx-auto text-gray-500" size={20} />
                    <p className="text-sm font-medium">{formatDuration(ride.duration || 0)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                {ride.status === 'accepted' && (
                    <>
                      <button
                        onClick={() => handleNotifyArrival()}
                        className="flex-1 bg-yellow-500 text-white py-3 px-4 rounded-lg hover:bg-yellow-600 flex items-center justify-center"
                      >
                        <Bell size={20} className="mr-2" />
                        Avisar Chegada
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRide(ride);
                          setShowRouteMap(true);
                          handleStartRide(ride);
                        }}
                        className="flex-1 bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 flex items-center justify-center"
                      >
                        <Car size={20} className="mr-2" />
                        Iniciar Corrida
                      </button>
                    </>
                )}

                {ride.status === 'inProgress' && (
                  <button
                    onClick={() => handleCompleteRide(ride)}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center"
                  >
                    <CheckCircle size={20} className="mr-2" />
                    Finalizar Corrida
                  </button>
                )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corridas disponíveis */}
      <div className="space-y-6 animate-fade-in">
        {/* Header com botão de online/offline */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Corridas Disponíveis</h1>
            <button
              onClick={toggleOnlineStatus}
              disabled={isProcessing}
              className={`flex items-center px-4 py-2 rounded-full transition-colors ${
                isOnline 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              <Power size={20} className="mr-2" />
              {isProcessing ? 'Atualizando...' : (isOnline ? 'Online' : 'Offline')}
            </button>
          </div>
        </div>

        {/* Status atual */}
        {!isOnline && (
          <div className="text-center py-8 text-gray-500">
            <Car size={48} className="mx-auto mb-4 text-gray-400" />
            <p>Você está offline. Fique online para receber corridas.</p>
          </div>
        )}

        {/* Lista de corridas disponíveis */}
        {isOnline && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Carregando corridas...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <p>{error}</p>
              </div>
            ) : availableRides.length === 0 ? (
              <div className="text-center py-8">
                <Car size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Nenhuma corrida disponível no momento</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableRides.map((ride) => (
                  <div key={ride.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Cabeçalho */}
                    <div className="bg-white p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <UserIcon className="text-gray-600" size={20} />
                          <span className="font-medium">{ride.userName?.includes('@') ? ride.userName.split('@')[0] : ride.userName || 'Usuário'}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">R$ {(ride.price || 0).toFixed(2)}</div>
                          <div className="text-xs text-gray-500">+R$ {((ride.price || 0) * 0.2).toFixed(2)} incluído</div>
                        </div>
                      </div>

                      {/* Tempo estimado */}
                      <div className="text-sm text-gray-500 mb-4">
                        Tempo estimado: {formatDurationToPickup(ride.durationToPickup)}
                      </div>

                      {/* Distância até o passageiro */}
                      <div className="flex items-center text-sm mb-4">
                        <span className="font-medium">{formatDistance(ride.distanceToPickup || 0)}</span>
                        <span className="text-gray-500 ml-1">até o passageiro</span>
                      </div>

                      {/* Endereços */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-black mt-2"></div>
                          <div>
                            <p className="font-medium">{ride.origin?.place || 'Local de origem'}</p>
                            <p className="text-sm text-gray-500">Pegar passageiro</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-black mt-2"></div>
                          <div>
                            <p className="font-medium">{ride.destination?.place || 'Local de destino'}</p>
                            <p className="text-sm text-gray-500">
                              Destino final • {formatDistance(ride.distance || 0)} • {formatDuration(ride.duration || 0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Indicador de Alta Demanda */}
                      <div className="flex items-center text-primary-600 text-sm mt-4">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        <span>Oferta de valor alto</span>
                      </div>
                    </div>

                    {/* Botões */}
                    <div className="flex border-t">
                      <button
                        onClick={() => handleRejectRide(ride)}
                        className="flex-1 py-4 text-red-600 font-medium hover:bg-red-50 transition-colors"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => handleAcceptRide(ride)}
                        className="flex-1 py-4 text-primary-600 font-medium hover:bg-primary-50 transition-colors border-l"
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

      {/* Adicionar o mapa em tela cheia */}
      {renderFullScreenMap()}
    </div>
  );
};

export default DriverHome; 