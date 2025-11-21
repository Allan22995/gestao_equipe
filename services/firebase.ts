import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const getEnv = (key: string) => {
  // Check for Vite environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  
  // Check for Node/Process environment variables (fallback)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // ignore
  }
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || getEnv('REACT_APP_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_SENDER_ID') || getEnv('REACT_APP_FIREBASE_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID') || getEnv('REACT_APP_FIREBASE_APP_ID')
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);