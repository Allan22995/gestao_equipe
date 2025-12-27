
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
import { Collaborator, EventRecord, OnCallRecord, BalanceAdjustment, VacationRequest, AuditLog, SystemSettings, Skill } from '../types';

// Nomes das Coleções no Firestore
const COLLECTIONS = {
  COLLABORATORS: 'collaborators',
  EVENTS: 'events',
  ON_CALLS: 'on_calls',
  ADJUSTMENTS: 'adjustments',
  VACATION_REQUESTS: 'vacation_requests',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  SKILLS: 'skills', // Nova Coleção
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

  // NOVO: Listener de Skills
  subscribeToSkills: (callback: (data: Skill[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.SKILLS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Skill));
      callback(data);
    }, (error) => {
      console.error("❌ [DB] Erro ao carregar Skills:", error.message);
    });
  },

  subscribeToSettings: (callback: (data: SystemSettings | null) => void, onError?: (msg: string) => void) => {
    console.log('📡 [DB] Conectando em Settings...');
    return onSnapshot(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), (docSnap) => {
      if (docSnap.exists()) {
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
      }
      if (onError) onError(msg);
    });
  },

  // --- ACTIONS (Escrever no Banco) ---

  // Colaboradores
  addCollaborator: async (colab: Omit<Collaborator, 'id'>) => {
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
    const { id, ...rest } = evt; 
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

  // NOVO: Skills
  addSkill: async (skill: Skill) => {
    const { id, ...rest } = skill;
    const cleanData = sanitizePayload(rest);
    await addDoc(collection(db, COLLECTIONS.SKILLS), cleanData);
  },
  updateSkill: async (id: string, data: Partial<Skill>) => {
    const cleanData = sanitizePayload(data);
    await updateDoc(doc(db, COLLECTIONS.SKILLS, id), cleanData);
  },
  deleteSkill: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.SKILLS, id));
  },

  // Configurações
  saveSettings: async (settings: SystemSettings) => {
    try {
      const cleanData = sanitizePayload(settings);
      await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), cleanData);
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
  }
};
