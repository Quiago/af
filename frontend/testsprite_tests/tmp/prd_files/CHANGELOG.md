### 2026-04-05 FIX — Historian initialize regression + SavingsChart zero-filter + stale config refs
- What: Skip `initialize()` on restart when reusing same checkpoint testid (was resetting BOPTEST backward); remove `fan_power_w <= 0` filter in SavingsChart (zero is valid winter data, not missing); fix `boptest_scenario`/`boptest_price` AttributeError in boptest router after config rename
- Why: Repeated uvicorn reloads were stalling backfill progress; SavingsChart showed blank during winter months when cooling is off

### 2026-04-05 FEAT — Dual-building simulation preview in Digital Twin
- What: "Apply" renamed to "▶ Simulate"; clicking Simulate spawns a second building in the same THREE.js scene at x=28.5 offset showing projected zone state; camera smoothly lerps out to show both side-by-side; CURRENT/PROJECTED HTML labels, 28px KPI delta strip (ENERGY/COMFORT/CO₂ pills), pulsing SIMULATE HUD badge, amber card border while simulating; "✓ Apply" + "✕ Discard" replace Simulate while active; exiting removes second building and lerps camera back
- Why: Users couldn't see the impact of a recommendation before committing to it; two buildings in one scene gives spatial comparison with zero GPU cost overhead

### 2026-04-05 REFACTOR — Frontend feature merge: Digital Twin as main view, 3 features total
- What: Dashboard view replaced by DigitalTwinView (left 20% RecommendationsPanel + right 80% Digital Twin); SavingsChart moved to building-report; ThermalHeatmap + BuildingCanvas removed; EquipmentPanel/TimelineChart/SystemDiagram/useEquipmentData/useTimelineData moved to maintenance; useBenchmarkData/useHeatmapData moved to building-report; ActiveView type removes 'twin'; AppShell sidebar reduced to 3 items
- Why: Dashboard and Digital Twin were redundant views; components lived in dashboard but were owned by maintenance

### 2026-04-05 ARCH — Continuous historian: resume-from-checkpoint instead of always-bootstrap
- What: Added SimulationRun checkpoint table; startup now reads last (sim_time, wall_time) and initializes BOPTEST at that point, then fast-forwards only the gap to now; live loop writes checkpoint every BACKFILL_BATCH_SIZE rows; testid recovery rehydrates from checkpoint; new config vars (initial_backfill_days, live_tick_seconds, backfill_batch_size); /building/latest + /building/timeseries endpoints added; set_scenario removed from historian loop (benchmark-only)
- Why: Every restart was rewinding to t=0 and re-running the full backfill, making the historian non-persistent and the startup time O(backfill_days) on every restart

### 2026-04-05 FIX — Digital Twin crash + BOPTEST set_scenario timeout
- What: Replaced Object.assign(mesh, {position}) with mesh.position.set() (Three.js position is a non-writable getter); increased set_scenario timeout from 60s → 300s to survive the 1-week warmup simulation the BOPTEST worker runs on scenario initialization
- Why: Three.js Mesh.position cannot be overwritten; multizone_office_simple_air warmup takes ~2 min which exceeded the global httpx timeout

### 2026-04-05 FEAT — Digital Twin 3D building visualization with airflow
- What: Three.js feature with 3D exterior view (orbiting camera, solar lighting, sky sphere, fog) + orthographic floor plan view; 500-particle interior airflow system with fall/floor/rise lifecycle driven by zone damper positions and temperatures; live BOPTEST zone data binding (temp, CO2, humidity, solar, wind) with solarPhysics.ts fallback when offline; sidebar nav + view slot added
- Why: Core differentiator — no competitor visualizes per-zone HVAC airflow with real-time solar/thermal/CO2 data

### 2026-04-03 FIX — Chart always shows data on startup even during backfill
- What: Backend history fallback returns last 500 rows when the requested time window has no data yet (common during Phase 1 backfill); frontend `useHistoryData` now polls every 30 s and keeps previous dataset visible during refetch (`keepPreviousData`) so the chart never blanks
- Why: Default 1h preset returned 0 rows until backfill was ~99% complete; chart appeared broken on every server restart

