
import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '../services/firebase';
import { dbService } from '../services/storage';

type LoginMode = 'login' | 'register' | 'reset';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imgError, setImgError] = useState(false);
  
  // Form States
  const [mode, setMode] = useState<LoginMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const validatePassword = (pass: string) => {
    if (pass.length < 6) return "A senha deve ter no mínimo 6 caracteres.";
    return null;
  };

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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      let msg = 'Erro ao fazer login.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') msg = 'E-mail ou senha incorretos.';
      if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas falhas. Tente novamente mais tarde.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    const passError = validatePassword(password);
    if (passError) {
      setError(passError);
      return;
    }

    setLoading(true);
    
    try {
      // 1. Verificar se o e-mail existe na base de colaboradores (Segurança)
      const exists = await dbService.checkEmailRegistered(email);
      
      if (!exists) {
        setError('Este e-mail não consta na base de colaboradores. Solicite o cadastro ao Administrador antes de criar sua senha.');
        setLoading(false);
        return;
      }

      // 2. Criar usuário no Auth
      await createUserWithEmailAndPassword(auth, email, password);
      // O usuário já estará logado automaticamente após isso
    } catch (err: any) {
      console.error(err);
      let msg = 'Erro ao criar conta.';
      if (err.code === 'auth/email-already-in-use') msg = 'Este e-mail já possui cadastro. Faça login.';
      if (err.code === 'auth/weak-password') msg = 'A senha é muito fraca.';
      setError(msg);
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Digite seu e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
      setTimeout(() => setMode('login'), 5000);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao enviar e-mail de redefinição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fadeIn">
        
        {/* Logo Section */}
        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="mb-4">
             {!imgError ? (
              <img 
                src="logo.png" 
                onError={() => setImgError(true)}
                alt="Logo do Sistema" 
                className="w-28 h-28 object-contain drop-shadow-md"
              />
            ) : (
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-indigo-600 text-center text-outline-black">Nexo - Gestão de Equipes</h1>
          <p className="text-gray-500 text-sm text-center">Acesso restrito a colaboradores</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6 border-b border-gray-200">
          <button 
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${mode === 'login' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
          >
            Entrar
          </button>
          <button 
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${mode === 'register' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
          >
            Primeiro Acesso
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200 flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-100 text-emerald-700 rounded-lg text-sm border border-emerald-200 flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span>{success}</span>
          </div>
        )}

        {/* Forms */}
        {mode === 'reset' ? (
           <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-lg font-bold text-gray-700">Recuperar Senha</h2>
              <p className="text-xs text-gray-500">Digite seu e-mail para receber um link de redefinição.</p>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">E-mail</label>
                <input 
                  type="email" 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar Link'}
              </button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-sm text-gray-500 hover:text-gray-700 mt-2">
                Voltar para Login
              </button>
           </form>
        ) : (
           <form onSubmit={mode === 'login' ? handleEmailLogin : handleRegister} className="space-y-4">
             <div>
               <label className="text-xs font-bold text-gray-600 block mb-1">E-mail Corporativo</label>
               <input 
                type="email" 
                required
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
               />
               {mode === 'register' && <span className="text-[10px] text-gray-400">O e-mail deve ter sido cadastrado previamente pelo Admin.</span>}
             </div>

             <div>
               <label className="text-xs font-bold text-gray-600 block mb-1">Senha</label>
               <input 
                type="password" 
                required
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
               />
             </div>

             {mode === 'register' && (
               <div>
                 <label className="text-xs font-bold text-gray-600 block mb-1">Confirmar Senha</label>
                 <input 
                  type="password" 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                 />
               </div>
             )}

             {mode === 'login' && (
               <div className="flex justify-end">
                 <button type="button" onClick={() => { setMode('reset'); setError(''); }} className="text-xs text-indigo-600 hover:underline">
                   Esqueceu a senha?
                 </button>
               </div>
             )}

             <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-all shadow-md disabled:opacity-70"
             >
               {loading ? 'Processando...' : (mode === 'login' ? 'Entrar' : 'Criar Senha')}
             </button>
           </form>
        )}

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Ou continue com</span>
          </div>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-70"
        >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Google
        </button>

      </div>
    </div>
  );
};
