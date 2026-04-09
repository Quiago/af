# AF — Project Intelligence

## Project Overview
af is a real-time building energy optimization platform.
It connects to a BOPTEST simulation (later: real BMS via BACnet/Modbus)
and visualizes thermal data across three panels:
1. Equipment Panel — live status of Chiller, AHUs, Filters
2. Timeline Chart — multi-series financial-style time series
3. Thermal Heatmap — 2D grid of zone temperatures, live color updates

## Monorepo Structure
```
af/
├── frontend/          # React + Vite
├── backend/           # Python + FastAPI
└── CLAUDE.md
```

---

## Frontend Architecture

### Stack
- React 18 + Vite
- TypeScript (strict mode)
- shadcn/ui for component primitives
- CSS Variables for ALL theming and design tokens (no Tailwind utilities)
- Lightweight Charts (TradingView) for time series
- TanStack Query v5 for server state
- Zustand for client/UI state
- React Router v6

### Feature-Driven Architecture
```
src/
├── features/
│   └── dashboard/
│       ├── components/
│       │   ├── EquipmentPanel/
│       │   ├── TimelineChart/
│       │   └── ThermalHeatmap/
│       ├── hooks/
│       │   ├── useEquipmentData.ts
│       │   ├── useTimelineData.ts
│       │   └── useHeatmapData.ts
│       └── api/
│           └── dashboard.api.ts
├── components/         # Atomic Design — pure UI only
│   ├── atoms/          # Button, Badge, StatusDot, Tooltip
│   ├── molecules/      # MetricCard, AlertBadge, ZoneCell
│   └── organisms/      # AppShell, Sidebar, TopBar
├── lib/
│   ├── queryClient.ts  # TanStack Query singleton
│   ├── websocket.ts    # WebSocket manager
│   └── utils.ts
├── store/
│   └── dashboardStore.ts  # Zustand — UI state only
├── styles/
│   ├── globals.css        # CSS variables + resets
│   ├── tokens.css         # Design tokens
│   └── theme.css          # Light/dark theme overrides
├── types/
│   └── building.types.ts  # Shared TypeScript types
└── main.tsx
```

### CSS Architecture — Critical Rules
ALL design decisions must live in CSS variables. Never hardcode colors,
spacing, or typography in component files.
```css
/* styles/tokens.css — single source of truth */
:root {
  /* Colors */
  --color-bg-primary: #0a0e1a;
  --color-bg-surface: #111827;
  --color-bg-elevated: #1f2937;
  --color-accent: #00d4aa;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;

  /* Zone temperature colors */
  --color-zone-cold: #3b82f6;
  --color-zone-comfort: #10b981;
  --color-zone-warm: #f59e0b;
  --color-zone-hot: #ef4444;

  /* Equipment status colors */
  --color-status-ok: #10b981;
  --color-status-warning: #f59e0b;
  --color-status-critical: #ef4444;
  --color-status-offline: #6b7280;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typography */
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Inter', sans-serif;
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 28px;

  /* Borders */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-color: rgba(255,255,255,0.08);

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-elevated: 0 4px 16px rgba(0,0,0,0.5);

  /* Animation */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 500ms ease;

  /* Chart */
  --chart-bg: #0d1117;
  --chart-grid: rgba(255,255,255,0.05);
  --chart-crosshair: rgba(0,212,170,0.5);
}
```

### Data Flow Rules
1. Components NEVER fetch data directly
2. All fetching lives in `hooks/` via TanStack Query or WebSocket
3. Components receive data as props or read from hooks
4. WebSocket data flows: WebSocket → Zustand store → hooks → components
5. No `any` types. All API responses must have TypeScript interfaces in `types/`

### WebSocket Pattern
BOPTEST sends updates every simulated timestep.
The WebSocket manager in `lib/websocket.ts` connects once,
updates Zustand store on each message, and components
react to store changes via hooks.
```typescript
// Pattern — never do this in a component:
// const ws = new WebSocket(...)  ❌

// Always use the hook:
// const { grid, equipment } = useDashboardStream()  ✅
```

