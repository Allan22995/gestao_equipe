
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
  getDocs
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
  // CORREÇÃO: Ordem do spread alterada ({ ...doc.data(), id: doc.id }) para garantir que o ID do Firestore tenha prioridade
  
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
    await addDoc(collection(db, COLLECTIONS.COLLABORATORS), colab);
  },
  updateCollaborator: async (id: string, data: Partial<Collaborator>) => {
    await updateDoc(doc(db, COLLECTIONS.COLLABORATORS, id), data);
  },
  deleteCollaborator: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.COLLABORATORS, id));
  },

  // Eventos
  addEvent: async (evt: EventRecord) => {
    // Garante que o ID local seja removido para que o Firestore gere um novo
    const { id, ...rest } = evt; 
    await addDoc(collection(db, COLLECTIONS.EVENTS), rest);
  },
  updateEvent: async (id: string, data: Partial<EventRecord>) => {
    await updateDoc(doc(db, COLLECTIONS.EVENTS, id), data);
  },
  deleteEvent: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.EVENTS, id));
  },

  // Plantões
  addOnCall: async (oc: OnCallRecord) => {
    const { id, ...rest } = oc;
    await addDoc(collection(db, COLLECTIONS.ON_CALLS), rest);
  },
  updateOnCall: async (id: string, data: Partial<OnCallRecord>) => {
    await updateDoc(doc(db, COLLECTIONS.ON_CALLS, id), data);
  },
  deleteOnCall: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.ON_CALLS, id));
  },

  // Ajustes
  addAdjustment: async (adj: BalanceAdjustment) => {
    const { id, ...rest } = adj;
    await addDoc(collection(db, COLLECTIONS.ADJUSTMENTS), rest);
  },

  // Férias
  addVacationRequest: async (req: VacationRequest) => {
    const { id, ...rest } = req;
    await addDoc(collection(db, COLLECTIONS.VACATION_REQUESTS), rest);
  },
  updateVacationRequest: async (id: string, data: Partial<VacationRequest>) => {
    await updateDoc(doc(db, COLLECTIONS.VACATION_REQUESTS, id), data);
  },
  deleteVacationRequest: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.VACATION_REQUESTS, id));
  },

  // Configurações
  saveSettings: async (settings: SystemSettings) => {
    console.log('💾 [DB] Tentando salvar Configurações...', settings);
    try {
      await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), settings);
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
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), rest);
  }
};
