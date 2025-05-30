import { Timestamp } from 'firebase/firestore';

export const formatFirestoreTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'Data não disponível';
  
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}; 