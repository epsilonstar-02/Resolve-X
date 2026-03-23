---
name: resolvex-design
description: Design system and UI beautification guidelines for ResolveX page.tsx files
---

# ResolveX UI Design Skill — EternaCloud Aesthetic

> **Philosophy**: Built matching the breathtaking EternaCloud Dribbble aesthetic.
> An ultra-premium, dark glassmorphism UI powered by dynamic glowing ambient meshes, massive fluid typography, and heavy, deep structural shadows. 

## Scope
Only `page.tsx` files inside `apps/web/app/`. All changes are strictly visual — Tailwind class swaps, inline style tweaks. **Zero logic changes.**

---

## 1. Global Background Construction
**Every page** must use the `--main-dark-bg` (`#13101c`) base and feature the 4-orb lightweight ambient mesh background behind its main content to avoid a flat look.

```tsx
<main className="min-h-screen text-white bg-[var(--main-dark-bg)] w-full relative overflow-hidden flex flex-col items-center">
  {/* Ambient Mesh Gradient */}
  <div className="absolute inset-x-0 top-[-10%] h-[800px] w-full pointer-events-none opacity-50 z-0 flex justify-center">
    <div className="absolute top-0 right-[15%] w-[600px] h-[600px] rounded-full bg-[var(--purple)] blur-[120px] mix-blend-screen opacity-50" />
    <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[var(--blue)] blur-[100px] mix-blend-screen opacity-40" />
    <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] rounded-full bg-[var(--pink)] blur-[120px] mix-blend-screen opacity-30" />
    <div className="absolute top-[-5%] left-[30%] w-[400px] h-[400px] rounded-full bg-[var(--orange)] blur-[100px] mix-blend-screen opacity-20" />
  </div>

  {/* Main content must be relative z-10 to float over the mesh */}
  <div className="relative z-10 p-4 max-w-7xl mx-auto w-full">
    {/* Page content */}
  </div>
</main>
```

---

## 2. Typography & Letter-Spacing
Inspired by MazzardH styling.
- **Headers:** Very tight tracking (`letterSpacing: '-0.042vw'`) and fluid clamp styling.
  `className="font-extrabold text-white leading-[1.1] tracking-tight"`
- **Body:** `text-[var(--grey-text-dark)]` with relaxed line height.

## 3. Glassmorphic Containers (Cards & Panels)
The primary surface for interactive elements. Notice the extreme `3xl` border radius.

```tsx
bg-[var(--secondary-dark)] rounded-3xl border border-white/5 
shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6 md:p-8 backdrop-blur-sm
```

**Hover State for actionable cards:**
```tsx
hover:-translate-y-1 hover:border-white/10 hover:bg-[#1a1326]/80 
transition-all duration-300 ease-out
```

## 4. Pills and Filter Tabs
Do not use harsh squares. Use `rounded-full` pills to match EternaCloud softness.

**Active Tab:**
```tsx
bg-white/10 text-white border border-white/20 rounded-full px-4 py-1.5 shadow-sm text-sm font-medium
```

**Inactive Tab:**
```tsx
bg-transparent text-[var(--grey-text-dark)] hover:text-white border border-transparent hover:border-white/5 rounded-full px-4 py-1.5 text-sm transition-colors
```

## 5. Buttons & CTA
Primary action buttons should feel substantial but rounded.

```tsx
bg-[var(--blue)] hover:bg-[var(--navy)] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(28,78,255,0.4)]
```

## 6. Status Rules
- Neutral/Empty states: `text-[var(--grey-text-dark)]`
- Action needed: `text-[var(--pink)]` or `text-[var(--orange)]`
- Success/Completed: `text-emerald-400`
