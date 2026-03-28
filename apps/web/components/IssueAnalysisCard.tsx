'use client';
// apps/web/components/IssueAnalysisCard.tsx
// Calls the real classification_and_detection FastAPI service (port 8000)
// to get live AI issue detection rather than hardcoded lookup data.

import { useEffect, useState, useRef } from 'react';
import { analyzeComplaint } from '../utils/api';
import type { ClassifierAnalysis } from '../utils/types';

// ── Static fallback table (used only when classifier is unreachable) ───────────
const FALLBACK_TABLE: Record<string, Array<{ label: string; confidence: number; dept: string }>> = {
  'CAT-01': [{ label: 'Waste accumulation nearby', confidence: 0.71, dept: 'Sanitation' }, { label: 'Waterlogging risk', confidence: 0.58, dept: 'Drainage' }],
  'CAT-02': [{ label: 'Flooding risk', confidence: 0.74, dept: 'Drainage' }, { label: 'Foul odour / sanitation hazard', confidence: 0.63, dept: 'Sanitation' }],
  'CAT-03': [{ label: 'Safety and crime risk', confidence: 0.69, dept: 'Electrical' }, { label: 'Electrical infrastructure age', confidence: 0.52, dept: 'Electrical' }],
  'CAT-04': [{ label: 'Health hazard', confidence: 0.81, dept: 'Sanitation' }, { label: 'Groundwater contamination risk', confidence: 0.55, dept: 'Water' }],
  'CAT-05': [{ label: 'Pipeline burst prediction', confidence: 0.77, dept: 'Water' }, { label: 'Road damage risk', confidence: 0.49, dept: 'Roads' }],
  'CAT-06': [{ label: 'Accessibility barrier', confidence: 0.72, dept: 'Parks' }, { label: 'Rainwater pooling risk', confidence: 0.61, dept: 'Drainage' }],
  'CAT-07': [{ label: 'Traffic flow disruption', confidence: 0.66, dept: 'Roads' }, { label: 'Pedestrian safety risk', confidence: 0.58, dept: 'Roads' }],
  'CAT-08': [{ label: 'Public health hazard', confidence: 0.60, dept: 'Sanitation' }, { label: 'Regulatory violation', confidence: 0.55, dept: 'General' }],
  'CAT-09': [{ label: 'Public safety risk', confidence: 0.73, dept: 'General' }, { label: 'Road accident potential', confidence: 0.61, dept: 'Roads' }],
  'CAT-10': [],
};

// Maps our frontend CAT-XX ids → the category strings the classifier understands
const CATEGORY_TO_CLASSIFIER: Record<string, string> = {
  'CAT-01': 'Roads and Footpaths',
  'CAT-02': 'Drainage and Sewage',
  'CAT-03': 'Streetlighting',
  'CAT-04': 'Waste and Sanitation',
  'CAT-05': 'Water Supply',
  'CAT-06': 'Parks and Public Spaces',
  'CAT-07': 'Encroachment and Illegal',
  'CAT-08': 'Noise and Pollution',
  'CAT-09': 'Stray Animals',
  'CAT-10': 'Other / Miscellaneous',
};

// A minimal human-readable description per category (classifier needs ≥10 chars)
const CATEGORY_DESCRIPTION: Record<string, string> = {
  'CAT-01': 'Damaged road surface or pothole requiring urgent repair',
  'CAT-02': 'Blocked or overflowing drainage and sewage, causing flooding',
  'CAT-03': 'Streetlight not working, causing safety issue at night',
  'CAT-04': 'Uncollected garbage and waste accumulation on the street',
  'CAT-05': 'Water supply disruption or leaking pipeline in the area',
  'CAT-06': 'Damaged or poorly maintained park or public space',
  'CAT-07': 'Illegal encroachment blocking public access or footpath',
  'CAT-08': 'Excessive noise or pollution affecting nearby residents',
  'CAT-09': 'Stray animals posing a risk to public safety on the road',
  'CAT-10': 'General public complaint requiring municipal attention',
};

interface Props {
  category: string;           // CAT-01 … CAT-10
  latitude: number | null;
  longitude: number | null;
  imageUrl?: string | null;   // first uploaded file URL, if any
  description?: string;       // explicit user description
}

type Status = 'loading' | 'live' | 'fallback' | 'duplicate';

