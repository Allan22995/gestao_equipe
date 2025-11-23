import React, { useState } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup } from 'firebase/auth';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao realizar login com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-fadeIn">
        <div className="mb-6 flex justify-center">
          <img 
            src="/logo.png" 
            alt="Logo do Sistema" 
            className="w-28 h-28 object-contain drop-shadow-md"
          />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Sistema de Gestão</h1>
        <p className="text-gray-500 mb-8">Faça login para acessar suas escalas e ferramentas.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-70"
        >
          {loading ? (
            <span className="animate-pulse">Conectando...</span>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Sistema seguro • Acesso restrito a colaboradores
        </p>
      </div>
    </div>
  );
};