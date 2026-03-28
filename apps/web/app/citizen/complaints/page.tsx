'use client';
// apps/web/app/citizen/complaints/page.tsx
// Full complaint history for citizen — linked from citizen/home "View all"

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import SandboxBanner from '../../../components/SandboxBanner';
import type { Complaint } from '../../../utils/types';

const DEMO_MODE = process.env.NEXT_PUBLIC_MODE === 'demo';
const BASE      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: 'text-slate-300',     bg: 'bg-slate-500/20'   },
  assigned:    { label: 'Assigned',    color: 'text-blue-300',      bg: 'bg-blue-500/20'    },
  in_progress: { label: 'In Progress', color: 'text-blue-300',      bg: 'bg-blue-500/20'    },
  escalated:   { label: 'Escalated',   color: 'text-red-300',       bg: 'bg-red-500/20'     },
  resolved:    { label: 'Resolved',    color: 'text-emerald-300',   bg: 'bg-emerald-500/20' },
  closed:      { label: 'Closed',      color: 'text-slate-400',     bg: 'bg-slate-500/20'   },
};

const CATEGORY_ICONS: Record<string, string> = {
  'CAT-01':'🛣️','CAT-02':'🌊','CAT-03':'💡','CAT-04':'🗑️','CAT-05':'🚰',
  'CAT-06':'🌳','CAT-07':'🚧','CAT-08':'📢','CAT-09':'🐕','CAT-10':'📋',
};

export default function CitizenComplaints() {
  const router          = useRouter();
  const { token }       = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');

  useEffect(() => {
    if (!token) { router.replace('/'); return; }
  }, [token, router]);

  const fetchComplaints = useCallback(async () => {
    if (!token) return;
    try {
      const res  = await fetch(`${BASE}/complaints`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setComplaints(data.complaints ?? []);
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const filtered = filter === 'all'
    ? complaints
    : complaints.filter(c => c.status === filter);

  return (
    <main className="min-h-screen text-white bg-[var(--main-dark-bg)] w-full">
      <SandboxBanner demoMode={DEMO_MODE} />
      <div className="border-b border-white/[0.06] backdrop-blur-md px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--grey-text-dark)] hover:text-[var(--grey-text-light)] transition-colors">←</button>
        <img src="/logo.png" alt="ResolveX" className="drop-shadow-sm" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <h1 className="text-lg font-semibold text-white">My complaints</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {['all','pending','in_progress','escalated','resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                ${filter === f
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-[var(--grey-text-dark)] border border-white/[0.06] hover:border-blue-500/30'
                }`}>
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl border-white/5 bg-[var(--secondary-dark)] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-[var(--grey-text-dark)]">No complaints found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => {
              const s = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={c.id}
                  onClick={() => router.push(`/track/${c.id}`)}
                  className="rounded-2xl border border-white/5 bg-[var(--secondary-dark)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]  p-4 border border-white/[0.06]
                             shadow-lg shadow-black/20 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[c.category] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white text-sm">{c.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.color}`}>
                          {s.label}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-[var(--grey-text-dark)] truncate">{c.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-[var(--grey-text-light)]">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          }) : '—'}
                        </p>
                        {c.ward_id && <p className="text-xs text-[var(--grey-text-light)]">· {c.ward_id}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