### 2026-04-03 FEAT — Benchmark runner: real BOPTEST savings vs rule-based optimizer
- What: Backend deploys 2 test cases (baseline + RuleBasedOptimizer: SAT/DSP reset) over peak_cool_day/168h; GET /api/v1/benchmark/latest streams status/progress; auto-triggers after backfill; frontend SavingsChart + BuildingReport replace mock "18.3%/AED 6,200" with real calculated numbers
- Why: All savings numbers were hardcoded; benchmark gives real kWh/AED figures from BOPTEST KPIs × DEWA tariff

### 2026-04-03 FEAT — Building Canvas Phase 1: ZoomableSVG + Floor Rail + temperature color fix
- What: ZoomableSVG shared atom (wheel zoom centered on cursor, drag pan, [+][%][−][⊞] toolbar, auto-fit on first visible render) wraps both FloorPlan and SystemDiagram — diagrams now fully zoomable and pannable; FloorRail left strip shows F1 active + F2/F3 locked (padlock + 40% opacity, 3D button disabled with Phase 2 TODO); FloorPlan demo temps spread across all 4 color ranges (cold/comfort/warm/hot) so color coding is immediately visible without live data
- Why: System Diagram was rendering at ~40% legible size with no navigation; floor UI must signal multi-floor readiness before pilot demo

### 2026-04-03 FEAT — Building Canvas: SVG floor plan + HVAC system diagram replacing ThermalHeatmap
- What: Created BuildingCanvas (FloorPlan + SystemDiagram tabs) — floor plan shows 5 zones (NOR/WES/COR/EAS/SOU) colored by temp-vs-setpoint delta with clickable zones; SystemDiagram shows full single-duct VAV HVAC flow (OA→Filter→AHU→VAV→Zones, return→Chiller, CHW loop) with clickable equipment nodes that navigate to Predictive Maintenance; PredictiveMaintenanceView split into SystemDiagram (top 45%) + TimelineChart (bottom 55%); dashboard layout updated to 20/40/40; activeView moved from AppShell local state to Zustand store for cross-component navigation
- Why: Replace abstract heatmap cells with a spatial SVG building representation that doubles as an entry point for equipment diagnostics

### 2026-04-03 FIX — Dashboard center: replace TimelineChart with SavingsChart (Baseline vs INAIA)
- What: Created SavingsChart component for dashboard center 60% — LW Charts dual-line (dashed baseline = fan_power_w×1.224, solid green INAIA = real fan_power_w), delta strip with Δ18.3%/energy/cost/annual savings badges, 1h/1d/1M/1y presets, ↩ Live button; TimelineChart stays only in Predictive Maintenance
- Why: Dashboard center must show the savings comparison per v3 spec, not the general equipment timeline

### 2026-04-01 FEAT — Analytical reporting view: KPIs, sortable tables, LW Chart, CSV/PDF export
- What: Building Report rebuilt as a true analytics platform — 5 live KPI cards (total power, cumulative energy, chiller COP, thermal discomfort, est. annual savings AED); period selector 24h/7D/30D driving a dedicated LW Charts timeline (fan power + core temp + CO₂); fleet health donut (SVG, avg equipment health score); savings comparison bars (baseline vs INAIA, Δ kWh + tCO₂); sortable equipment health table with health metric bars + mini donut gauges; sortable zone comfort table with delta colour-coding + comfort scores; CSV export per table + time-series CSV; PDF export via window.print() with @media print CSS; all data live from WebSocket snapshot + REST history
- Why: User requested a PowerBI/Tableau-grade analytics view using only existing backend data

### 2026-03-31 FEAT — v3 frontend — INAIA shell, 3 views, recommendations panel, AI bubble
- What: Full frontend redesign matching building-os-demo-v3.html — collapsible sidebar (50→204px), AppShell with WS setup, 3 views (Dashboard 20/60/20, Building Report, Predictive Maintenance); RecommendationsPanel replaces EquipmentPanel on left with KPI strip + apply/decline cards; ThermalHeatmap restyled with v3 color classes; floating AI chat bubble; IBM Plex Mono/Sans fonts; updated design tokens to match v3 dark palette
- Why: New composition requested to match INAIA product design; all backend connections preserved (WS, REST history, snapshot)

