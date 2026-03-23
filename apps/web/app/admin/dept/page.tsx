'use client';
// apps/web/app/admin/dept/page.tsx
// Dept Head landing — /admin/dept
// Spec: workload per officer + dept SLA compliance + all dept tasks

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import { addWebSocketListener } from '../../../utils/ws';
import SandboxBanner from '../../../components/SandboxBanner';

const DEMO_MODE = process.env.NEXT_PUBLIC_MODE === 'demo';
const BASE      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-slate-800 text-[var(--grey-text-light)] border border-slate-700',
  assigned:    'bg-blue-950 text-blue-300 border border-blue-800',
  in_progress: 'bg-blue-900/60 text-blue-300 border border-blue-700',
  escalated:   'bg-red-950 text-red-300 border border-red-800',
  resolved:    'bg-emerald-950 text-emerald-300 border border-emerald-800',
  closed:      'bg-slate-800 text-[var(--grey-text-dark)] border border-slate-700',
};

export default function DeptOverview() {
  const router              = useRouter();
  const { token, role }     = useAuthStore();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!token) { router.replace('/'); return; }
    if (role && !['dept_head', 'commissioner'].includes(role)) router.replace('/');
  }, [token, role, router]);

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

  useEffect(() => {
    const remove = addWebSocketListener((event) => {
      if (event.type === 'complaint.status_updated') {
        setComplaints(prev => prev.map(c =>
          c.id === event.complaint_id ? { ...c, status: event.new_status } : c
        ));
      }
    });
    return remove;
  }, []);

  // Derive workload per officer
  const workload: Record<string, { name: string; open: number; resolved: number }> = {};
  complaints.forEach(c => {
    if (!c.assigned_to) return;
    if (!workload[c.assigned_to]) {
      workload[c.assigned_to] = { name: c.officer_name || c.assigned_to.slice(0, 8), open: 0, resolved: 0 };
    }
    if (c.status === 'resolved' || c.status === 'closed') workload[c.assigned_to].resolved++;
    else workload[c.assigned_to].open++;
  });

  // SLA compliance
  const now      = Date.now();
  const active   = complaints.filter(c => !['resolved','closed'].includes(c.status));
  const overdue  = active.filter(c => c.sla_deadline && new Date(c.sla_deadline).getTime() < now);
  const slaRate  = active.length ? Math.round(((active.length - overdue.length) / active.length) * 100) : 100;
  const slaColor = slaRate >= 80 ? 'text-green-600' : slaRate >= 60 ? 'text-amber-600' : 'text-red-600';

  const escalated = complaints.filter(c => c.status === 'escalated').length;

  return (
    <main className="min-h-screen text-white bg-[var(--main-dark-bg)] w-full">
      <SandboxBanner demoMode={DEMO_MODE} />
      <div className="border-b border-white/[0.06] backdrop-blur-md px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ResolveX" className="drop-shadow-sm" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          <div>
            <p className="text-xs text-[var(--grey-text-dark)]">Department head</p>
            <h1 className="text-lg font-semibold text-white">Dept overview</h1>
          </div>
        </div>
        <a href="/admin/map" className="text-xs text-[var(--blue)] hover:text-white hover:underline transition-colors">View map →</a>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'SLA compliance', value: `${slaRate}%`, color: slaColor },
            { label: 'Active',         value: active.length,   color: 'text-blue-800' },
            { label: 'Escalated',      value: escalated,        color: escalated > 0 ? 'text-red-600' : 'text-[var(--grey-text-light)]' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-[#0f1629] rounded-2xl p-5 border border-white/[0.06] shadow-sm text-center">
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-[var(--grey-text-dark)] mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Officer workload */}
        <div className="rounded-3xl border border-white/5 bg-[var(--secondary-dark)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]  shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-[var(--grey-text-light)]">Officer workload</h2>
          </div>
          {Object.keys(workload).length === 0 ? (
            <p className="text-sm text-[var(--grey-text-dark)] text-center py-8">No assignments yet</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {Object.entries(workload).map(([id, w]) => {
                const total = w.open + w.resolved;
                const pct   = total ? Math.round((w.resolved / total) * 100) : 0;
                return (
                  <div key={id} className="px-4 py-3 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center
                                    justify-center text-blue-800 text-xs font-bold flex-shrink-0">
                      {w.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800 truncate">{w.name}</span>
                        <span className="text-xs text-[var(--grey-text-dark)]">{w.open} open · {w.resolved} done</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Complaint feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--grey-text-light)]">All dept complaints</h2>
            <span className="text-xs text-[var(--grey-text-dark)]">{complaints.length} total</span>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl border-white/5 bg-[var(--secondary-dark)] animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {complaints.slice(0, 20).map(c => (
                <div key={c.id}
                  onClick={() => router.push(`/track/${c.id}`)}
                  className="rounded-2xl border border-white/5 bg-[var(--secondary-dark)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]  px-4 py-3 border border-white/[0.06]
                             shadow-sm flex items-center justify-between cursor-pointer
                             hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div>
                    <span className="text-sm font-medium text-slate-800">{c.category}</span>
                    {c.ward_id && <span className="text-xs text-[var(--grey-text-dark)] ml-2">{c.ward_id}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}