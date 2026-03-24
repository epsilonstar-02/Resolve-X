'use client';
// apps/web/app/auth/citizen/page.tsx
// Citizen login — phone OTP flow with Google OAuth option.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import { requestOtp, verifyOtp } from '../../../utils/api';
import type { ApiErrorLike } from '../../../utils/types';

type Step = 'phone' | 'otp';

export default function CitizenAuth() {
  const router = useRouter();
  const { setToken, setRole } = useAuthStore();

  const [step, setStep]       = useState<Step>('phone');
  const [phone, setPhone]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const startResendTimer = () => {
    setResendTimer(30);
    const t = setInterval(() => {
      setResendTimer(prev => { if (prev <= 1) { clearInterval(t); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleRequestOtp = async () => {
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!/^\+?[0-9]{10,13}$/.test(cleaned)) {
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestOtp(cleaned);
      setPhone(cleaned);
      setStep('otp');
      startResendTimer();
    } catch (err) {
      const apiError = err as ApiErrorLike;
      setError(apiError.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError(null);
    try {
      const { token } = await verifyOtp(phone, otp);
      setToken(token);
      setRole('citizen');
      router.push('/citizen/home');
    } catch (err) {
      const apiError = err as ApiErrorLike;
      setError(apiError.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-white bg-[var(--main-dark-bg)] w-full relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-x-0 top-[-10%] h-[800px] w-full pointer-events-none opacity-50 z-0">
        <div className="absolute top-0 right-[15%] w-[600px] h-[600px] rounded-full bg-[var(--purple)] blur-[120px] mix-blend-screen opacity-50" />
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--blue)] blur-[100px] mix-blend-screen opacity-40" />
        <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] rounded-full bg-[var(--pink)] blur-[120px] mix-blend-screen opacity-30" />
        <div className="absolute top-[-5%] left-[30%] w-[400px] h-[400px] rounded-full bg-[var(--orange)] blur-[100px] mix-blend-screen opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-sm bg-[var(--secondary-dark)] rounded-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8">
        <button onClick={() => router.push('/')}
          className="text-sm text-[var(--blue)] hover:text-white hover:underline mb-6 block transition-colors">
          ← Back
        </button>

        <img src="/logo.png" alt="ResolveX" className="mx-auto mb-4 drop-shadow-lg" style={{ width: 72, height: 72, objectFit: 'contain' }} />
        <h1 className="text-2xl font-semibold text-white mb-1 text-center">
          {step === 'phone' ? 'Sign in as Citizen' : 'Enter OTP'}
        </h1>
        <p className="text-sm text-white/60 mb-8 text-center">
          {step === 'phone'
            ? 'We\'ll send a 6-digit code to your phone'
            : `Code sent to ${phone}`}
        </p>

        {/* Phone step */}
        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Mobile number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                placeholder="+91 98765 43210"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30
                           focus:outline-none focus:ring-2 focus:ring-[var(--blue)] focus:border-[var(--blue)] transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full py-3 bg-[var(--blue)] text-white rounded-xl font-semibold
                         shadow-lg shadow-[0_0_15px_rgba(28,78,255,0.4)] hover:bg-[var(--navy)]
                         disabled:opacity-50 active:scale-[0.97] transition-all duration-200"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        )}

        {/* OTP step */}
        {step === 'otp' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                placeholder="123456"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                           tracking-widest text-center text-xl font-mono text-white placeholder:text-white/30
                           focus:outline-none focus:ring-2 focus:ring-[var(--blue)] focus:border-[var(--blue)] transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full py-3 bg-[var(--navy)] text-white rounded-xl font-semibold
                         shadow-lg shadow-[0_0_15px_rgba(28,78,255,0.4)] hover:bg-[var(--blue)]
                         disabled:opacity-50 active:scale-[0.97] transition-all duration-200"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-sm text-white/40">Resend in {resendTimer}s</p>
              ) : (
                <button
                  onClick={() => { setStep('phone'); setOtp(''); setError(null); }}
                  className="text-sm text-[var(--blue)] hover:text-white hover:underline transition-colors"
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {/* Dev hint */}
        {process.env.NODE_ENV !== 'production' && (
          <p className="mt-8 text-xs text-center text-white/30">
            Staging OTP: <span className="font-mono">123456</span>
          </p>
        )}
      </div>
    </main>
  );
}