export default function IssueAnalysisCard({ category, latitude, longitude, imageUrl, description }: Props) {
  const [status, setStatus]     = useState<Status>('loading');
  const [analysis, setAnalysis] = useState<ClassifierAnalysis | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  // Track which (category, lat, lng) we already fetched to avoid re-firing
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (!category || latitude == null || longitude == null) return;

    const key = `${category}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    setStatus('loading');
    setAnalysis(null);
    setParentId(null);

    const controller = new AbortController();

    analyzeComplaint({
      text_description:       (description && description.trim().length > 0) ? description : (CATEGORY_DESCRIPTION[category] ?? 'Public complaint requiring attention'),
      latitude,
      longitude,
      user_selected_category: CATEGORY_TO_CLASSIFIER[category] ?? category,
      image_url:              imageUrl ?? undefined,
    })
      .then(res => {
        if (res.is_duplicate) {
          setParentId(res.parent_id);
          setStatus('duplicate');
        } else if (res.analysis) {
          setAnalysis(res.analysis);
          setStatus('live');
        } else {
          // No analysis returned — silently fall back
          setStatus('fallback');
        }
      })
      .catch(() => {
        // Classifier offline or network error — use static table
        setStatus('fallback');
      });

    return () => controller.abort();
  }, [category, latitude, longitude, imageUrl, description]);

  if (!category) return null;

  // ── Duplicate detected ────────────────────────────────────────────────────────
  if (status === 'duplicate') {
    return (
      <div className="border border-amber-900/50 rounded-2xl overflow-hidden text-sm bg-amber-950/20 shadow-lg">
        <div className="px-4 py-2 bg-amber-900/40 border-b border-amber-900/50 flex items-center gap-2">
          <span className="text-amber-400 text-base">⚠️</span>
          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">
            Similar complaint detected nearby
          </span>
        </div>
        <div className="px-4 py-3 text-amber-200">
          A complaint has already been filed for a very similar issue at this location.
          {parentId && (
            <span className="block mt-1 text-[10px] text-amber-400/70 font-mono truncate">
              Ref: {parentId}
            </span>
          )}
        </div>
        <div className="px-4 py-2.5 bg-amber-950/40 text-[10px] text-amber-400 font-medium">
          You can still continue — your complaint will be linked to the existing report.
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="border border-white/5 rounded-2xl overflow-hidden text-sm bg-[var(--secondary-dark)] shadow-xl">
        <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          <span className="text-[10px] font-bold text-[var(--grey-text-dark)] uppercase tracking-widest">
            AI Analysing…
          </span>
        </div>
        <div className="px-4 py-4 space-y-4">
          {[80, 60, 70].map((w, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2.5 bg-white/5 rounded-full animate-pulse" style={{ width: `${w}%` }} />
              <div className="h-1 bg-white/[0.03] rounded-full animate-pulse w-full" />
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-white/[0.03] border-t border-white/5">
          <div className="h-2 bg-white/5 rounded animate-pulse w-48" />
        </div>
      </div>
    );
  }

  // ── Live result ───────────────────────────────────────────────────────────────
  if (status === 'live' && analysis) {
    const primary    = analysis.primary_issue;
    const secondaries = analysis.secondary_issues ?? [];
    const totalDepts = 1 + new Set(secondaries.map(s => s.category)).size;

    return (
      <div className="border border-white/5 rounded-2xl overflow-hidden text-sm bg-[var(--secondary-dark)] shadow-2xl">
        <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">
            AI Detected Issues
          </span>
          <span className="ml-auto text-[10px] text-[var(--grey-text-dark)] font-medium">Live analysis</span>
        </div>

        {/* Primary issue */}
        <div className="px-4 py-4 bg-blue-500/5 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-white tracking-tight">{primary.subcategory}</span>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
              Primary · P{primary.priority_score}
            </span>
          </div>
          <p className="text-xs text-blue-300/70 mb-2 font-medium">{primary.category}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${Math.round(primary.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-blue-400 w-8 text-right">
              {Math.round(primary.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Secondary issues */}
        {secondaries.map((issue, i) => (
          <div
            key={i}
            className="px-4 py-4 border-b border-white/5 bg-amber-500/[0.02]"
            style={{
              opacity:   1,
              transform: 'translateY(0)',
              animation: `fadeSlideIn 400ms ${i * 150}ms both`,
            }}
          >
            <p className="font-semibold text-white tracking-tight">{issue.risk_description}</p>
            <p className="text-xs text-amber-300/70 mb-2 font-medium">
              AI Detected · {issue.category}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  style={{ width: `${Math.round(issue.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-amber-400 w-8 text-right">
                {Math.round(issue.confidence * 100)}%
              </span>
            </div>
          </div>
        ))}

        <div className="px-4 py-3 bg-[var(--main-dark-bg)] text-[10px] text-[var(--grey-text-dark)] flex items-center gap-1.5 font-medium">
          <span className="text-white">
            {totalDepts} department{totalDepts !== 1 ? 's' : ''}
          </span>
          notified · AI prediction
        </div>
      </div>
    );
  }

  // ── Fallback (classifier offline) ────────────────────────────────────────────
  const secondaries = FALLBACK_TABLE[category] ?? [];
  const totalDepts  = 1 + new Set(secondaries.map(s => s.dept)).size;

  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden text-sm bg-[var(--secondary-dark)] shadow-xl">
      <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center gap-2">
        <span className="text-[10px] font-bold text-[var(--grey-text-dark)] uppercase tracking-widest">
          AI Issue Preview
        </span>
        <span className="ml-2 text-[10px] text-[var(--grey-text-dark)] font-medium">Estimated intent</span>
        <span className="ml-auto text-[10px] text-amber-400 font-bold">⚠ Offline preview</span>
      </div>

      {/* Primary (category-based) */}
      <div className="px-4 py-4 bg-blue-500/5 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-white tracking-tight">
            {CATEGORY_TO_CLASSIFIER[category] ?? category}
          </span>
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">Primary</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
          <span className="text-[10px] font-bold text-blue-400 w-8 text-right">100%</span>
        </div>
      </div>

      {secondaries.map((issue, i) => (
        <div key={issue.label} className="px-4 py-4 border-b border-white/5 bg-amber-500/[0.02]">
          <p className="font-semibold text-white tracking-tight">{issue.label}</p>
          <p className="text-xs text-amber-300/70 mb-2 font-medium">
            Estimated · Also routed to {issue.dept}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.4)]" style={{ width: `${issue.confidence * 100}%` }} />
            </div>
            <span className="text-[10px] font-bold text-amber-400 w-8 text-right">
              {Math.round(issue.confidence * 100)}%
            </span>
          </div>
        </div>
      ))}

      <div className="px-4 py-3 bg-[var(--main-dark-bg)] text-[10px] text-[var(--grey-text-dark)] flex items-center gap-1.5 font-medium">
        <span className="text-white font-bold">
          {totalDepts} department{totalDepts !== 1 ? 's' : ''}
        </span>
        notified · Intent estimation
      </div>
    </div>
  );
}