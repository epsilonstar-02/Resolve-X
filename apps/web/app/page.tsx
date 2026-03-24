'use client';
// apps/web/app/page.tsx
// Role selection landing page.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { demoLogin } from '../utils/api';
import type { ApiErrorLike } from '../utils/types';
 
const DEMO_MODE = process.env.NEXT_PUBLIC_MODE === 'demo';
 
const ROLES = [
  {
    id:       'citizen',
    label:    'Citizen',
    desc:     'File a complaint or track your submission',
    icon:     '🏙️',
    href:     '/auth/citizen',
  },
  {
    id:       'officer',
    label:    'Municipal Officer',
    desc:     'View assigned tasks and update field status',
    icon:     '👷',
    href:     '/auth/staff',
  },
  {
    id:       'dept_head',
    label:    'Dept Head',
    desc:     'Monitor department workload and SLA compliance',
    icon:     '📋',
    href:     '/auth/staff',
  },
  {
    id:       'commissioner',
    label:    'Commissioner',
    desc:     'City-wide command centre and risk intelligence',
    icon:     '🏛️',
    href:     '/auth/staff',
  },
];
 
export default function RolePicker() {
  const router    = useRouter();
  const { setToken, setRole } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
 
  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await demoLogin();
      setToken(token);
      setRole('citizen');
      router.push('/citizen/home');
    } catch (err) {
      const apiError = err as ApiErrorLike;
      setError(apiError.message ?? 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <main className="min-h-screen text-white bg-[var(--main-dark-bg)] relative overflow-hidden flex flex-col items-center">
      {/* Navbar simulation */}
      <nav className="w-full flex justify-between items-center px-8 py-6 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="ResolveX" className="w-8 h-8 object-contain" />
          <span className="font-semibold tracking-wide">ResolveX</span>
        </div>
        <div className="hidden md:flex gap-8 text-[var(--grey-text-dark)] text-sm">
          <span className="hover:text-white cursor-pointer transition-colors">Platform</span>
          <span className="hover:text-white cursor-pointer transition-colors">Solutions</span>
          <span className="hover:text-white cursor-pointer transition-colors">Resources</span>
          <span className="hover:text-white cursor-pointer transition-colors">Pricing</span>
        </div>
        <button 
          className="bg-[var(--blue)] hover:bg-[var(--navy-dark)] text-white px-6 py-2 rounded-full text-sm transition-all duration-300 shadow-[0_0_15px_rgba(28,78,255,0.4)]"
          onClick={() => {
            const id = prompt('Enter your complaint ID to track it:');
            if (id?.trim()) router.push(`/track/${id.trim()}`);
          }}
        >
          Track Issue
        </button>
      </nav>

      {/* Hero Central Glow (EternaCloud style) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[600px] pointer-events-none z-0 flex justify-center opacity-80">
        <div className="absolute w-[80vw] h-[300px] bg-[var(--purple)] blur-[150px] rounded-[100%] opacity-50" />
        <div className="absolute w-[60vw] h-[200px] bg-[var(--pink)] blur-[120px] rounded-[100%] opacity-40 mt-[50px]" />
        <div className="absolute w-[40vw] h-[150px] bg-[var(--orange)] blur-[100px] rounded-[100%] opacity-40 mt-[100px]" />
      </div>

      {/* Hero content */}
      <div className="relative z-10 w-full max-w-5xl px-4 pt-16 md:pt-24 pb-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8 text-xs font-medium text-[var(--grey-text-light)]">
          ✨ ResolveX Public Beta
        </div>
        <h1 
          className="font-extrabold text-white mb-6 leading-[1.1]"
          style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', letterSpacing: '-0.042vw' }}
        >
          Manage cities with ease.
        </h1>
        <p className="text-[var(--grey-text-dark)] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ fontSize: 'clamp(1rem, 1.389vw, 1.25rem)' }}>
          A collaborative and intuitive platform streamlining civic issue resolution. 
          Unifying citizens and administration on one intelligent CRM.
        </p>
      </div>

      {/* Horizontal Cards Row (Grid) */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-32">
        {ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => router.push(role.href)}
            className="group flex flex-col items-start p-8 rounded-3xl border border-white/5 
                       bg-[var(--secondary-dark)] hover:bg-[#1f162e] 
                       hover:-translate-y-2 transition-all duration-300 ease-out text-left
                       shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl mb-6 group-hover:bg-[var(--blue)] transition-colors duration-300">
              {role.icon}
            </div>
            <h3 className="font-semibold text-white text-lg mb-2" style={{ letterSpacing: '-0.02vw' }}>
              {role.label}
            </h3>
            <p className="text-[var(--grey-text-dark)] text-sm leading-relaxed">
              {role.desc}
            </p>
            <div className="mt-8 flex items-center text-xs text-[var(--blue)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Access portal <span className="ml-1">→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Demo button */}
      {DEMO_MODE && (
        <div className="relative z-20 mt-10 w-full max-w-sm mx-auto px-4 pb-20">
          <div className="p-[1px] rounded-full bg-gradient-to-r from-[var(--orange)] via-[var(--pink)] to-[var(--purple)]">
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-4 px-6 bg-[var(--main-dark-bg)] rounded-full transition-all
                         active:scale-[0.98] disabled:opacity-60
                         flex items-center justify-center gap-3 group hover:bg-transparent"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-[var(--grey-text-light)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-[var(--orange)] group-hover:text-white transition-colors">⚡</span>
              )}
              <span className="text-white font-medium">Try as Demo Citizen</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="relative z-20 mt-4 text-sm text-[var(--pink)] text-center">{error}</p>
      )}
    </main>
  );
}
