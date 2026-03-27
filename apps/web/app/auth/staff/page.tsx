'use client';
// apps/web/app/auth/staff/page.tsx
// Staff login — employee ID + password, then TOTP 2FA.
// Covers officer, dept_head, and commissioner roles.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import type { ApiErrorLike } from '../../../utils/types';

type Step = 'credentials' | 'totp';

const _host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const BASE = process.env.NEXT_PUBLIC_API_URL || `http://${_host}:4000/api/v1`;

async function staffLogin(employee_id: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ employee_id, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Login failed');
  return data; // { partial_session: true, user_id }
}

async function staffLogin2fa(user_id: string, totp: string) {
  const res = await fetch(`${BASE}/auth/login/2fa`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include', // receives HttpOnly refresh cookie
    body:        JSON.stringify({ user_id, totp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Invalid code');
  return data; // { token, user: { role } }
}

const ROLE_LANDING: Record<string, string> = {
  officer:      '/officer/tasks',
  dept_head:    '/admin/dept',
  commissioner: '/admin/command',
};

export default function StaffAuth() {
  const router = useRouter();
  const { setToken, setRole } = useAuthStore();

  const [step, setStep]           = useState<Step>('credentials');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword]   = useState('');
  const [totp, setTotp]           = useState('');
  const [userId, setUserId]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleCredentials = async () => {
    if (!employeeId.trim() || !password) {
      setError('Enter your employee ID and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await staffLogin(employeeId.trim(), password);
      setUserId(data.user_id);
      setStep('totp');
    } catch (err) {
      const apiError = err as ApiErrorLike;
      setError(apiError.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async () => {
    if (totp.length !== 6) { setError('Enter the 6-digit authenticator code'); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await staffLogin2fa(userId, totp);
      setToken(data.token);
      setRole(data.user.role);
      router.push(ROLE_LANDING[data.user.role] ?? '/admin/dashboard');
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
          {step === 'credentials' ? 'Staff Login' : 'Two-factor authentication'}
        </h1>
        <p className="text-sm text-white/60 mb-8 text-center">
          {step === 'credentials'
            ? 'Use your government employee ID and password'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>

        {/* Credentials step */}
        {step === 'credentials' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="BBMP-W14-DRN-042"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                           font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--blue)] focus:border-[var(--blue)] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCredentials()}
                  placeholder="••••••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                             text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--blue)] focus:border-[var(--blue)] pr-12 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40
                             hover:text-white/70 text-xs transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleCredentials}
              disabled={loading}
              className="w-full py-3 bg-[var(--blue)] text-white rounded-xl font-semibold
                         shadow-lg shadow-[0_0_15px_rgba(28,78,255,0.4)] hover:bg-[var(--navy)]
                         disabled:opacity-50 active:scale-[0.97] transition-all duration-200"
            >
              {loading ? 'Signing in…' : 'Continue'}
            </button>
          </div>
        )}

        {/* TOTP step */}
        {step === 'totp' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleTotp()}
                placeholder="000000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 
                           tracking-widest text-center text-xl font-mono text-white placeholder:text-white/30
                           focus:outline-none focus:ring-2 focus:ring-[var(--blue)] focus:border-[var(--blue)] transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleTotp}
              disabled={loading}
              className="w-full py-3 bg-[var(--navy)] text-white rounded-xl font-semibold
                         shadow-lg shadow-[0_0_15px_rgba(28,78,255,0.4)] hover:bg-[var(--blue)]
                         disabled:opacity-50 active:scale-[0.97] transition-all duration-200"
            >
              {loading ? 'Verifying…' : 'Sign in'}
            </button>
            <p className="text-xs text-center text-white/40 mt-2">
              Open Google Authenticator or Authy to get your code
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
