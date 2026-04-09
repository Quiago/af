# INAIA Platform · Design System

> Single source of truth for tokens, patterns, and usage rules.  
> Colors come from the Figma color palette (4 chromatic families + grey).  
> All values live in `frontend/src/styles/tokens.css` — never hardcode them in components.

---

## Color Palette

### Primary — Steel Blue
Cool, authoritative. Used for backgrounds, primary actions, and text hierarchy.

| Token | Hex | Usage |
|---|---|---|
| primary/100 | `#EEF1F5` | Page background (`--color-bg`) |
| primary/200 | `#BFCDDC` | Dividers (`--color-divider`) |
| primary/300 | `#8EA7C1` | Borders, cool accent (`--color-border`, `--color-accent-cool`) |
| primary/400 | `#6D8196` | Faint text, primary base button (`--color-text-faint`) |
| primary/500 | `#4E5D6D` | Brand primary, muted text (`--color-primary`, `--color-text-muted`) |
| primary/600 | `#313B46` | Hover state (`--color-primary-hover`) |
| primary/700 | `#171D23` | Dark canvas, active, body text (`--color-canvas`, `--color-text`) |

### Secondary — Sage Teal
Warm, organic. Operational accent — live status, confirmations, comfort zones.

| Token | Hex | Usage |
|---|---|---|
| secondary/100 | `#D8F7F3` | — |
| secondary/200 | `#A2DDD6` | Warm accent soft (`--color-accent-warm`) |
| secondary/300 | `#83B4AE` | Secondary base button |
| secondary/400 | `#658D88` | Live/operational accent (`--color-live`, `--color-accent`) |
| secondary/500 | `#496763` | Status OK (`--color-status-ok`) |
| secondary/600 | `#2F4441` | Deep teal accent (`--color-deep-teal`) |
| secondary/700 | `#172322` | — |

### Tertiary — Slate Lavender
Neutral-cool. Surfaces, card backgrounds, secondary panels.

| Token | Hex | Usage |
|---|---|---|
| tertiary/100 | `#EEEFF4` | Card surface (`--color-surface-2`) |
| tertiary/200 | `#C4C6D7` | — |
| tertiary/300 | `#9A9FBC` | — |
| tertiary/400 | `#7279A0` | — |
| tertiary/500 | `#505678` | Tertiary base button |
| tertiary/600 | `#32364D` | Deep slate accent (`--color-deep-slate`) |
| tertiary/700 | `#161825` | — |

### Quaternary — Deep Purple
Rich, decisive. Deep UI accents, selected states, badges.

| Token | Hex | Usage |
|---|---|---|
| quaternary/100 | `#E8E7F3` | — |
| quaternary/200 | `#C0BCDE` | — |
| quaternary/300 | `#9A93C9` | — |
| quaternary/400 | `#756BB3` | — |
| quaternary/500 | `#534792` | — |
| quaternary/600 | `#322A5C` | Deep purple accent, quaternary button (`--color-deep-purple`) |
| quaternary/700 | `#14102A` | — |

### Grey — Neutral
Pure neutral. Surfaces, offline states, subtle UI.

| Token | Hex | Usage |
|---|---|---|
| grey/100 | `#F0F1F1` | Surface (`--color-surface`) |
| grey/200 | `#C9CBCE` | — |
| grey/300 | `#A1A4A9` | — |
| grey/400 | `#7C7F83` | Status offline (`--color-status-offline`) |
| grey/500 | `#595C5F` | — |
| grey/600 | `#393A3C` | — |
| grey/700 | `#1B1C1D` | — |

### Semantic Status Colors
Not in the chromatic palette — derived independently for clarity.

| Token | Hex | Meaning |
|---|---|---|
| `--color-status-ok` | `#496763` | Healthy / operational |
| `--color-status-warning` | `#C29048` | Degraded / attention |
| `--color-status-critical` | `#B85C73` | Fault / alarm |
| `--color-status-offline` | `#7C7F83` | Disconnected |

---

## Base Colour Tokens (what components use)

```css
/* Backgrounds */
--color-bg            /* page — primary/100 */
--color-surface       /* panel — grey/100 */
--color-surface-2     /* card — tertiary/100 */
--color-canvas        /* dark viewport — primary/700 */

/* Brand */
--color-primary        /* primary/500 */
--color-primary-hover  /* primary/600 */
--color-primary-active /* primary/700 */
--color-primary-soft   /* primary/500 @ 10% */
--color-primary-border /* primary/500 @ 22% */

/* Operational accent */
--color-live           /* secondary/400 */
--color-live-dim       /* secondary/400 @ 12% */

/* Deep triad — buttons, highlights */
--color-deep-teal      /* secondary/600 */
--color-deep-slate     /* tertiary/600 */
--color-deep-purple    /* quaternary/600 */

/* Atmospheric accents */
--color-accent-cool      /* primary/300 */
--color-accent-warm      /* secondary/200 */

/* Text */
--color-text            /* primary/700 */
--color-text-muted      /* primary/500 */
--color-text-faint      /* primary/400 */
--color-text-inverse    /* #FFFFFF */

/* Borders */
--color-border          /* primary/300 */
--color-divider         /* primary/200 */
```

