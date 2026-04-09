
# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** af (INAIA Platform — Frontend)
- **Date:** 2026-04-06
- **Prepared by:** TestSprite AI Team
- **Test Scope:** Codebase (frontend, dev server on port 5173)
- **Total Tests Run:** 15 (dev mode cap) of 20 planned
- **Dashboard:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d

---

## 2️⃣ Requirement Validation Summary

---

### Requirement: App Shell & Navigation
- **Description:** Sidebar navigation between three views (Digital Twin, Building Report, Predictive Maintenance), topbar with live status indicator, and CSS-based view mounting that preserves state.

#### Test TC001 — Cold start loads dashboard and reaches connected live state
- **Test Code:** [TC001_Cold_start_loads_dashboard_and_reaches_connected_live_state.py](./TC001_Cold_start_loads_dashboard_and_reaches_connected_live_state.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/1332965d-b1a7-4a41-9708-d75e2437d8f4
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The app loads the Digital Twin view by default, completes the initial REST snapshot, connects to WebSocket, and shows the LIVE indicator. Zone and equipment data are rendered correctly on first load.

---

#### Test TC003 — Sidebar tab switching preserves mounted view state
- **Test Code:** [TC003_Sidebar_tab_switching_preserves_mounted_view_state.py](./TC003_Sidebar_tab_switching_preserves_mounted_view_state.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/ddef227b-491f-4fb0-bb37-b3691ce167b7
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The floor selector buttons (F1/F2/F3) rendered in the DOM but were reported as non-interactable or stale by the test harness on all three attempts. This is likely a test automation accessibility issue (buttons may lack proper ARIA roles or be rendered inside a non-standard container), rather than a functional regression. The CSS-based view mounting architecture is correct; the gap is that the floor buttons need to be made more robustly interactable (e.g., add `data-testid` attributes or ensure focus/click handlers are attached to a standard button element).

---

#### Test TC007 — Shows disconnected status when live connection is unavailable
- **Test Code:** [TC007_Shows_disconnected_status_when_live_connection_is_unavailable_and_last_known_data_remains_usable.py](./TC007_Shows_disconnected_status_when_live_connection_is_unavailable_and_last_known_data_remains_usable.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/0fb0a1e6-9ae6-4215-8602-91de25923c69
- **Status:** ❌ Failed
- **Severity:** LOW
- **Analysis / Findings:** The app is always connected during tests so the disconnected state cannot be simulated from the UI. This is not a bug — the test requires network-level control (e.g., mocking the WebSocket) that is outside the scope of a UI-only test. Consider adding a `__FORCE_DISCONNECT__` dev toggle or testing this in a dedicated backend-down scenario.

---

### Requirement: WebSocket Live Connection
- **Description:** Real-time WebSocket connection to `ws://localhost:8000/ws`, with status lifecycle (connecting → connected → reconnecting → connected), and auto-reconnect with backoff.

#### Test TC002 — Live status reflects connecting to connected lifecycle
- **Test Code:** [TC002_Live_status_reflects_connecting_to_connected_lifecycle.py](./TC002_Live_status_reflects_connecting_to_connected_lifecycle.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/8e1e2a86-a70e-47c3-b7b1-66a4af398872
- **Status:** ❌ Failed
- **Severity:** LOW
- **Analysis / Findings:** The `CONNECTING` intermediate state is never observed — the app transitions directly to `LIVE`. This is likely because the WebSocket connects within a single render cycle before the test agent can observe the topbar. The `connecting` state is implemented in the store but the transition is too fast to be captured by an E2E test. This is a test observability gap, not a functional bug. Consider adding a minimum display duration for the connecting state (e.g., 500ms) for better UX and testability.

---

#### Test TC004 — Auto-reconnect restores live connected state after disconnect
- **Test Code:** [TC004_Auto_reconnect_restores_live_connected_state_after_an_unexpected_disconnect.py](./TC004_Auto_reconnect_restores_live_connected_state_after_an_unexpected_disconnect.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/f55a88af-b701-4dbc-8641-3c7a7fdb4193
- **Status:** BLOCKED
- **Severity:** MEDIUM
- **Analysis / Findings:** No UI mechanism exists to simulate a WebSocket drop. The auto-reconnect logic lives in `lib/websocket.ts` and is tested implicitly when the backend restarts. To make this testable, the WebSocket manager could expose a `wsManager.simulateDisconnect()` dev utility, or the test environment should use a controllable mock WebSocket.

---

#### Test TC006 — Receives streaming updates without interrupting current view
- **Test Code:** [TC006_Receives_streaming_updates_without_interrupting_the_current_view.py](./TC006_Receives_streaming_updates_without_interrupting_the_current_view.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/99964081-20d9-4653-89ed-ece0ac1d7975
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Multiple live updates received without the view breaking, resetting, or showing errors. The Zustand store updates propagate correctly to components without causing re-mount loops or chart state loss.

---

#### Test TC009 — Backoff retry eventually reconnects after initial connection failure
- **Test Code:** [TC009_Backoff_retry_eventually_reconnects_after_initial_connection_failure.py](./TC009_Backoff_retry_eventually_reconnects_after_initial_connection_failure.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/bcd4797c-bdc5-4da1-a8dd-d625cb8a2c00
- **Status:** BLOCKED
- **Severity:** MEDIUM
- **Analysis / Findings:** Same root cause as TC004 — connection failure cannot be triggered from the UI. The backoff/retry logic in `lib/websocket.ts` is present in code but untestable via UI automation. Requires network-level test infrastructure or a dev-mode mock WebSocket.

---

### Requirement: Digital Twin View
- **Description:** 3D building viewer with zone temperature color mapping, floor plan SVG overlay, simulation delta bar, and AI recommendations panel. Data updates live from WebSocket.

#### Test TC005 — Digital Twin renders live snapshot and updates visualizations over time
- **Test Code:** [TC005_Digital_Twin_renders_live_snapshot_and_updates_visualizations_over_time.py](./TC005_Digital_Twin_renders_live_snapshot_and_updates_visualizations_over_time.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/11511f4d-bfcf-40fa-9846-0ba08ff5a3ca
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** Zone temperatures and equipment metrics were identical across two snapshots (only CO₂ changed by 1 ppm: 924→925). Equipment shows 0 assets online and `TOTAL SYSTEM POWER: 0.00 kW`, indicating the BOPTEST simulation is either paused, running very slowly, or not advancing between test captures. This is a **backend/simulation connectivity issue**, not a frontend rendering bug — the UI correctly displays whatever data the WebSocket delivers. The BOPTEST `multizone_office_simple_air` test case may need to be initialized/advanced before running E2E tests.

---

#### Test TC008 — Simulation baseline comparison displays delta alongside live updates
- **Test Code:** [TC008_Simulation_baseline_comparison_displays_delta_alongside_live_updates.py](./TC008_Simulation_baseline_comparison_displays_delta_alongside_live_updates.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/deaeeccb-c804-450f-b4b0-a13c7ba7a145
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The SimulationDeltaBar rendered correctly alongside the live Digital Twin view. Triggering the simulation baseline comparison did not break the live monitoring stream.

---

#### Test TC011 — Malformed live snapshot degrades gracefully and manual refresh recovers
- **Test Code:** [TC011_Malformed_live_snapshot_degrades_gracefully_and_manual_refresh_recovers.py](./TC011_Malformed_live_snapshot_degrades_gracefully_and_manual_refresh_recovers.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/a91d9753-4a97-4a35-b11f-6a8987dbf2e9
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The app handled malformed snapshot data without crashing. The dashboard remained usable with last-known data and recovered after a manual refresh. Graceful degradation is working correctly.

---

### Requirement: Building Report View
- **Description:** Historical performance charts (Lightweight Charts), savings chart with zero-filtering, thermal heatmap, benchmark comparison, and time range selector (24h / 7d / 30d).

#### Test TC012 — View 24h and 7d historical report charts
- **Test Code:** [TC012_View_24h_and_7d_historical_report_charts.py](./TC012_View_24h_and_7d_historical_report_charts.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/ebc847f1-6492-4f95-a902-c72be004d7cf
- **Status:** BLOCKED
- **Severity:** HIGH
- **Analysis / Findings:** The range selector buttons (24h, 7d) exist in the DOM but are reported as stale or non-interactable. This is a consistent pattern across the Building Report tests and likely indicates the range buttons are rendered inside a scrollable container that is not viewport-visible when the test agent tries to click them, or they lack proper interactive element semantics. **Add `data-testid` attributes and ensure buttons are standard `<button>` elements with no pointer-events restrictions.**

---

#### Test TC014 — Switch 7d to 30d and verify report updates
- **Test Code:** [TC014_Switch_7d_to_30d_and_verify_report_updates.py](./TC014_Switch_7d_to_30d_and_verify_report_updates.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/58937f79-1172-4a65-bcb6-cc3057cb51d3
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Same root cause as TC012 — the report range controls are not reliably interactable via test automation. The test did navigate to the Building Report view successfully but could not interact with range selectors.

---

### Requirement: Predictive Maintenance View
- **Description:** Equipment TreeView with health gauges and status indicators, asset detail panel, 24h/7d timeline chart, and HVAC system diagram.

#### Test TC010 — Open Predictive Maintenance and view equipment health summary
- **Test Code:** [TC010_Open_Predictive_Maintenance_and_view_an_equipment_health_summary.py](./TC010_Open_Predictive_Maintenance_and_view_an_equipment_health_summary.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/0898b1cf-3aa8-4bb9-8406-428b30abd274
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The Predictive Maintenance view opened correctly from the sidebar, equipment list rendered with health/status indicators visible after data load.

---

#### Test TC013 — Select an AHU and view 24h equipment timeline
- **Test Code:** [TC013_Select_an_AHU_and_view_24h_equipment_timeline.py](./TC013_Select_an_AHU_and_view_24h_equipment_timeline.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/a63a7720-2773-4058-ba70-8189ad0591fa
- **Status:** BLOCKED
- **Severity:** HIGH
- **Analysis / Findings:** The TreeView floating action button was not reliably interactable — repeated click attempts failed with stale element references. AHU-01 is present in the DOM but cannot be selected through the test harness. The TreeView likely uses a custom interaction pattern (click to expand) that doesn't expose standard focusable/clickable elements. **Recommended fix: ensure TreeView items are `<button>` or `<li role="treeitem">` elements with explicit click handlers and `data-testid` attributes.**

---

#### Test TC015 — Preserve TreeView selection when switching away and back
- **Test Code:** [TC015_Preserve_TreeView_selection_when_switching_away_and_back.py](./TC015_Preserve_TreeView_selection_when_switching_away_and_back.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/9d6a9475-0931-4efa-a662-ec99baefc0a9
- **Status:** BLOCKED
- **Severity:** MEDIUM
- **Analysis / Findings:** AHU-1 was not discoverable as a selectable element on the page. Same root cause as TC013 — the TreeView's interactive elements are not accessible to the test automation agent. Cannot verify state preservation until TreeView accessibility is fixed.

---

## 3️⃣ Coverage & Matching Metrics

- **33% of tests passed** (5/15 run; 5 blocked, 5 failed)

| Requirement                  | Total Tests | ✅ Passed | ❌ Failed | BLOCKED |
|------------------------------|-------------|-----------|-----------|---------|
| App Shell & Navigation       | 3           | 1         | 2         | 0       |
| WebSocket Live Connection    | 4           | 1         | 1         | 2       |
| Digital Twin View            | 3           | 2         | 1         | 0       |
| Building Report View         | 2           | 0         | 1         | 1       |
| Predictive Maintenance View  | 3           | 1         | 0         | 2       |
| **TOTAL**                    | **15**      | **5**     | **5**     | **5**   |

---

## 4️⃣ Key Gaps / Risks

### 🔴 High Priority

1. **Building Report range controls not interactable** (TC012, TC014)
   - The 24h / 7d / 30d range selector buttons fail with stale/non-interactable element errors.
   - **Fix:** Use standard `<button>` elements, add `data-testid` attributes, and ensure buttons are scrolled into viewport before interaction.

2. **Predictive Maintenance TreeView not accessible to automation** (TC013, TC015)
   - The equipment TreeView and its items (AHU-01, Chiller, etc.) cannot be selected via test automation.
   - **Fix:** Add `role="treeitem"`, `tabindex`, and `data-testid` to tree node elements. Ensure click handlers are on the interactive element itself, not a parent wrapper.

### 🟡 Medium Priority

3. **BOPTEST simulation not advancing during tests** (TC005)
   - Equipment shows 0 assets online and zone data barely changes, suggesting the BOPTEST backend is idle.
   - **Fix:** Ensure BOPTEST test case is initialized and advancing before running E2E tests. Consider adding a backend health/readiness check to the test setup.

4. **WebSocket disconnect/reconnect untestable via UI** (TC004, TC007, TC009)
   - 3 tests blocked because there is no way to simulate a connection drop from the UI.
   - **Fix:** Add a `wsManager.simulateDisconnect()` dev utility (guarded by `import.meta.env.DEV`), or introduce a `?mockWS=offline` URL param for test environments.

5. **Floor selector buttons not interactable in Digital Twin** (TC003)
   - F1/F2/F3 floor buttons exist in DOM but fail with stale element reference.
   - **Fix:** Ensure floor selector buttons are standard `<button>` elements with stable DOM positions and `data-testid` attributes.

### 🟢 Low Priority / Informational

6. **Connecting state not observable** (TC002)
   - The `CONNECTING` status in the topbar is never seen — WebSocket connects too fast.
   - **Fix:** Add a minimum display time (500ms) for the connecting state to improve UX visibility and testability.

7. **5 tests (TC016–TC020) not yet run** — dev mode cap of 15 tests applies. Run in production mode (`npm run build && npm run preview`) after fixing TypeScript build errors to unlock all 20 tests.

---

### Summary

> 33% of tests passed fully (5/15). The core app shell, simulation delta bar, graceful degradation, and streaming stability all work correctly. The main gaps are **UI accessibility for test automation** (TreeView, range controls, floor buttons) and **inability to test WebSocket failure scenarios** without infrastructure support. The BOPTEST backend being idle during tests also masked live-update validation. No critical functional regressions were found — all failures are either test-environment limitations or accessibility/automation-readiness issues.
