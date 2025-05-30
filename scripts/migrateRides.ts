import { db, COLLECTIONS } from '../src/utils/firebase';
import { collection, getDocs, query, addDoc, deleteDoc, doc } from 'firebase/firestore';

const migrateRides = async () => {
  try {
    console.log('🚀 Iniciando migração de corridas...');

    // Buscar todas as corridas da coleção antiga
    const oldRidesRef = collection(db, 'rides');
    const snapshot = await getDocs(oldRidesRef);

    console.log(`📝 Encontradas ${snapshot.docs.length} corridas para migrar`);

    // Contadores
    let active = 0;
    let completed = 0;
    let cancelled = 0;

    // Migrar cada corrida para a coleção apropriada
    for (const doc of snapshot.docs) {
      const ride = { id: doc.id, ...doc.data() };

      try {
        if (ride.status === 'completed') {
          await addDoc(collection(db, COLLECTIONS.COMPLETED_RIDES), ride);
          completed++;
        } else if (ride.status === 'cancelled') {
          await addDoc(collection(db, COLLECTIONS.CANCELLED_RIDES), ride);
          cancelled++;
        } else {
          await addDoc(collection(db, COLLECTIONS.ACTIVE_RIDES), ride);
          active++;
        }

        // Remover da coleção antiga
        await deleteDoc(doc.ref);
      } catch (error) {
        console.error(`❌ Erro ao migrar corrida ${doc.id}:`, error);
      }
    }

    console.log('✅ Migração concluída!');
    console.log(`📊 Resultados:
      - Corridas ativas: ${active}
      - Corridas completadas: ${completed}
      - Corridas canceladas: ${cancelled}
    `);

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  }
};

// Executar migração
migrateRides(); 