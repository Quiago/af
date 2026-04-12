### 2026-04-12 FIX — BMS tab: HVAC topology order, unit conversions, sensor coverage, and KPI accuracy
- What: Corrected AHU air-flow order to ASHRAE spec (Mix→HeaCoil→CooCoil→Fan); fixed control unit bugs (temps now sent in K, fractions in 0–1); added missing sensors (PPumCoo, PPumHea, THeaCoiSup/Ret, 8 weather fields); replaced PUE with ChillerCOP + HP_COP; updated EMPTY_SNAPSHOT and KpiHistory to match new BmsSnapshot schema
- Why: Expert HVAC review against BOPTEST multizone_office_simple_air spec revealed wrong component order, wrong control units sent to API, and missing pump/coil power readings that caused zeroed KPIs

### 2026-04-10 FEAT — BMS tab: live HVAC topology, KPI strip, and control panel
- What: New "BMS" tab in the frontend sidebar; BmsView composes a 4-column SVG topology (plant→AHU→duct→zones) with live BOPTEST data, a 6-card KPI strip with inline sparklines, and a debounced control panel with AHU sliders + per-zone setpoint accordions and a consumption-impact delta box; backend adds GET /api/v1/bms/snapshot and POST /api/v1/bms/control; ActiveView type extended to include 'bms'
- Why: Provide a real-time BMS operator view so engineers can observe live HVAC state and manually override setpoints directly from the platform

### 2026-04-10 FEAT — Real-time Plotly Sankey HVAC energy flow (backend/experiments)
- What: Built sankey_hvac/ package (boptest_client.py, energy_flows.py, sankey_builder.py, sankey_dash.py, sankey_static.py) — live Dash app polls BOPTEST /results every 5s and renders full HVAC pipeline Sankey (Grid→Plant→AHU→5 zones) with KPI strip and discomfort highlighting
- Why: Visualize end-to-end energy flows for the multizone_office_simple_air test case to support HVAC optimization analysis

### 2026-04-08 FIX — Machine Health asset tree now shows hotel equipment in mock mode
- What: MockWebSocketManager gained onStatusChange + connectionStatus to match real WS interface; websocket.ts exports mockWsManager when VITE_MOCKED_DATA=true, populating snapshot.equipment → TreeView renders all 5 hotel assets (Chiller C1, AHU Floors 1–3, AHU Floors 4–6, Primary Filter Bank, Cooling Tower CT1)
- Why: VITE_USE_MOCK was never set, so mockWebSocket.ts never activated and the asset tree showed empty

### 2026-04-09 FEAT — Machine Health: rename + full mock data for demo mode
- What: Renamed "Predictive Maintenance" → "Machine Health" across AppShell, topbar, sidebar, BoardReport; TimelineChart now generates mock history (fan 8–26 kW, zone temp 21–23.5 °C, CO₂ 400–900 ppm, hotel-hour occupancy pattern) when VITE_MOCKED_DATA=true instead of calling REST API; mockWebSocket updated with hotel equipment names, service dates, realistic chiller COP 3.2–4.4, AHU fan_power_w metric, and a new Cooling Tower CT1 (approach 1.6–2.8 K, healthScore + 3 metrics) on Rooftop Plant zone
- Why: Demo mode showed empty timeline chart and generic equipment; hotel demo requires rich, labelled mock data throughout the Machine Health view

### 2026-04-09 FIX — Time-slice KPI cards + hotel-scale number audit for 25hours demo
- What: KPI summary cards (CO₂, Comfort Complaints, EST. ANNUAL SAVINGS period sub) now respond to 1h/1d/1M/1y time slice; all mock numbers rescaled to 25hours Hotel Dubai profile (345 kW HVAC, AED 175K/yr savings, chiller 280 kW, fans 65 kW); RecommendationsPanel savings 2.1→68/45/28 kWh/day; ActionTimeline 42→420 kWh/day; DebugTimelines fan base 5.6→22 kW; SimulationDeltas fallback 24.5→345 kWh/hr; mockWebSocket chiller 80-140→250-305 kW, energy_kwh 50-120→310-380 kWh/hr
- Why: Demo screenshots for 25hours Hotel required engineering-accurate numbers — previous values were BOPTEST test-case scale (small office), not hotel scale