### 2026-03-27 FIX — fitContent, scrollToRealTime, infinite history, realtime timestamp gap
- What: TimelineChart calls fitContent() after setData() so all data is visible on load/preset change; added "↩ Live" button (scrollToRealTime) that appears when user scrolls away; subscribeVisibleLogicalRangeChange fetches older history when scrolling past left edge (useOlderHistoryData hook); backend Phase 2 now uses start_real_dt + timedelta(seconds=sim_secs) mapping instead of datetime.now() — eliminates ~67-min gap between last backfill row and first realtime row
- Why: Chart viewport was stuck at old position after setData (fitContent missing); 1h view was sparse because real-time rows were timestamped at wall-clock time creating a gap after the 67-min backfill; LW Charts best practices from range-switcher/infinite-history/realtime tutorial examples

### 2026-03-27 FIX — Dual Y-axis, axis tick timezone, backend resolution enum cleanup
- What: TimelineChart gets dual price scales — Fan Power on left, Core Temp + CO2 on right (priceScaleId per series); tickMarkFormatter added so X-axis ticks render in browser local timezone (not just tooltip); removed '1y' from backend Resolution enum and _RESOLUTION_FMT (1y is a window, not a bucket)
- Why: Shared Y-axis was flattening Core Temp (20°C) against Fan Power (0-6000W); axis ticks still showed UTC despite localization.timeFormatter fixing the tooltip

### 2026-03-27 FIX — Timeline: local timezone display + UX presets 1h/1d/1M/1y
- What: TimelineChart now uses localization.timeFormatter/dateFormatter so times render in browser local timezone (not UTC); PRESET_CONFIG changed to 1h→1m/3600s, 1d→1m/86400s, 1M→1d/30d, 1y→1d/365d; TimePreset type and button array updated to ['1h','1d','1M','1y']
- Why: UTC timestamps were off by +4h for Dubai users; full-backfill-window for all presets was bad UX — 1h should show last hour, not 7 days

### 2026-03-27 FEAT — Correct backfill: initialize+step=60s, advance_only, bulk insert, full-window presets
- What: Phase 0 resets sim to t=0 via initialize(); Phase 1 uses advance_only() (1 HTTP call/step vs 3) + SQLAlchemy add_all() batch insert every 100 rows; removed BACKFILL_DAYS constant — now settings.backfill_days (default 7, env BACKFILL_DAYS); frontend presets all query full backfill window, only resolution changes; VITE_BACKFILL_DAYS added to frontend .env
- Why: Previous backfill exited after 1 step because testid sim_time was already past now; step=60s is the canonical write resolution — downsampling to 1h/1d happens only at read time via SQL GROUP BY

### 2026-03-27 FIX — WS stale socket leak, presets 1m/1h/1d/1M/1y, frontend+backend logging
- What: Fixed WS reconnect loop that accumulated zombie connections — stale socket handlers now check `this.ws !== ws` before acting; changed TimePreset to 1m/1h/1d/1M/1y (bucket resolution labels); added [WS]/[History]/[Chart] console logging + backend history row count and broadcast logging
- Why: Stale onclose handlers were nulling out the current socket causing infinite reconnects; presets should reflect data resolution not arbitrary time windows

### 2026-03-27 FIX — Merge timeline controls into single 5-preset group
- What: Replaced confusing dual button groups (resolution + time window) with a single TimePreset group: 1h/6h/1d/1M/1y; each preset auto-selects both window size and bucket resolution; updated building.types.ts, dashboardStore, useTimelineData, TimelineChart
- Why: Showing 1h in both groups was confusing; unified presets are the standard pattern for financial/monitoring charts

### 2026-03-27 FIX — _polling_loop silent crash on set_step dict payload
- What: set_step/get_step now handle BOPTEST's {"step": float} dict response instead of calling float() on the dict directly; wrapped _polling_loop body in inner function with top-level try/except so any future crash is logged immediately instead of being silently swallowed by asyncio
- Why: BOPTEST public API returns {"step": 60.0} not a bare float — float(dict) threw TypeError, BOPTESTError propagated, asyncio task terminated with no log output