### Lightweight Charts Rules
- One `ChartManager` class in `lib/chartManager.ts` manages all chart instances
- Multiple series per chart supported (temp + setpoint + energy on same panel)
- Multiple stacked charts supported (one panel per variable group)
- Time is always Unix timestamp in seconds
- All chart colors reference CSS variables (passed as strings, not hardcoded)
- Chart resize handled by ResizeObserver, not window.resize

---

## Backend Architecture

### Stack
- Python 3.11+
- FastAPI
- SQLAlchemy 2.0 (async)
- Pydantic v2
- WebSockets (native FastAPI)
- httpx for BOPTEST client

### Domain-Driven Structure
```
backend/
├── api/
│   └── v1/
│       ├── api.py              # Global router
│       ├── boptest/
│       │   ├── router.py
│       │   ├── service.py
│       │   └── schemas.py
│       ├── building/
│       │   ├── router.py
│       │   ├── service.py
│       │   └── schemas.py
│       └── websocket/
│           ├── router.py
│           └── manager.py
├── core/
│   ├── config.py               # Settings via pydantic-settings
│   ├── database.py             # SQLAlchemy async engine
│   └── boptest_client.py       # BOPTEST REST client
├── models/                     # SQLAlchemy ORM models
├── main.py
└── .env
```

### No Hardcoding Rules
- ALL config via environment variables in `.env` + `core/config.py`
- BOPTEST URL, polling interval, zone layout — all in config
- Never hardcode zone names, variable names, or thresholds in logic

---

## Shared Types Contract
The backend defines the data contract in `schemas.py`.
The frontend mirrors it in `types/building.types.ts`.
Both must stay in sync.
```typescript
// types/building.types.ts
export interface ZoneData {
  id: string
  name: string
  temperature: number   // Celsius
  setpoint: number
  co2?: number
  occupancy?: boolean
}

export interface EquipmentData {
  id: string
  name: string
  type: 'chiller' | 'ahu' | 'filter' | 'cooling_tower'
  status: 'ok' | 'warning' | 'critical' | 'offline'
  metrics: Record
}

export interface BuildingSnapshot {
  timestamp: number     // Unix seconds
  zones: ZoneData[]
  equipment: EquipmentData[]
  kpis: {
    pue?: number
    energy_kwh?: number
    thermal_discomfort?: number
  }
}
```

---

## Key Constraints
- No hardcoded values anywhere. Config drives everything.
- Components are dumb. Hooks are smart.
- CSS variables are the single source of truth for design.
- TypeScript strict mode. No `any`.
- WebSocket is the primary data channel for live data.
- REST API is for historical data, config, and initial load.
- BOPTEST test case: `multizone_office_simple_air` by default (configurable)

## 🔄 AUTO-LOGGING RULE (MANDATORY)
After completing ANY task, append a single entry to `CHANGELOG.md` 
in this exact format — no exceptions:
```
### [DATE] [CATEGORY] — [ONE LINE SUMMARY]
- What: <what was built or changed, max 2 lines>
- Why: <the reason or decision made, max 1 line>  
```

Categories: FEAT | FIX | ARCH | REFACTOR | CONFIG | PROMPT

Example:
### 2026-03-25 FEAT — WebSocket endpoint for BOPTEST streaming
- What: Created /ws endpoint in FastAPI that polls BOPTEST every 5s
- Why: Polling from frontend caused latency spikes in heatmap

## 📦 AUTO-COMMIT RULE (MANDATORY)
Immediately after appending your entry to the `CHANGELOG.md`, you MUST automatically stage and commit your changes using Git. Do not wait for explicit permission to commit.

**Execution Steps (Strict Order):**
1. `git add .`
2. `git commit -m "<CATEGORY>: <ONE LINE SUMMARY>"`

**Commit Message Mapping:**
Use the conventional commit format