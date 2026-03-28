'use client';

 
import { useParams }    from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { getComplaint, submitFeedback } from '../../../utils/api';
import { addWebSocketListener } from '../../../utils/ws';
import { useAuthStore } from '../../../store/auth';
import SandboxBanner from '../../../components/SandboxBanner';
import type { ApiErrorLike, Complaint, ComplaintHistoryEntry } from '../../../utils/types';
 
const DEMO_MODE = process.env.NEXT_PUBLIC_MODE === 'demo';
 
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-slate-800 text-slate-300 border border-slate-700'   },
  assigned:    { label: 'Assigned',    color: 'bg-blue-950 text-blue-300 border border-blue-800'      },
  in_progress: { label: 'In Progress', color: 'bg-blue-900/60 text-blue-300 border border-blue-700'     },
  escalated:   { label: 'Escalated',   color: 'bg-red-950 text-red-300 border border-red-800'        },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-950 text-emerald-300 border border-emerald-800'},
  closed:      { label: 'Closed',      color: 'bg-slate-800 text-slate-400 border border-slate-700'   },
};
 
export default function TrackComplaint() {
  const params     = useParams();
  const id         = params?.id as string;
  const { token }  = useAuthStore();
 
  const [complaint, setComplaint]   = useState<Complaint | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [csatRating, setCsatRating] = useState<number | null>(null);
  const [csatComment, setCsatComment] = useState('');
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [timeLeft, setTimeLeft]     = useState<string | null>(null);
 
  const fetchComplaint = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getComplaint(id, token ?? undefined);
      setComplaint(data);
      setError(null);
    } catch (err) {
      const apiError = err as ApiErrorLike;
      setError(apiError.message ?? 'Complaint not found');
    } finally {
      setLoading(false);
    }
  }, [id, token]);
 
  // Initial load
  useEffect(() => { fetchComplaint(); }, [fetchComplaint]);
 
  // SLA countdown timer
  useEffect(() => {
    if (!complaint?.sla_deadline) return;
    const deadline = complaint.sla_deadline;
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Overdue'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m remaining`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [complaint?.sla_deadline]);
 
  // WebSocket — listen for status updates on this complaint
  useEffect(() => {
    const remove = addWebSocketListener((event) => {
      if (
        event.type === 'complaint.status_updated' &&
        event.complaint_id === id
      ) {
        fetchComplaint();
      }
    });
    return remove; // cleanup on unmount
  }, [id, fetchComplaint]);
 
  const handleCsatSubmit = async () => {
    if (!csatRating || !token) return;
    try {
      await submitFeedback(id, csatRating, csatComment, token);
      setCsatSubmitted(true);
    } catch { /* non-fatal */ }
  };
 
  if (loading) return (
    <main className="max-w-lg mx-auto mt-10 px-4">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-32 bg-slate-200 rounded" />
      </div>
    </main>
  );
 
  if (error) return (
    <main className="max-w-lg mx-auto mt-10 px-4 text-center">
      <p className="text-red-600">{error}</p>
      <Link href="/" className="text-blue-700 text-sm mt-4 block hover:text-blue-900 hover:underline transition-colors">← Back to home</Link>
    </main>
  );
 
  const complaintStatus = complaint?.status ?? 'pending';
  const statusInfo = STATUS_LABELS[complaintStatus] ?? STATUS_LABELS.pending;
  const isResolved = ['resolved', 'closed'].includes(complaintStatus);
  const history = complaint?.history ?? [];
 
  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <SandboxBanner demoMode={DEMO_MODE} />
 
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-white">Complaint status</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <p className="text-xs text-slate-400 font-mono">{id}</p>
      </div>
 
      {/* SLA countdown */}
      {complaint?.sla_deadline && !isResolved && (
        <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-medium
          ${timeLeft === 'Overdue'
            ? 'bg-red-950 text-red-300 border border-red-800 border border-red-200'
            : 'bg-blue-50 text-blue-800 border border-blue-100'
          }`}>
          {timeLeft === 'Overdue' ? '⚠ SLA deadline passed' : `⏱ ${timeLeft}`}
        </div>
      )}
 
      {/* Details */}
      <div className="bg-[var(--secondary-dark)] border border-white/5 rounded-2xl p-4 mb-6 space-y-2 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between">
          <span className="text-[var(--grey-text-dark)]">Category</span>
          <span className="font-medium text-white">{complaint?.category}</span>
        </div>
        {complaint?.ward_id && (
          <div className="flex justify-between">
            <span className="text-[var(--grey-text-dark)]">Ward</span>
            <span className="font-medium text-white">{complaint.ward_id}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--grey-text-dark)]">Filed</span>
          <span className="font-medium text-white">
            {complaint?.created_at
              ? new Date(complaint.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : '—'}
          </span>
        </div>
      </div>
 
      {/* History timeline */}
      {history.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Timeline</h3>
          <ol className="relative border-l border-white/[0.06] ml-3 space-y-4">
            {history.map((entry: ComplaintHistoryEntry, i: number) => (
              <li key={i} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--main-dark-bg)] shadow-[0_0_8px_var(--emerald-500)]" />
                <div className="text-sm">
                  <p className="font-medium text-white capitalize">
                    {entry.action?.replace(/_/g, ' ')}
                  </p>
                  {entry.note && (
                    <p className="text-[var(--grey-text-light)] text-xs mt-0.5">{entry.note}</p>
                  )}
                  <p className="text-[var(--grey-text-dark)] text-xs mt-0.5">
                    {new Date(entry.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
 
        <div className="bg-[var(--secondary-dark)] border border-white/5 rounded-2xl p-4 mb-6 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <h3 className="text-sm font-semibold text-white mb-3 tracking-tight">
            How was your experience?
          </h3>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setCsatRating(n)}
                className={`w-10 h-10 rounded-full text-lg transition-all
                  ${csatRating === n
                    ? 'bg-emerald-500 text-white scale-110'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-300'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            className="w-full border border-white/[0.06] rounded-lg p-2 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400"
            rows={2}
            placeholder="Optional feedback…"
            value={csatComment}
            onChange={e => setCsatComment(e.target.value)}
          />
          <button
            onClick={handleCsatSubmit}
            disabled={!csatRating}
            className="mt-2 w-full py-2 bg-blue-500 text-white text-sm rounded-lg
                       font-semibold disabled:opacity-50 hover:bg-blue-400
                       shadow-lg shadow-blue-500/20 transition-all"
          >
            Submit feedback
          </button>
        </div>
      )}
 
      {csatSubmitted && (
        <div className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-sm text-center py-3 rounded-xl mb-6">
          Thank you for your feedback
        </div>
      )}
 
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors">← Back to home</Link>
    </main>
  );
}
