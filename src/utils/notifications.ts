import { getMessaging } from 'firebase/messaging';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

// Interface personalizada para opções de notificação
interface CustomNotificationOptions extends NotificationOptions {
  vibrate?: number[];
}

// Interface para o documento de notificação
interface NotificationDocument {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  createdAt: Timestamp;
  read: boolean;
  userId: string;
  type?: string;
}

// Verifica se o dispositivo suporta notificações
export const checkNotificationSupport = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Verifica se é um dispositivo móvel
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Solicita permissão para notificações
export const requestNotificationPermission = async (): Promise<boolean> => {
  console.log('🔔 Solicitando permissão para notificações...');
  
  if (!('Notification' in window)) {
    console.log('❌ Navegador não suporta notificações');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('📱 Status da permissão:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('❌ Erro ao solicitar permissão:', error);
    return false;
  }
};

// Salva notificação no histórico com retry e tratamento de erro
const saveNotificationToHistory = async (
  userId: string,
  title: string,
  options: CustomNotificationOptions,
  retryCount = 0
): Promise<boolean> => {
  try {
    console.log('📝 Tentando salvar notificação para usuário:', userId);

    // Verificar se o usuário existe
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('❌ Usuário não encontrado:', userId);
      return false;
    }

    // Criar documento de notificação
    const notificationData: NotificationDocument = {
      title,
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      data: options.data,
      createdAt: Timestamp.now(),
      read: false,
      userId,
      type: options.data?.type || 'default'
    };

    // Criar subcoleção notifications dentro da coleção users
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    await addDoc(notificationsRef, notificationData);
    
    console.log('✅ Notificação salva com sucesso');
    return true;
  } catch (error) {
    console.error(`❌ Erro ao salvar notificação (tentativa ${retryCount + 1}):`, error);
    
    // Tentar novamente até 3 vezes com delay crescente
    if (retryCount < 2) {
      const delay = 1000 * (retryCount + 1);
      console.log(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return saveNotificationToHistory(userId, title, options, retryCount + 1);
    }
    
    console.warn('⚠️ Não foi possível salvar a notificação no histórico após várias tentativas');
    return false;
  }
};

// Envia uma notificação
export const sendNotification = async (
  title: string,
  options: CustomNotificationOptions = {},
  userId?: string
) => {
  console.log('🔔 Iniciando envio de notificação:', { title, options, userId });

  try {
    // Verificar permissão
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('❌ Sem permissão para enviar notificações');
      return null;
    }

    // Se tiver userId, tentar salvar no histórico primeiro
    if (userId) {
      console.log('📝 Tentando salvar notificação no histórico do usuário:', userId);
      await saveNotificationToHistory(userId, title, options);
    }

    // Configurar opções padrão
    const defaultOptions: CustomNotificationOptions = {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options
    };

    console.log('📱 Enviando notificação com opções:', defaultOptions);

    // Criar e mostrar notificação
    const notification = new Notification(title, defaultOptions);

    // Adicionar handlers de eventos
    notification.onclick = (event) => {
      console.log('👆 Notificação clicada:', event);
      event.preventDefault();
      window.focus();
      if (options.data?.url) {
        window.location.href = options.data.url;
      }
    };

    notification.onshow = () => {
      console.log('✅ Notificação mostrada com sucesso');
    };

    notification.onerror = (error) => {
      console.error('❌ Erro ao mostrar notificação:', error);
    };

    return notification;
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error);
    return null;
  }
};

// Registrar service worker para notificações em background
export const registerNotificationServiceWorker = async () => {
  console.log('🔄 Registrando service worker para notificações...');
  
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/notification-sw.js');
      console.log('✅ Service worker registrado:', registration);
      return registration;
    } catch (error) {
      console.error('❌ Erro ao registrar service worker:', error);
      return null;
    }
  } else {
    console.log('❌ Service Worker não suportado neste navegador');
    return null;
  }
}; 