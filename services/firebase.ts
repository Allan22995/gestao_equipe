
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// No Vite, as variáveis de ambiente DEVEM começar com VITE_
// Se não começarem, elas não são expostas para o navegador por segurança.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Log de Debug para ajudar a entender se carregou
if (!firebaseConfig.apiKey) {
  console.error('ERRO CRÍTICO: Chaves do Firebase não encontradas!');
  console.error('Certifique-se de que as variáveis no Render começam com VITE_');
} else {
  console.log('Firebase configurado com sucesso.');
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