### 2026-03-27 FEAT — DB time-series, two-phase backfill loop, /history endpoint, real-time chart
- What: Added SQLite+WAL async DB (db/engine.py, db/base.py); BoptestMeasurement ORM model in boptest/models.py; save_measurement() CRUD in boptest/service.py; _polling_loop rewritten with Phase 1 (backfill — advance at full speed, save every step, no sleep) and Phase 2 (real-time — advance every 60 s, broadcast WS snapshot); GET /building/history with resolution (1m/1h/1d/1y) + time range params, downsampled with AVG/MAX via SQLite strftime GROUP BY; frontend useHistoryData hook (TanStack Query → REST); TimelineChart uses setData() for history + series.update() for WS real-time; resolution buttons (1m/1h/1d) trigger refetch
- Why: Replace ephemeral in-memory history with persistent DB; enable backfilling 24h+ of simulation history on startup; provide downsampled history endpoint for efficient chart rendering at any time resolution

### 2026-03-27 ARCH — Merge client into service, inline zone_layout, expose all BOPTEST endpoints
- What: Merged api/v1/boptest/client.py into service.py (one file owns all BOPTEST HTTP + lifecycle logic); inlined api/v1/building/zone_layout.py into building/service.py; expanded boptest/router.py to expose all 17 BOPTEST endpoints (version, name, measurements, inputs, forecast_points, step get/set, initialize, scenario get/set, advance, forecast, results, kpi, stop, status, restart); added matching schemas
- Why: Artificial split between "client" and "service" adds indirection with no benefit; all BOPTEST endpoints should be inspectable from Swagger docs

### 2026-03-27 ARCH — Move boptest_client and zone_layout into their domain packages
- What: Moved core/boptest_client.py → api/v1/boptest/client.py and core/zone_layout.py → api/v1/building/zone_layout.py; core/ now only contains config.py; updated all imports in service.py files and main.py
- Why: core/ should be shared config only — domain-specific code belongs inside the domain package that owns it

### 2026-03-27 FEAT — BOPTEST testid persistence + full API client + auto-recovery
- What: Stored testid in .env (BOPTEST_TEST_ID); on startup, reuses it if still valid instead of deploying a new test case; if expired, deploys fresh and writes new testid back to .env. Added all missing BOPTEST API methods (version, name, measurements, inputs, step get/set, scenario get, forecast_points, results, stop). Polling loop auto-recovers: validates testid on BOPTESTError, deploys fresh if expired.
- Why: Public BOPTEST server auto-expires inactive test cases; persisting testid avoids unnecessary re-deploys on every backend restart

### 2026-03-27 FIX — WS router unified in api.py + BOPTEST public API URL
- What: Moved WebSocket router into api/v1/api.py via a root router so main.py has a single include_router call; fixed default boptest_url to https://api.boptest.net; fixed websocket_endpoint() missing Request arg by using websocket.app.state
- Why: Architecture rule — all routers unify in api.py; backend must use public BOPTEST web service, not local Docker

### 2026-03-26 FEAT — FastAPI backend + real BOPTEST data integration
- What: Built full Python FastAPI backend (15 files) with async BOPTEST client, data transformation service, WebSocket broadcast loop, and REST snapshot endpoint. Removed all mock data from frontend; connected via TanStack Query (initial load) + WebSocketManager (live updates); updated DashboardLayout to ConnectionStatus tri-state; updated ThermalHeatmap to 3×3 CSS grid using zone row/col from backend; fixed TimelineChart series keys to real BOPTEST zone IDs (cor, sou).
- Why: Replace mock data pipeline with live BOPTEST simulation feed; backend normalizes raw BOPTEST outputs into typed BuildingSnapshot contract shared with frontend
- Files: backend/main.py, backend/core/config.py, backend/core/boptest_client.py, backend/api/v1/building/service.py, backend/api/v1/building/router.py, backend/api/v1/websocket/manager.py, backend/api/v1/websocket/router.py, frontend/.env, frontend/src/lib/websocket.ts, frontend/src/store/dashboardStore.ts, frontend/src/features/dashboard/DashboardPage.tsx, frontend/src/features/dashboard/components/DashboardLayout/DashboardLayout.tsx, frontend/src/features/dashboard/hooks/useHeatmapData.ts, frontend/src/features/dashboard/components/ThermalHeatmap/ThermalHeatmap.tsx, frontend/src/features/dashboard/components/ThermalHeatmap/ThermalHeatmap.css, frontend/src/features/dashboard/components/TimelineChart/TimelineChart.tsx

