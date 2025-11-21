
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc
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
  // --- GENERIC LISTENERS (TEMPO REAL) ---
  // Essas funções "escutam" o banco. Sempre que algo mudar lá, elas rodam o callback.
  
  subscribeToCollaborators: (callback: (data: Collaborator[]) => void) => {
    const q = query(collection(db, COLLECTIONS.COLLABORATORS));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collaborator));
      callback(data);
    });
  },

  subscribeToEvents: (callback: (data: EventRecord[]) => void) => {
    const q = query(collection(db, COLLECTIONS.EVENTS)); // Idealmente ordenar por data
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventRecord));
      callback(data);
    });
  },

  subscribeToOnCalls: (callback: (data: OnCallRecord[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.ON_CALLS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnCallRecord));
      callback(data);
    });
  },

  subscribeToAdjustments: (callback: (data: BalanceAdjustment[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.ADJUSTMENTS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BalanceAdjustment));
      callback(data);
    });
  },

  subscribeToVacationRequests: (callback: (data: VacationRequest[]) => void) => {
    return onSnapshot(collection(db, COLLECTIONS.VACATION_REQUESTS), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VacationRequest));
      callback(data);
    });
  },

  subscribeToSettings: (callback: (data: SystemSettings | null) => void) => {
    return onSnapshot(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as SystemSettings);
      } else {
        callback(null);
      }
    });
  },

  // --- ACTIONS (Escrever no Banco) ---

  // Colaboradores
  addCollaborator: async (colab: Omit<Collaborator, 'id'>) => {
    // Firestore cria o ID automaticamente
    await addDoc(collection(db, COLLECTIONS.COLLABORATORS), colab);
  },
  updateCollaborator: async (id: string, data: Partial<Collaborator>) => {
    const ref = doc(db, COLLECTIONS.COLLABORATORS, id);
    await updateDoc(ref, data);
  },
  deleteCollaborator: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.COLLABORATORS, id));
  },

  // Eventos
  addEvent: async (evt: EventRecord) => {
    // Usamos o ID gerado no frontend ou deixamos o firestore gerar. 
    // Como seu app gera UUIDs, podemos usar setDoc com ID específico ou addDoc ignorando o ID do front.
    // Vamos usar addDoc e deixar o Firestore gerenciar IDs para ser mais nativo, 
    // mas como seu app usa IDs para keys, vamos manter a consistência.
    const { id, ...rest } = evt; 
    // Se o ID já existe no objeto, removemos para o Firestore criar um novo, OU usamos setDoc se quisermos forçar aquele ID.
    // Vamos usar addDoc para simplicidade, o ID do firestore será o ID oficial.
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
    await setDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), settings);
  },

  // Logs (Apenas escrita)
  logAudit: async (log: AuditLog) => {
    const { id, ...rest } = log;
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), rest);
  }
};
