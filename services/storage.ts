
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  setDoc,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { Collaborator, EventRecord, OnCallRecord, BalanceAdjustment, VacationRequest, AuditLog, SystemSettings } from '../types';

// Nomes das Coleções no Firestore
const COLLECTIONS = {
  COLLABORATORS: 'collaborators',
  EVENTS: 'events',
  ON_CALLS: 'on_calls',
  ADJUSTMENTS: 'adjustments',
  VACATION_REQUESTS: 'vacation_requests',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
};

// ID fixo para o documento de configurações (já que é único)
const SETTINGS_DOC_ID = 'general_settings';

// Helper para remover campos undefined (Firestore não aceita undefined)
const sanitizePayload = (data: any) => {
  const clean: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      clean[key] = data[key];
    }
  });
  return clean;
};

export const dbService = {
  // --- VALIDATION HELPERS ---
  checkEmailRegistered: async (email: string): Promise<boolean> => {
    try {
      const q = query(collection(db, COLLECTIONS.COLLABORATORS), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Erro ao verificar email:", error);
      return false;
    }
  },

  // --- GENERIC LISTENERS (TEMPO REAL) ---
  // A ordem ({ ...doc.data(), id: doc.id }) garante que o ID do Firestore seja usado
  
  subscribeToCollaborators: (callback: (data: Collaborator[]) => void) => {
    const q = query(collection(db, COLLECTIONS.COLLABORATORS));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Collaborator));
      callback(data);
    }, (error) => {
      console.error("❌ [DB] Erro ao carregar Colaboradores:", error.message);
    });
  },

  subscribeToEvents: (callback: (data: EventRecord[]) => void) => {
    const q = query(collection(db, COLLECTIONS.EVENTS));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as EventRecord));
      callback(data);
    }, (error) => {
      console.error("❌ [DB] Erro ao carregar Eventos:", error.message);
    });
  },

  subscribeToOnCalls: (callback: (data: OnCallRecord[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.ON_CALLS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OnCallRecord));
      callback(data);
    }, (error) => {
      console.error("❌ [DB] Erro ao carregar Plantões:", error.message);
    });
  },

  subscribeToAdjustments: (callback: (data: BalanceAdjustment[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.ADJUSTMENTS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BalanceAdjustment));
      callback(data);
    }, (error) => {
      console.error("❌ [DB] Erro ao carregar Ajustes:", error.message);
    });
  },

  subscribeToVacationRequests: (callback: (data: VacationRequest[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.VACATION_REQUESTS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as VacationRequest));
      callback(data);
    }, (error) => {
      console.error("❌ [DB] Erro ao carregar Solicitações de Férias:", error.message);
    });
  },

  subscribeToSettings: (callback: (data: SystemSettings | null) => void, onError?: (msg: string) => void) => {
    console.log('📡 [DB] Conectando em Settings...');
    return onSnapshot(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), (docSnap) => {
      if (docSnap.exists()) {
        console.log('✅ [DB] Configurações recebidas do banco.', docSnap.data());
        callback(docSnap.data() as SystemSettings);
      } else {
        console.warn('⚠️ [DB] Documento de configurações não existe (ainda). Usando Default.');
        callback(null);
      }
    }, (error) => {
      console.error("❌ [DB] Erro crítico ao ler Configurações:", error);
      let msg = "Erro ao conectar com o banco.";
      if (error.code === 'permission-denied') {
        msg = "🔒 PERMISSÃO NEGADA: Verifique as Regras (Rules) do Firestore no Console do Firebase.";
        console.error(msg);
      }
      if (onError) onError(msg);
    });
  },

  // --- ACTIONS (Escrever no Banco) ---

  // Colaboradores
  addCollaborator: async (colab: Omit<Collaborator, 'id'>) => {
    console.log('💾 [DB] Salvando Colaborador...');
    const { id, ...rest } = colab as any;
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.COLLABORATORS), cleanData);
  },
  updateCollaborator: async (id: string, data: Partial<Collaborator>) => {
    const cleanData = sanitizePayload(data);
    await updateDoc(doc(db, COLLECTIONS.COLLABORATORS, id), cleanData);
  },
  deleteCollaborator: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.COLLABORATORS, id));
  },

  // Eventos
  addEvent: async (evt: EventRecord) => {
    // Garante que o ID local seja removido para que o Firestore gere um novo
    const { id, ...rest } = evt; 
    // Remove campos undefined (ex: schedule quando é folga)
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.EVENTS), cleanData);
  },
  updateEvent: async (id: string, data: Partial<EventRecord>) => {
    const cleanData = sanitizePayload(data);
    await updateDoc(doc(db, COLLECTIONS.EVENTS, id), cleanData);
  },
  deleteEvent: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.EVENTS, id));
  },

  // Plantões
  addOnCall: async (oc: OnCallRecord) => {
    const { id, ...rest } = oc;
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.ON_CALLS), cleanData);
  },
  updateOnCall: async (id: string, data: Partial<OnCallRecord>) => {
    const cleanData = sanitizePayload(data);
    await updateDoc(doc(db, COLLECTIONS.ON_CALLS, id), cleanData);
  },
  deleteOnCall: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.ON_CALLS, id));
  },

  // Ajustes
  addAdjustment: async (adj: BalanceAdjustment) => {
    const { id, ...rest } = adj;
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.ADJUSTMENTS), cleanData);
  },

  // Férias
  addVacationRequest: async (req: VacationRequest) => {
    const { id, ...rest } = req;
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.VACATION_REQUESTS), cleanData);
  },
  updateVacationRequest: async (id: string, data: Partial<VacationRequest>) => {
    const cleanData = sanitizePayload(data);
    await updateDoc(doc(db, COLLECTIONS.VACATION_REQUESTS, id), cleanData);
  },
  deleteVacationRequest: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.VACATION_REQUESTS, id));
  },

  // Configurações
  saveSettings: async (settings: SystemSettings) => {
    console.log('💾 [DB] Tentando salvar Configurações...', settings);
    try {
      const cleanData = sanitizePayload(settings);
      await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), cleanData);
      console.log('✅ [DB] Configurações gravadas com sucesso!');
    } catch (error: any) {
      console.error('❌ [DB] Erro ao salvar configurações:', error);
      if (error.code === 'permission-denied') {
        throw new Error("Sem permissão de escrita. Verifique as Regras do Firebase.");
      }
      throw error;
    }
  },

  // Logs (Apenas escrita)
  logAudit: async (log: AuditLog) => {
    const { id, ...rest } = log;
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanData);
  },

  // --- BACKUP & RESTORE FUNCTIONS ---

  // Exportar todos os dados
  exportSystemData: async () => {
    const backupData: any = {
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    // Lista de coleções para backup (exceto Audit Logs para reduzir tamanho, opcional)
    const collectionsToBackup = [
      COLLECTIONS.COLLABORATORS,
      COLLECTIONS.EVENTS,
      COLLECTIONS.ON_CALLS,
      COLLECTIONS.ADJUSTMENTS,
      COLLECTIONS.VACATION_REQUESTS,
      COLLECTIONS.SETTINGS
    ];

    for (const colName of collectionsToBackup) {
      const snap = await getDocs(collection(db, colName));
      backupData[colName] = snap.docs.map(d => ({ ...d.data(), __id__: d.id }));
    }

    return backupData;
  },

  // Restaurar dados (Importação)
  importSystemData: async (jsonData: any) => {
    // Validação básica
    if (!jsonData.meta || !jsonData[COLLECTIONS.COLLABORATORS]) {
      throw new Error("Formato de arquivo inválido.");
    }

    const collectionsToRestore = [
      COLLECTIONS.COLLABORATORS,
      COLLECTIONS.EVENTS,
      COLLECTIONS.ON_CALLS,
      COLLECTIONS.ADJUSTMENTS,
      COLLECTIONS.VACATION_REQUESTS,
      COLLECTIONS.SETTINGS
    ];

    // Passo 1: Limpar coleções existentes
    // Nota: Em Firestore, deletar coleção inteira requer Cloud Functions ou delete recursivo.
    // Aqui faremos fetch + delete batch para simplicidade no front.
    
    for (const colName of collectionsToRestore) {
      const snap = await getDocs(collection(db, colName));
      // Firestore batch limit is 500 ops
      const batchSize = 400; 
      let batch = writeBatch(db);
      let count = 0;

      for (const docSnap of snap.docs) {
        batch.delete(doc(db, colName, docSnap.id));
        count++;
        if (count >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit(); // Commit remaining
    }

    // Passo 2: Inserir novos dados
    for (const colName of collectionsToRestore) {
      const items = jsonData[colName];
      if (!items || !Array.isArray(items)) continue;

      let batch = writeBatch(db);
      let count = 0;
      const batchSize = 400;

      for (const item of items) {
        const { __id__, ...data } = item;
        // Usa o ID original se existir, senão gera novo
        const docRef = __id__ ? doc(db, colName, __id__) : doc(collection(db, colName));
        
        // Se for Settings, garantir que usa o ID fixo
        if (colName === COLLECTIONS.SETTINGS) {
           // Settings é geralmente um único doc, mas se houver múltiplos no backup,
           // a lógica abaixo funciona. Se for o doc principal:
           if (__id__ === SETTINGS_DOC_ID) {
               batch.set(doc(db, colName, SETTINGS_DOC_ID), sanitizePayload(data));
           } else {
               // Caso tenha backup antigo ou diferente
               batch.set(docRef, sanitizePayload(data));
           }
        } else {
           batch.set(docRef, sanitizePayload(data));
        }

        count++;
        if (count >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    }
  }
};