### 2026-04-08 REFACTOR — Reporting: 5 tabs → 3 tabs (Comparison, Anomaly Feed, Zone Performance)
- What: Replaced ENERGY SAVINGS tab with COMPARISON (LightweightCharts dual-line Baseline vs INAIA, variable selector: Energy/Cost/CO₂, responds to 1h/1d/1M/1y time slices); removed CO₂ COMPLIANCE and WEATHER & OCCUPANCY tabs; renamed ZONE COMFORT → ZONE PERFORMANCE with new columns (Zone, Floor, Energy kWh, Cost AED, CO₂ kg, Autonomous badge, Performance Score bar), time-slice-scaled mock data, deterministic per-zone values
- Why: User spec: keep only 3 tabs, comparison must show INAIA vs baseline per variable, zone tab must show operational metrics not thermal comfort

### 2026-04-08 FIX — Digital Twin: active floor contrast + zone raycasting scoped to active floor
- What: Inactive floor zone opacity 0.07→0.03, edge lines 0.08→0.02, slabs dim independently; active floor zones 0.86 baseline; click/hover raycasters filter to active floor only so cross-floor selection is impossible
- Why: Visually hard to tell active floor; clicking zones on F1 accidentally hit F2 due to overlap

### 2026-04-08 FEAT — Digital Twin: zone hover tooltip + ghost-frame shell + sprite labels
- What: BuildingViewer now accepts hoveredZone/onHoverZone props; useBuildingScene fires mousemove raycasts against zone volumes; tooltip (glass HUD style) shows zone name, temp, CO₂, damper; cursor changes to pointer on hover; structural shell fully transparent (depthWrite: false) so zone volumes are primary visual element
- Why: Complete the plan for visible zones + hover drill-down UX

### 2026-04-08 FEAT — Digital Twin: real DOE building geometry + zone drill-down + energy slab coloring
- What: Rebuilt 3D scene to DOE multizone_office_simple_air spec (50×33.25m, 2.74m floors); 5 zone volumes visible as semi-transparent temperature-tinted boxes; floor slabs color-coded by energy intensity (cool=efficient, red=intensive); click zone volume → highlights zone in watchlist via store; floor bar always visible in both 3D and plan modes
- Why: Improve visual realism and enable click-to-drill-down UX matching the real BOPTEST building layout

### 2026-04-08 ARCH — INAIA Design System documentation + Figma palette mapping
- What: Created DESIGN_SYSTEM.md with full token reference (4 chromatic families + grey, typography, spacing, glass, gradients, animation, zone/chart tokens); verified tokens.css alignment with Figma palette
- Why: Single source of truth for the design system to carry context across sessions and onboard collaborators