### 2026-03-26 FEAT — EquipmentPanel refactor: 30/70 AssetDetail + TreeView with health system
- What: Replaced flat equipment card list with a 30/70 vertical split — AssetDetail (top) shows HealthGauge SVG arc, 3 HealthBar rows, service date, and disabled Calendar/Manual action buttons; TreeView (bottom) shows Building → Zone → Equipment hierarchy with collapsible zones, alert badges on zones with warnings, and StatusDot per asset row. Added healthScore/healthMetrics/zone/lastServiceDate fields to EquipmentData and mock generator. Extended Zustand store with selectedAssetId, setSelectedAsset, expandedZones, toggleZone. Added StatusDot atom with pulse animation on critical.
- Why: Flat card list communicated no diagnostic context; engineers need to see health score trend and sub-metric breakdown at a glance, and navigate a spatial asset hierarchy
- Files: types/building.types.ts, store/dashboardStore.ts, lib/mockWebSocket.ts, EquipmentPanel.tsx, AssetDetail.tsx, AssetDetail.css, HealthGauge.tsx, HealthGauge.css, HealthBar.tsx, HealthBar.css, TreeView.tsx, TreeView.css, components/atoms/StatusDot.tsx, components/atoms/StatusDot.css

### 2026-03-26 FEAT — Visual language upgrade: navy palette, KPI trends, sparklines, heatmap delta
- What: Replaced flat-black palette with deep navy (#0D1420 base, #1A2535 cards with teal glow border); added ↑↓ trend % vs session baseline in header KPIs; added 18-point sparkline SVG per equipment card; added delta-vs-setpoint in heatmap cells; updated zone colors to vivid electric palette with 0.4s transitions; pre-filled 24 historical points on mock connect so chart is never empty
- Why: Visual language was "developer terminal", not "mission control product" — needed depth, context, and trend to communicate status at a glance

### 2026-03-25 FIX — Zustand selector infinite loop and chart duplicate timestamp crash
- What: Fixed `getSnapshot should be cached` warning by using stable module-level empty arrays in selectors; fixed lightweight-charts crash by deduplicating timestamps in the store and sorting before setData
- Why: React StrictMode double-invokes effects causing duplicate snapshots; `?? []` inline creates new references on every render breaking Zustand's reference equality check
- Files: frontend/src/store/dashboardStore.ts, frontend/src/features/dashboard/hooks/useEquipmentData.ts, frontend/src/features/dashboard/hooks/useHeatmapData.ts, frontend/src/features/dashboard/components/TimelineChart/TimelineChart.tsx

### 2026-03-25 FEAT — Bootstrap complete frontend with live mock data pipeline
- What: Scaffolded Vite+React18+TS frontend with CSS token architecture, Zustand store, TanStack Query, WebSocket manager, mock data generator, and three-panel dashboard (EquipmentPanel, TimelineChart, ThermalHeatmap) all wired end-to-end
- Why: Establishes the full frontend foundation with feature-driven architecture per CLAUDE.md spec; mock mode (VITE_USE_MOCK=true) enables development without a running backend

### 2026-04-05 CONFIG — .env rationalization + historian step split

- What: Added BACKFILL_STEP_SECONDS (3600s for fast 1yr fill), LIVE_TICK_SECONDS=BOPTEST_STEP=300 for 1:1 real-time; renamed boptest_scenario/price → benchmark_scenario/price; removed _persist_testid (testid now lives in DB checkpoint); removed auto-benchmark launch after backfill; backfill now uses coarse step then switches to live step.
- Why: DB deleted → fresh start revealed missing env vars and benchmark auto-launch consumed resources without value to the historian.

### 2026-04-05 FIX — Polling loop auto-reconnects when BOPTEST unavailable at startup

- What: Replaced the passive sleep loop (wait forever for testid) with an active retry: every 15s the loop calls setup_boptest() until BOPTEST connects.
- Why: If BOPTEST Docker isn't up when the backend starts, the historian was permanently stuck until a manual POST /boptest/restart.
