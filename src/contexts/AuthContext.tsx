import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  User as FirebaseAuthUser,
  AuthError,
  AuthErrorCodes,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { User } from '../types/user';

// Define user roles
export type UserRole = 'passenger' | 'driver';

// Define user status
export type UserStatus = 'pending' | 'approved' | 'rejected';

// Define user type
export interface User {
  uid: string;
  email: string | null;
  name?: string;
  phone?: string;
  role?: UserRole;
  status?: UserStatus;
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, isDriver?: boolean) => Promise<void>;
  signUp: (email: string, password: string, isDriver?: boolean) => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
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
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userDoc.data()
            } as User);
          } else {
            // Se o documento não existe, criar com dados padrão
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'passenger', // Papel padrão
              status: 'pending'
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            setUser(userData as User);
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

  const signUp = async (email: string, password: string, isDriver = false) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Criar documento do usuário
      const userData = {
        uid: result.user.uid,
        email: result.user.email,
        role: isDriver ? 'driver' : 'passenger',
        status: 'pending',
        createdAt: new Date()
      };

      await setDoc(doc(db, 'users', result.user.uid), userData);
      setUser(userData as User);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const signIn = async (email: string, password: string, isDriver = false) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Verificar e atualizar o papel do usuário se necessário
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (isDriver && userData.role !== 'driver') {
          // Atualizar para motorista se necessário
          await updateDoc(doc(db, 'users', result.user.uid), {
            role: 'driver',
            status: 'pending'
          });
          setUser({
            ...userData,
            role: 'driver',
            status: 'pending',
            uid: result.user.uid
          } as User);
        } else {
          setUser({
            ...userData,
            uid: result.user.uid
          } as User);
        }
      } else {
        // Criar novo documento se não existir
        const userData = {
          uid: result.user.uid,
          email: result.user.email,
          role: isDriver ? 'driver' : 'passenger',
          status: 'pending',
          createdAt: new Date()
        };
        await setDoc(doc(db, 'users', result.user.uid), userData);
        setUser(userData as User);
      }
    } catch (error: any) {
      throw new Error(error.message);
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
    signUp,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Auth context hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};