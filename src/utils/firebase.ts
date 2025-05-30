import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyB81gssivtIaovPWVr3vqe3tWEN4kCGV8U",
  authDomain: "stilo-uber.firebaseapp.com",
  projectId: "stilo-uber",
  storageBucket: "stilo-uber.appspot.com",
  messagingSenderId: "586806547751",
  appId: "1:586806547751:web:d812d1d9f63c0939e3c502",
  measurementId: "G-FEN66W5V7B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// Coleções para diferentes estados de corridas
export const COLLECTIONS = {
  ACTIVE_RIDES: 'activeRides',     // Corridas pendentes ou em andamento
  COMPLETED_RIDES: 'completedRides', // Corridas finalizadas
  CANCELLED_RIDES: 'cancelledRides', // Corridas canceladas
  USERS: 'users',                   // Usuários do sistema
  DRIVERS: 'drivers'                // Motoristas
};

// Referências das coleções
export const activeRidesRef = collection(db, COLLECTIONS.ACTIVE_RIDES);
export const completedRidesRef = collection(db, COLLECTIONS.COMPLETED_RIDES);
export const cancelledRidesRef = collection(db, COLLECTIONS.CANCELLED_RIDES);
export const usersRef = collection(db, COLLECTIONS.USERS);
export const driversRef = collection(db, COLLECTIONS.DRIVERS);

export default app; 