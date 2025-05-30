import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

const quickDestinations = [
  {
    name: "Shopping Ibirapuera",
    address: "Av. Ibirapuera, 3103 - Moema, São Paulo - SP",
    icon: "🛍️"
  },
  {
    name: "Aeroporto de Congonhas",
    address: "Av. Washington Luís, s/n - Vila Congonhas, São Paulo - SP",
    icon: "✈️"
  },
  {
    name: "Parque Ibirapuera",
    address: "Av. Pedro Álvares Cabral - Vila Mariana, São Paulo - SP",
    icon: "🌳"
  }
];

const vehicleCategories = [
  {
    name: "Econômico",
    description: "Carros compactos para até 4 pessoas",
    estimatedPrice: 15.90,
    estimatedTime: "5-10 min",
    icon: "🚗"
  },
  {
    name: "Confort",
    description: "Carros espaçosos com ar condicionado",
    estimatedPrice: 20.90,
    estimatedTime: "5-10 min",
    icon: "🚙"
  },
  {
    name: "Premium",
    description: "Carros luxuosos para até 4 pessoas",
    estimatedPrice: 35.90,
    estimatedTime: "8-15 min",
    icon: "🚘"
  }
];

export const seedDatabase = async () => {
  try {
    // Adicionar destinos rápidos
    const quickDestinationsRef = collection(db, 'quickDestinations');
    for (const destination of quickDestinations) {
      await addDoc(quickDestinationsRef, destination);
    }
    console.log('✅ Destinos rápidos adicionados com sucesso!');

    // Adicionar categorias de veículos
    const vehicleCategoriesRef = collection(db, 'vehicleCategories');
    for (const category of vehicleCategories) {
      await addDoc(vehicleCategoriesRef, category);
    }
    console.log('✅ Categorias de veículos adicionadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao popular o banco de dados:', error);
  }
}; 