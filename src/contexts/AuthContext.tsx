import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  AuthError,
  AuthErrorCodes,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db, COLLECTIONS } from '../utils/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// Define user roles
export type UserRole = 'passenger' | 'driver';

// Define user status
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'active';

// Define user type
export interface AppUser {
  uid: string;
  email: string | null;
  name?: string;
  displayName?: string;
  phone?: string;
  role?: UserRole;
  status?: UserStatus;
  rating?: number;
  isOnline?: boolean;
  totalRides?: number;
  vehicle?: {
    model?: string;
    plate?: string;
    color?: string;
  };
  lastUpdate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define auth context type
interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string, isDriver?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Função para traduzir erros do Firebase
const getAuthErrorMessage = (error: AuthError | Error) => {
  if (error instanceof Error && error.message === 'Dados do usuário não encontrados. Por favor, faça o cadastro primeiro.') {
    return error.message;
  }

  // Se for um erro do Firebase
  const firebaseError = error as AuthError;
  switch (firebaseError.code) {
    case 'auth/user-not-found':
      return 'Usuário não encontrado.';
    case 'auth/wrong-password':
      return 'Senha incorreta.';
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/email-already-in-use':
      return 'Este email já está sendo usado por outra conta.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/operation-not-allowed':
      return 'Operação não permitida.';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique sua internet.';
    default:
      return 'Ocorreu um erro. Tente novamente.';
  }
};

// Auth provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Configurar persistência ao inicializar
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .catch((error) => {
        console.error("Erro ao configurar persistência:", error);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userDoc.data()
            } as AppUser);
          } else {
            // Se o documento não existe, criar com dados padrão
            const userData: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'passenger',
              status: 'pending'
            };
            await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), userData);
            setUser(userData);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const register = async (name: string, email: string, password: string, phone?: string, role?: UserRole) => {
    try {
      console.log('Iniciando processo de registro:', { name, email, role });
      
      // Primeiro, criar o usuário no Firebase Auth
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      console.log('Usuário criado no Firebase Auth:', result.user.uid);
      
      // Preparar os dados do usuário
      const userData: AppUser = {
        uid: result.user.uid,
        email: result.user.email,
        name: name,
        displayName: name,
        phone: phone,
        role: role || 'passenger',
        status: role === 'driver' ? 'pending' : 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        // Atualizar o displayName no Firebase Auth
        await updateProfile(result.user, {
          displayName: name
        });
        console.log('DisplayName atualizado no Firebase Auth');

        // Salvar no Firestore - coleção users
        await setDoc(doc(db, COLLECTIONS.USERS, result.user.uid), userData);
        console.log('Dados do usuário salvos no Firestore');

        // Se for motorista, criar documento na coleção drivers
        if (role === 'driver') {
          const driverData: AppUser = {
            ...userData,
            rating: 5.0,
            isOnline: false,
            totalRides: 0,
            vehicle: {},
            lastUpdate: new Date()
          };
          await setDoc(doc(db, COLLECTIONS.DRIVERS, result.user.uid), driverData);
          console.log('Dados do motorista salvos no Firestore');
        }

        // Atualizar o estado local
        setUser(userData);
        console.log('Estado local atualizado com sucesso');
        
      } catch (error) {
        console.error('Erro ao salvar dados do usuário:', error);
        // Se houver erro após criar o usuário, tentar limpar
        try {
          await result.user.delete();
          console.log('Usuário removido após falha no registro');
        } catch (deleteError) {
          console.error('Erro ao limpar usuário após falha:', deleteError);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Erro no registro:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signIn = async (email: string, password: string, isDriver = false) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Verificar se o usuário existe no Firestore
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, result.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as AppUser;
        
        // Verificar se está tentando logar como motorista
        if (isDriver) {
          // Verificar se já é motorista
          const driverDoc = await getDoc(doc(db, COLLECTIONS.DRIVERS, result.user.uid));
          
          if (!driverDoc.exists()) {
            // Se não for motorista, criar registro como motorista
            const driverData: AppUser = {
              ...userData,
              role: 'driver',
              status: 'pending',
              rating: 5.0,
              isOnline: false,
              totalRides: 0,
              vehicle: {},
              lastUpdate: new Date(),
              updatedAt: new Date()
            };
            
            // Atualizar em ambas as coleções
            await setDoc(doc(db, COLLECTIONS.DRIVERS, result.user.uid), driverData);
            await updateDoc(doc(db, COLLECTIONS.USERS, result.user.uid), {
              role: 'driver',
              status: 'pending',
              updatedAt: new Date()
            });
            
            setUser(driverData);
          } else {
            // Se já é motorista, usar os dados existentes
            setUser({
              ...userData,
              ...driverDoc.data(),
              uid: result.user.uid
            } as AppUser);
          }
        } else {
          // Login como passageiro normal
          setUser({
            ...userData,
            uid: result.user.uid
          } as AppUser);
        }
      } else {
        // Se o documento não existe no Firestore, criar
        const userData: AppUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || '',
          role: isDriver ? 'driver' : 'passenger',
          status: isDriver ? 'pending' : 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, COLLECTIONS.USERS, result.user.uid), userData);
        
        if (isDriver) {
          const driverData: AppUser = {
            ...userData,
            rating: 5.0,
            isOnline: false,
            totalRides: 0,
            vehicle: {},
            lastUpdate: new Date()
          };
          await setDoc(doc(db, COLLECTIONS.DRIVERS, result.user.uid), driverData);
        }
        
        setUser(userData);
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};