---

## Typography

| Token | Value | Usage |
|---|---|---|
| `--font-display` | Manrope, Inter, system-ui | Headlines, display |
| `--font-body` | Manrope, Inter, system-ui | Body copy, UI labels |
| `--font-mono` | IBM Plex Mono, SFMono | Data values, timestamps, code |

### Type Scale

| Token | px | Usage |
|---|---|---|
| `--text-xs` | 12 | Micro labels, badges |
| `--text-sm` | 14 | Secondary labels, table cells |
| `--text-base` | 16 | Default body |
| `--text-md` | 18 | Slightly larger body |
| `--text-lg` | 22 | Section titles |
| `--text-xl` | 28 | Page titles |
| `--text-2xl` | 36 | Hero / display numbers |

### Leading & Tracking

| Token | Value |
|---|---|
| `--leading-tight` | 1.05 |
| `--leading-snug` | 1.20 |
| `--leading-normal` | 1.50 |
| `--tracking-tight` | -0.03em |
| `--tracking-normal` | -0.01em |
| `--tracking-wide` | 0.04em |
| `--tracking-wider` | 0.08em |

---

## Spacing Scale

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |

---

## Border Radius

| Token | px | Usage |
|---|---|---|
| `--radius-xs` | 6 | Tight chips, small badges |
| `--radius-sm` | 8 | Buttons, inputs |
| `--radius-md` | 14 | Cards |
| `--radius-lg` | 20 | Panels, modals |
| `--radius-xl` | 28 | Large containers |
| `--radius-full` | 999 | Pills, avatars, dots |

---

## Shadows

| Token | Usage |
|---|---|
| `--shadow-xs` | Minimal lift |
| `--shadow-sm` | Cards at rest |
| `--shadow-md` | Floating elements |
| `--shadow-lg` | Modals, overlays |
| `--shadow-soft` | Panels with primary color cast |
| `--shadow-panel` | Dashboard panels |
| `--shadow-glow` | Focused / selected cards (ring + depth) |

---

## Glass / Vibrancy System

Three levels of frosted glass for layered UI.

```css
/* Light frosted — nav bars, sidebars */
.surface-glass {
  background: var(--color-glass-bg);          /* grey/100 @ 82% */
  backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--color-glass-border); /* primary/300 @ 40% */
}

/* Medium frosted — cards, dialogs */
.card-glass {
  background: var(--color-glass-bg);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glow);
}

/* Light frosted — action buttons */
.btn-glass {
  background: var(--color-glass-bg);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid var(--color-glass-border);
}
```

Available raw tokens:

| Token | Value |
|---|---|
| `--color-glass-bg` | grey/100 @ 82% |
| `--color-glass-bg-strong` | grey/100 @ 94% |
| `--color-glass-border` | primary/300 @ 40% |
| `--color-glass-border-strong` | primary/300 @ 62% |
| `--color-glass-stroke` | primary/300 @ 28% |

---

## Gradients

```css
/* Full page background — atmospheric wash */
--gradient-atmosphere

/* Card fill — tinted surface */
--gradient-card

/* Sidebar / column panels */
--gradient-panel

/* Hero banner accent band */
--gradient-hero
```

---

## Animation

| Token | Value |
|---|---|
| `--ease-standard` | cubic-bezier(0.22, 1, 0.36, 1) |
| `--ease-soft` | cubic-bezier(0.16, 1, 0.30, 1) |
| `--duration-fast` | 140ms |
| `--duration-base` | 220ms |
| `--duration-slow` | 420ms |

Shorthand:
```css
--transition-fast   /* 140ms ease-standard */
--transition-base   /* 220ms ease-standard */
--transition-slow   /* 420ms ease-soft */
```

---

## Zone Temperature Colors

Used in the Thermal Heatmap.

| State | Background token | Border token |
|---|---|---|
| Cold | `--color-zone-cold-bg` | `--color-zone-cold-border` |
| Comfort | `--color-zone-ok-bg` | `--color-zone-ok-border` |
| Warm | `--color-zone-warm-bg` | `--color-zone-warm-border` |
| Hot | `--color-zone-hot-bg` | `--color-zone-hot-border` |

---

## Chart Tokens

| Token | Value |
|---|---|
| `--chart-bg` | `#171D23` (primary/700) |
| `--chart-grid` | white @ 4% |
| `--chart-crosshair` | primary/500 @ 55% |

---

## Semantic UI Aliases

Shorthand tokens used in layout components:

```css
--ui-page-bg    → --color-bg
--ui-panel-bg   → --color-surface
--ui-accent     → --color-primary
--ui-accent-dim → --color-primary-soft
--ui-line       → --color-border
--ui-divider    → --color-divider
```

---

## Rules

1. **Never hardcode hex values in component files.** Always reference a CSS variable.
2. **Never hardcode Tailwind color utilities.** This project uses CSS variables exclusively.
3. **Semantic tokens over raw palette tokens.** Prefer `--color-text` over `--color-primary-700`.
4. **Glass classes over manual backdrop-filter.** Use `.surface-glass`, `.card-glass`, `.btn-glass`.
5. **All new palette colors must be added to `tokens.css` first**, then referenced by a semantic token, then used in components.
