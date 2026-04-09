# AF Platform — Product Requirements Document

## Overview
AF is a real-time building energy optimization platform (INAIA Platform) that connects to a BOPTEST simulation backend and visualizes thermal/energy data for building management. The frontend is a single-page application with three main views accessible via a sidebar.

---

## Core Features

### 1. App Shell & Navigation
- **Sidebar** with logo ("INAIA Platform"), three navigation items, and user profile footer
- **Navigation items**: Digital Twin (⬡), Building Report (▤), Predictive Maintenance (◎)
- **Topbar** showing current view title and a live status pill (LIVE / CONNECTING / DISCONNECTED)
- All three views are mounted simultaneously; CSS toggling preserves chart state between switches
- **AI Chat Bubble** overlay available on all views

### 2. WebSocket Live Connection
- App connects to `ws://localhost:8000/ws` on startup
- Connection status shown in topbar: "LIVE" (green dot) when connected, "DISCONNECTED" (gray) otherwise
- Auto-reconnect on disconnect
- Live `BuildingSnapshot` data (zones, equipment, KPIs) streamed every simulated timestep

### 3. Digital Twin View (default view)
- **Left panel**: AI Recommendations Panel — list of optimization recommendations
- **Right panel**: Digital Twin View with:
  - 3D building viewer (Three.js) with zone temperature color mapping
  - Floor plan SVG overlay
  - Simulation Delta Bar showing comparison between current and simulated scenario
- Zone temperatures displayed with color scale: cold (blue) → comfort (green) → warm (amber) → hot (red)

### 4. Building Report View
- Historical performance charts using Lightweight Charts (TradingView)
- Savings Chart: financial-style chart of energy savings over time (zero values filtered out)
- Thermal heatmap of zone temperatures
- Benchmark data comparison

### 5. Predictive Maintenance View
- **Equipment Panel** with hierarchical TreeView of assets (Chiller, AHUs, Filters, Cooling Tower)
- **Asset Detail**: selected asset metrics, health bar, health gauge
- **Timeline Chart**: multi-series time series of equipment metrics (Lightweight Charts)
- **System Diagram**: HVAC system topology diagram
- Equipment status: ok (green) | warning (amber) | critical (red) | offline (gray)

---

## Data Model

### BuildingSnapshot
```
timestamp: number (Unix seconds)
zones: ZoneData[]
equipment: EquipmentData[]
kpis: { pue?, energy_kwh?, thermal_discomfort? }
```

### ZoneData
```
id: string
name: string
temperature: number (Celsius)
setpoint: number
co2?: number
occupancy?: boolean
```

### EquipmentData
```
id: string
name: string
type: 'chiller' | 'ahu' | 'filter' | 'cooling_tower'
status: 'ok' | 'warning' | 'critical' | 'offline'
metrics: Record<string, number>
```

---

## Non-Functional Requirements
- No hardcoded values; all config via environment variables
- CSS variables as single source of truth for design tokens
- TypeScript strict mode throughout
- Components are dumb; hooks own all data logic
- WebSocket is primary data channel; REST for initial load and historical data
