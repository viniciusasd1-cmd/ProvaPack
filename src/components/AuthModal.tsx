import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Mail, ArrowRight, RefreshCw, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMessage?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMessage
}) => {
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setOtpCode(['', '', '', '', '', '']);
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Cooldown countdown timer (60s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Informe um e-mail válido.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await sendOtp(cleanEmail);
    setLoading(false);

    if (res.success) {
      setStep(2);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } else {
      setErrorMsg(res.error || 'Não foi possível enviar o código. Tente novamente.');
    }
  };

  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpCode.join('').trim();
    if (code.length < 6) {
      setErrorMsg('Digite o código de 6 dígitos completo.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await verifyOtp(email, code);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMsg(res.error || 'Código incorreto ou expirado.');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setErrorMsg(null);

    const res = await sendOtp(email);
    setLoading(false);

    if (res.success) {
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } else {
      setErrorMsg(res.error || 'Erro ao reenviar o código.');
    }
  };

  // Handle multi-box OTP typing & paste
  const handleDigitChange = (index: number, val: string) => {
    const digitsOnly = val.replace(/\D/g, '');
    
    // Support paste of entire 6-digit code
    if (digitsOnly.length > 1) {
      const parts = digitsOnly.slice(0, 6).split('');
      const newOtp = [...otpCode];
      parts.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtpCode(newOtp);
      const nextFocus = Math.min(parts.length, 5);
      inputRefs.current[nextFocus]?.focus();
      if (parts.length === 6) {
        setTimeout(() => handleVerifyCode(), 100);
      }
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = digitsOnly.slice(-1);
    setOtpCode(newOtp);

    // Auto advance to next box
    if (digitsOnly && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit if 6th digit filled
    if (digitsOnly && index === 5) {
      const full = [...newOtp.slice(0, 5), digitsOnly].join('');
      if (full.length === 6) {
        setTimeout(() => handleVerifyCode(), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4 mx-auto sm:mx-0">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>

        {/* Step 1: Solicitar E-mail */}
        {step === 1 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              ACESSAR PROVAPACK
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Informe seu e-mail para salvar seus créditos e acessar sua conta em qualquer dispositivo.
            </p>

            {initialMessage && (
              <div className="mt-3 p-3 rounded-xl bg-sky-950/60 border border-sky-800/80 text-xs text-sky-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                <span>{initialMessage}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendEmail} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Seu E-mail Profissional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendedor@email.com"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-98 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando código...</span>
                  </>
                ) : (
                  <>
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-500">
                  Sem senhas para decorar. Você recebe um código seguro de 6 dígitos no seu e-mail.
                </span>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Inserir Código OTP de 6 dígitos */}
        {step === 2 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              ACESSAR PROVAPACK
            </h2>
            <div className="mt-2 text-xs sm:text-sm text-slate-400">
              <span>Código enviado para </span>
              <strong className="text-slate-200 font-semibold">{email}</strong>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-2 text-xs text-sky-400 hover:underline inline-block"
              >
                (alterar)
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="mt-5 space-y-5">
              {/* 6-box OTP visual code */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 text-center">
                  Digite o código de 6 dígitos recebido
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="submit"
                  disabled={loading || otpCode.join('').length < 6}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-98 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando código...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Confirmar código</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? (
                    <span>Reenviar código em {resendCooldown}s</span>
                  ) : (
                    <span>Reenviar código</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
