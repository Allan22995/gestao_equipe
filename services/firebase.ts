import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';

// Helper function to safely access environment variables
// This prevents "Cannot read properties of undefined" if import.meta.env is missing
const getEnv = (key: string) => {
  // 1. Try Vite standard import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Continue
  }

  // 2. Try process.env (Node/Compat)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // Continue
  }

  return '';
};

// Configuração do Firebase
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Log de Diagnóstico
console.groupCollapsed('🔥 Diagnóstico Firebase');
if (!firebaseConfig.apiKey) {
  console.error('❌ ERRO CRÍTICO: Chaves do Firebase não encontradas!');
  console.error('Verifique o arquivo .env ou as Environment Variables do ambiente.');
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