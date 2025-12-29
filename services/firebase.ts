import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';

// No Vite, as variáveis de ambiente DEVEM começar com VITE_
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Log de Diagnóstico
console.groupCollapsed('🔥 Diagnóstico Firebase');
if (!firebaseConfig.apiKey) {
  console.error('❌ ERRO CRÍTICO: Chaves do Firebase não encontradas!');
  console.error('Verifique o arquivo .env ou as Environment Variables do Render.');
} else {
  console.log('✅ API Key detectada.');
  console.log(`✅ Project ID: ${firebaseConfig.projectId}`);
  console.log('✅ Inicializando App...');
}
console.groupEnd();

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = firebaseAuth.getAuth(app);
export const googleProvider = new firebaseAuth.GoogleAuthProvider();

export const signInWithPopup = firebaseAuth.signInWithPopup;
export const signInWithEmailAndPassword = firebaseAuth.signInWithEmailAndPassword;
export const createUserWithEmailAndPassword = firebaseAuth.createUserWithEmailAndPassword;
export const sendPasswordResetEmail = firebaseAuth.sendPasswordResetEmail;
export const signOut = firebaseAuth.signOut;
export const onAuthStateChanged = firebaseAuth.onAuthStateChanged;

export type User = firebaseAuth.User;
