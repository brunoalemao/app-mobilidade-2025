// Verifica se o dispositivo suporta notificações
export const checkNotificationSupport = () => {
  return 'Notification' in window;
};

// Verifica se é um dispositivo móvel
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Interface estendida para opções de notificação
interface ExtendedNotificationOptions extends NotificationOptions {
  onClick?: () => void;
  vibrate?: number[];
  sound?: string;
}

// Sons disponíveis para notificações
export const NotificationSounds = {
  NEW_RIDE: '/sounds/new-ride.mp3',
  RIDE_ACCEPTED: '/sounds/ride-accepted.mp3',
  DRIVER_ARRIVED: '/sounds/driver-arrived.mp3',
  RIDE_COMPLETED: '/sounds/ride-completed.mp3',
  DEFAULT: '/sounds/notification.mp3'
} as const;

// Cache de áudio para melhor performance
const audioCache: { [key: string]: HTMLAudioElement } = {};

// Função para tocar som
const playSound = async (soundUrl: string) => {
  try {
    // Usar áudio em cache ou criar novo
    if (!audioCache[soundUrl]) {
      audioCache[soundUrl] = new Audio(soundUrl);
    }

    const audio = audioCache[soundUrl];
    
    // Reiniciar o áudio se já estiver tocando
    audio.currentTime = 0;
    
    // Tocar o som
    await audio.play();
    
    return true;
  } catch (error) {
    console.warn('Erro ao tocar som:', error);
    return false;
  }
};

// Função para vibrar o dispositivo
const vibrateDevice = (pattern: number[] = [200, 100, 200]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Erro ao vibrar dispositivo:', error);
    }
  }
};

// Solicita permissão para notificações
export const requestNotificationPermission = async () => {
  if (!checkNotificationSupport()) {
    console.log('Este dispositivo não suporta notificações');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Erro ao solicitar permissão de notificação:', error);
    return false;
  }
};

// Envia uma notificação
export const sendNotification = async (title: string, options: ExtendedNotificationOptions = {}) => {
  if (!checkNotificationSupport()) {
    console.log('Este dispositivo não suporta notificações');
    return;
  }

  try {
    // Solicitar permissão se ainda não foi concedida
    if (Notification.permission === 'default') {
      const permission = await requestNotificationPermission();
      if (!permission) {
        console.log('Permissão para notificações não concedida');
        return;
      }
    } else if (Notification.permission !== 'granted') {
      console.log('Permissão para notificações não concedida');
      return;
    }

    const isMobile = isMobileDevice();
    
    // Configurar padrão de vibração baseado no tipo de notificação
    const defaultVibration = [200, 100, 200]; // Padrão: vibrar, pausa, vibrar
    const urgentVibration = [200, 100, 200, 100, 200]; // Urgente: vibrar mais vezes

    // Separar as opções personalizadas das opções padrão do Notification
    const { onClick, sound = NotificationSounds.DEFAULT, ...standardOptions } = options;

    // Se for dispositivo móvel, tocar som e vibrar
    if (isMobile) {
      // Tocar som de notificação
      await playSound(sound);
      
      // Vibrar dispositivo com padrão apropriado
      const vibrationPattern = title.toLowerCase().includes('nova corrida') 
        ? urgentVibration 
        : defaultVibration;
      
      vibrateDevice(vibrationPattern);
    }

    // Criar notificação com opções padrão melhoradas
    const notification = new Notification(title, {
      icon: '/car-icon.svg',
      badge: '/car-icon.svg',
      silent: isMobile, // Silenciar notificação do sistema em dispositivos móveis (usaremos nosso próprio som)
      requireInteraction: true, // Manter notificação até o usuário interagir
      vibrate: isMobile ? (options.vibrate || defaultVibration) : undefined,
      ...standardOptions
    });

    // Manipular clique na notificação
    notification.onclick = function() {
      window.focus();
      if (onClick) {
        onClick();
      }
      notification.close();
    };

    // Registrar erro se houver
    notification.onerror = function(error) {
      console.error('Erro na notificação:', error);
    };

    return notification;
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}; 