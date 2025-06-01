import { Timestamp } from 'firebase/firestore';

export const formatFirestoreTimestamp = (timestamp: Timestamp | { seconds: number, nanoseconds: number } | null | undefined): string => {
  if (!timestamp) return 'Data não disponível';
  
  // Se for um objeto Timestamp do Firestore, usar toDate() diretamente
  if (timestamp instanceof Timestamp) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp.toDate());
  }
  
  // Se for um objeto simples com seconds e nanoseconds (do cache)
  if ('seconds' in timestamp && 'nanoseconds' in timestamp) {
    const date = new Date(timestamp.seconds * 1000);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
  
  return 'Data não disponível';
}; 