### 2026-04-06 FIX — Airflow scan building mask + sim card ordering + deep accent triad
- What: Building geometry mask (sceneLuma smoothstep) prevents scan dots from covering sky; simulated card reordered to top so Apply/Discard immediately visible; --color-deep-teal/slate/purple (#2F4441, #32364D, #322A5C) wired into buttons, card accents, HUD badge, impact strips
- Why: Alpha=0.90 with no luma guard covered entire dark canvas; Apply/Discard was scrolled off; only grey tones used, missing deep palette accents

### 2026-04-06 FEAT — Simulation UX overhaul + steel-blue palette + NavStack removal
- What: Removed NavStack transition animation; fixed airflow scan visibility (removed luma darkening modifier, teal glow #658D88); dual zone strip (CURRENT/PROJECTED side-by-side) when simulating; rec cards grouped under building headers in left panel; tokens.css replaced with Figma steel-blue palette (primary #4E5D6D, bg #EEF1F5, live teal #658D88)
- Why: NavStack broke navigation flow; airflow scan undetectable on dark canvas; simulation provided no clear per-building data comparison in UI

### 2026-04-06 FEAT — INAIA Design System v3: brochure palette + glass + NavStack + airflow shader
- What: Restored INAIA brochure tokens (#F3F3F1 bg, #5D63A9 primary, #D7DFEA divider, Manrope font); added glass utility classes (.card-glass, .surface-glass, .btn-glass); pill buttons on rec panel; left-border active nav (brochure pattern); NavStack 3-panel cursor-interactive transition overlay using motion/react useSpring; WebGL post-processing airflow scan shader on Digital Twin (Voronoi cell-noise dots + scan wave in temperature colors, activates on simulation start)
- Why: Apple-specific values (#F5F5F7, #3D4FCA) from v2 diverged from official INAIA brand identity; full glassmorphism + NavStack transitions needed for production

### 2026-04-06 REFACTOR — Design system v2: Apple/Autodesk precision language
- What: Switch to Apple's exact color values (#F5F5F7 bg, #1D1D1F text, #6E6E73 secondary, rgba(0,0,0,0.08) dividers); primary upgraded to confident #3D4FCA indigo (not muted SaaS purple); shadows use Apple's thin-ring formula (0 0 0 0.5px + soft drop, pure rgba(0,0,0,...)); glass uses Apple's vibrancy formula (blur(20px) saturate(180%)); sidebar replaces left-border indicator with macOS full-row fill; buttons use radius-sm not full pill; tight letter-spacing -0.025em on headings, -0.014em body
- Why: Previous version looked like generic SaaS (Notion/Linear) — redesign applies Apple HIG + Autodesk AEC design precision to distinguish as industrial professional tool

### 2026-04-06 FEAT — Light-first design system (INAIA brochure palette)
- What: Complete UI/UX redesign from dark to light theme; new tokens.css (lilac-indigo primary, pearl-gray surfaces, Inter font, glass HUD for WebGL canvas); updated AppShell, RecommendationsPanel, DigitalTwinView, SimulationDeltaBar, BuildingReportView, all maintenance CSS, AIChatBubble, StatusDot, SavingsChart; SVG SystemDiagram colors updated to brochure palette; 3D canvas and chart viewports stay dark (Autodesk pattern)
- Why: Dark theme did not match INAIA brand identity; redesign targets premium industrial aesthetic (Apple glass + Autodesk viewport pattern)

### 2026-04-06 FIX — TestSprite report: TS build errors, accessibility, zone color, WebSocket UX
- What: Fixed all TypeScript build errors (solar type, FogBase, RefObject<null>, lineWidth, unused vars); added data-testid + ARIA attrs to floor buttons, view toggle, period tabs, and TreeView; updateZoneMats now uses temperature-tinted glass color + change-detection guard (skip if Δtemp < 0.05°C); WebSocket "connecting" state shows for min 500ms; removed stale TestSprite key + shell command from .env
- Why: Production build was broken since dual-building refactor; TestSprite couldn't interact with key controls due to missing accessibility semantics; zone glass color was always hardcoded blue regardless of temperature

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

### 2026-04-06 FEAT — Global card gradient across all platform panels
- What: Added --gradient-card and --gradient-panel tokens to tokens.css; applied card gradient (135deg steel-blue soft → surface) to zone cards, rec cards, kpi cards, chart cards, table cards, control cards, asset action buttons; applied panel gradient to topbar, sidebar panels, zone strips, rec-panel, eq-col, TreeView, TimelineChart header
- Why: Gradient was only on the EST. ANNUAL SAVINGS card in BuildingReport; user requested consistent treatment across the entire platform

### 2026-04-06 FIX — Gradient scoped to backgrounds only + simulation fog/lighting fix
- What: Reverted gradient from individual cards (zone, rec, kpi, chart, table cards) back to var(--color-surface); gradient kept only on panel/view backgrounds (rpt-view, rec-panel, eq-col, topbar, zone strips, TreeView, Timeline); restored --accent kpi card gradient; fixed simulation: fog density drops 0.015→0.006 when simulating (camera at r=72 was fogging buildings to <26% opacity), ambient+sun boosted +0.5/+0.4 in sim mode
- Why: Cards with gradients looked visually noisy; simulation 3D view showed only floor outline because dark materials + exponential fog at wider camera angle made buildings invisible

### 2026-04-06 FIX — Remove exponential fog from 3D scene
- What: Deleted all THREE.FogExp2 usage from useBuildingScene (scene init, per-frame reassignment in 3D mode, null assignment in plan mode); removed simBoost lighting hack that was a band-aid for the fog issue
- Why: Exponential fog at density 0.015 made buildings virtually invisible in simulation mode (camera at r=72); removing fog entirely is cleaner than tuning density

### 2026-04-07 FEAT — SimulationTickerPanel: financial-style delta view replaces dual-building
- What: Removed second 3D building (simInst/simPS/BUILDING_OFFSET/camera lerp) from useBuildingScene; added fixed studio lighting (keyLight 1.6 + fillLight 0.5 + ambient 0.8) so building is always readable; created SimulationTickerPanel with KPI pills (ENERGY/COMFORT/CO₂ delta badges), zone ticker cards (live→projected temp, delta badge, damper/CO₂ override rows, sparkline SVG from store history), and discard button; removed SimulationDeltaBar, zoneDualWrap, buildingLabels dead code
- Why: Dual-building 3D caused persistent visibility failures due to dark materials+lighting; financial-terminal metaphor (ticker cards + delta badges + sparklines) is novel in BMS industry — confirmed by web research — and communicates simulation impact more clearly than side-by-side buildings

### 2026-04-07 FIX — 3D building lighting: bright materials + OrbitControls + static camera
- What: Replaced near-black MeshPhongMaterial colors (0x0e1c2e etc) with readable mid-tone steel-blue palette (mSlab 0x8a9eae, mSteel 0x7090b0, mGlass 0x90ccee); switched from manual camAngle auto-rotation to OrbitControls (mouse drag + scroll zoom + damping); three-point studio lighting (HemisphereLight sky/ground 1.0 + DirectionalLight key 2.0 + fill 0.8 + rim 0.4), fully decoupled from solar position; removed airflow scan post-processing and particle system; added ground plane and setClearColor
- Why: Materials too dark to reflect any light regardless of intensity; auto-rotation made navigation impossible; airflow scan may have added darkening post-processing pass

### 2026-04-08 FEAT — Zone Watchlist panel + confidence badges + rejection flow + AED counter
- What: Added TradingView-style floating ZoneWatchlist overlay on 3D canvas (temp, Δ setpoint, model confidence, detail drawer with RH/CO₂/damper). Added confidence % badges on rec cards. Added rejection reason sheet on Decline. Added AED savings counter banner in Building Report.
- Why: Gap analysis of INAIA product spec vs current UI — P1 features needed to win UAE market.

### 2026-04-08 REFACTOR — Digital Twin UI panel simplification and ZoneWatchlist update
- What: Removed bottom panels (SimulationTickerPanel, controls, zone strips) and expanded 3D canvas height; moved delta simulation and AED savings into an enlarged ZoneWatchlist.
- Why: Simplified UI by consolidating simulation data and allocating more screen space to the primary Digital Twin 3D view.

### 2026-04-08 FEAT — ZoneWatchlist inline deltas and expanded UI Drawer metrics
- What: Removed rigid positioning and extra delta columns in ZoneWatchlist; added inline deltas and mock Energy, Cost, Emissions details in zone drawer.
- Why: User requested dynamic sizing matching content and consolidating impact data into inline markers, removing redundant RH/CO2 details.

### 2026-04-08 FEAT — Format ZoneWatchlist as full data table
- What: Redesigned ZoneWatchlist to be a wide grid-based table displaying Temperature, Humidity, Energy, Cost, and CO2 Emissions directly as columns.
- Why: User requested a flat table layout for all KPIs instead of using the expandable drawer pattern.

### 2026-04-08 FIX — Compact ZoneWatchlist width to unblock 3D Twin View
- What: Migrated table measurement labels to column headers and significantly tightened grid widths.
- Why: Keep all requested KPIs visible concurrently without completely covering the underlying building twin.

### 2026-04-08 FEAT — Highlight column headers and colorize inline Simulation deltas
- What: Bolder, higher-contrast column labels and added vivid hardcoded red/yellow/green color parsing for inline simulation deltas.
- Why: User requested starker legibility on headers and UX improvement so that simulation deltas instantly stand out semantically (good/neutral/bad).

### 2026-04-08 FEAT — Git-style Action Timeline component for 3D Twin View
- What: Replaced bottom floor selector in 3D mode with an `ActionTimeline` tracking sequence of recommendations. Preserved floor bar in plan mode.
- Why: User requested a Git-like visual node graph mapping optimization history, complete with hover tooltips and an interactive rollback popup per commit.

### 2026-04-08 REFACTOR — Reporting view cleanup: remove AED banner + maintenance tabs
- What: Removed AED Savings Counter banner (redundant with KPI card); removed SYSTEM TIMELINE, FLEET HEALTH, EQUIPMENT HEALTH ANALYSIS tabs and all associated dead code (FleetDonut, SavingsBar, StatusBadge, MiniDonut, typeIcon, typeFmt, eqSort, equipment table); report charts now has 3 tabs: ENERGY SAVINGS | ZONE COMFORT ANALYSIS | CO₂ & COMPLIANCE
- Why: AED value was already in EST. ANNUAL SAVINGS KPI card; equipment/fleet health belongs in the Maintenance feature, not Reporting

### 2026-04-08 FEAT — Reporting: Anomaly Feed + Weather Context + Board Report PDF
- What: Added ANOMALY FEED tab (derives critical/warning/info anomalies from live zone+equipment data with AED/day waste estimates and recommended actions; severity dot + colored sev bar + alert indicator on tab); added WEATHER & OCCUPANCY tab (open-meteo API for current conditions + 48h forecast SVG sparkline with solar radiation + DEWA peak band shading + per-zone CO₂ occupancy bars); added BoardReport component (A4 structured print template with KPI grid, energy table, compliance bars, equipment summary, FM signature — prints via ↓ Board Report button replacing window.print() of the UI)
- Why: Phase 1 reporting features from INAIA product spec — anomaly feed, weather context, and proper board-level PDF export were missing from the analytics view

### In Progress

* **FEAT — Consolidated Analytics Tabbed UI**
  * Moved the Equipment Health Analysis and Zone Comfort Analysis tables into the main tabbed container within BuildingReportView.
  * Updated CSS to allow the tab container to responsibly expand and let the tables scroll, resulting in a single parent component switching between all analytics tools.
  * *Why*: User specified that all analytics (charts and tables) should live inside a single tab container to maximize screen real-estate and improve application layout UX.

* **FEAT — Tabbed UI for reporting charts**
- What: Consolidated SavingsChart and TimelineChart into a single tabbed container within BuildingReportView.
- Why: User requested switching between types of charts via tabs to keep the layout organized and improve UX.

### 2026-04-08 FEAT — Debug Mode: 3-column simulation layout with streaming charts
- What: Clicking "▶ Simulate" now transforms the dashboard into a 3-column debug view — mini 3D twin + KPI delta cards (B) and a scrollable stack of real-time LightweightCharts (C). ZoneWatchlist removed entirely. Exits on Apply/Discard.
- Why: FM engineers need to observe real-time parameter evolution (primary metric + zone temp/CO₂/fan power) while a recommendation is being evaluated before committing the change.

### 2026-04-08 FIX — SimulationDeltas rows + DebugTimelines mock data + chart responsiveness
- What: Deltas panel switched to horizontal rows showing live current value + delta %; COMFORT removed; DebugTimelines seeded with deterministic mock history per metric; charts use autoSize=true for responsive layout.
- Why: UX feedback — cards were vertical columns (ugly), charts were blank (no history data), and charts weren't resizing.

### 2026-04-08 FIX — Debug mode: simulate one-click, streaming charts, DS colors
- What: simulatingId now derived from Zustand store (survives layout swap → one click to activate); DebugTimelines uses setInterval 1s streaming; TradingView logo hidden; chart blocks dark (#171D23) per design system; series colors mapped to palette tokens.
- Why: Layout remount reset local state causing double-click; charts showed full mock data at once instead of live; backgrounds were --color-surface-2 (light) instead of canvas (dark).

### 2026-04-08 FIX — DebugTimelines: proper LW realtime generator + solid dark backgrounds
- What: Streaming now uses generator function + setInterval(1s) exactly per LightweightCharts realtime docs — seeds 90 min history then streams new points indefinitely. All chart/column backgrounds are solid #171D23 (--color-canvas), no alpha bleed.
- Why: Previous impl seeded all data at once; rgba backgrounds bled through light parent.

### 2026-04-08 FEAT — SimulationDeltas stock-ticker redesign + tighter chart noise
- What: SimulationDeltas redesigned to Google Finance style — large live number, unit, colored ↓/↑ % + absolute delta below each metric. Streams mock values at 1s when backend offline. DebugTimelines noise reduced (zone_temp ±0.02°C/s, fan_power ±18W/s) with stronger mean-reversion.
- Why: Cards layout was too heavy; user wants stock-ticker impact numbers. Chart variations were too volatile for a controlled setpoint recommendation.

### 2026-04-08 FEAT — Tripolar logo in sidebar + user chip in topbar
- What: Sidebar logo replaced with Tripolar /light.png image (clips naturally on collapse). User avatar + name moved from sidebar footer to topbar right side, next to the live/connecting pill. Sidebar footer removed.
- Why: User wants company branding visible and user identity next to connection status in the top bar.

### 2026-04-08 FEAT — Wider sidebar for logo + simulation delta HUD on mini 3D
- What: Sidebar collapsed width 52→60px, hover 200→220px so Tripolar logo shows fully. Mini BuildingViewer in debug mode now has glass-badge overlay (ENERGY/CO₂/COMFORT ↓%) positioned bottom-left on the dark 3D canvas.
- Why: Logo was getting clipped; mini twin showed no contextual data for the engineer.

### 2026-04-08 FIX — Delta HUD moved to main DigitalTwinView (not mini-twin)
- What: KPI delta badges (ENERGY/CO₂/COMFORT ↓%) now appear in the main DigitalTwinView HUD replacing climate data when simulationProjection is active. Removed from mini-twin. Dead CSS cleaned from DashboardSimulationLayout.
- Why: Wrong component — user wanted the main digital twin HUD, not the simulation mini-viewer.

### 2026-04-08 REFACTOR — Simulation mode: remove recs panel, compact rec card + Back button
- What: Simulation layout reduced to 2 columns (mini twin+rec+deltas | full-width timelines). RecSnapshot embedded in SimulationProjection. Applied IDs moved to Zustand store. Compact SimRecCard component with ✓ Apply + ← Back. RecommendationsPanel hidden during simulation.
- Why: Showing all recommendations during simulation wasted space and was distracting; timeline charts needed full width for readability.

### 2026-04-08 FEAT — 1-hour forecast charts + range-to-AI analysis tools
- What: Replaced streaming random-walk with static 1-hour forecast (30 min history + 60 min ahead). PRIMARY chart shows baseline vs simulated dual-track. SimulationDeltas switched to "next hr" window (removed annual /yr). Range selector on each chart with "Ask AI →" that pre-fills AIChatBubble context.
- Why: Simulation is a forecast, not live data — static forward projection is more meaningful; 1-hr window matches the actual planning horizon.
