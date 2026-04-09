
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** af
- **Date:** 2026-04-06
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Cold start loads dashboard and reaches connected live state
- **Test Code:** [TC001_Cold_start_loads_dashboard_and_reaches_connected_live_state.py](./TC001_Cold_start_loads_dashboard_and_reaches_connected_live_state.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/1332965d-b1a7-4a41-9708-d75e2437d8f4
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Live status reflects connecting to connected lifecycle
- **Test Code:** [TC002_Live_status_reflects_connecting_to_connected_lifecycle.py](./TC002_Live_status_reflects_connecting_to_connected_lifecycle.py)
- **Test Error:** TEST FAILURE

The connection lifecycle transition could not be observed — the app shows the connected state but did not display the intermediate 'CONNECTING' status during initial load.

Observations:
- The topbar shows 'LIVE' after loading (status element present).
- No 'CONNECTING' status text was seen in the page elements after 4 reload attempts.
- The UI reached the connected state but the expected intermediate state was not observable.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/8e1e2a86-a70e-47c3-b7b1-66a4af398872
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Sidebar tab switching preserves mounted view state
- **Test Code:** [TC003_Sidebar_tab_switching_preserves_mounted_view_state.py](./TC003_Sidebar_tab_switching_preserves_mounted_view_state.py)
- **Test Error:** Summary of findings and final report:

I was asked to verify that switching between sidebar views does not reset the previously mounted Digital Twin view state. I navigated to the app root (http://localhost:5173) and waited for the SPA to finish loading. The Digital Twin view loaded and is visible: the 3D model is displayed along with recommendation cards, sliders, a 3D / Floor plan toggle, and floor selector buttons labeled F1, F2, F3 (interactive element indexes visible on the page: F1=4323, F2=4325, F3=4328). There are about 65 interactive elements on the page.

I attempted to perform the required state change (select a different floor) and to then switch to another sidebar view and return to verify persistence. I made three attempts to click the floor buttons (F1, F2, F3). Each attempt failed: the test runner reported that the target element was non-interactable or the element index was stale. Because these clicks could not be completed, I could not proceed to switch the sidebar away and back or verify whether the selected floor persisted. No errors from the application UI were visible beyond the inability to interact with the floor buttons from the test harness perspective.

Observed facts:
- SPA root reached and fully rendered; Digital Twin UI visible with expected controls. 
- Floor selector buttons exist and are present in the DOM (F1=4323, F2=4325, F3=4328).
- Attempts to click those floor buttons failed 3 times due to 'element not interactable / stale element reference'.
- Sidebar view switch and verification steps were not performed because the floor selection step could not be completed.

Because the core interaction (changing the mounted Digital Twin floor) could not be completed due to repeated non-interactable/stale element errors, I could not verify whether switching sidebar views resets the Digital Twin state. The user instructed to terminate the agent after 3 failures; following that instruction, I am stopping here.

Result: TEST NOT COMPLETED — interaction failures prevented verification.

Extra info provided but not used: username cquiala12@gmail.com (credentials were available but not required for the observed flow).

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/ddef227b-491f-4fb0-bb37-b3691ce167b7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Auto-reconnect restores live connected state after an unexpected disconnect
- **Test Code:** [TC004_Auto_reconnect_restores_live_connected_state_after_an_unexpected_disconnect.py](./TC004_Auto_reconnect_restores_live_connected_state_after_an_unexpected_disconnect.py)
- **Test Error:** TEST BLOCKED

The feature to simulate or force a live connection drop is not available in the app UI, so the reconnection flow could not be exercised.

Observations:
- The page shows a LIVE indicator, but there are no visible controls or menu items labeled 'disconnect', 'reconnect', 'reconnecting', 'offline', or 'retry'.
- A search of the visible page text and the LIVE indicator panel found no reconnect/disconnect controls or explicit reconnecting status to trigger or observe.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/f55a88af-b701-4dbc-8641-3c7a7fdb4193
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Digital Twin renders live snapshot and updates visualizations over time
- **Test Code:** [TC005_Digital_Twin_renders_live_snapshot_and_updates_visualizations_over_time.py](./TC005_Digital_Twin_renders_live_snapshot_and_updates_visualizations_over_time.py)
- **Test Error:** TEST FAILURE

The Digital Twin rendered but did not show changes between snapshots; live updates could not be confirmed.

Observations:
- The topbar shows 'LIVE' and the 3D viewer, floor-plan controls, zone tiles and recommendation cards are present.
- Two snapshots were captured (extracted_content_0.md and extracted_content_1.md) but the zone temperatures, RH, CO₂ and equipment metrics remained the same.
- Recommendations and total system power stayed identical across snapshots.


Attachments:

extracted_content_0.md:
<url>
http://localhost:5173/
</url>
<query>
Capture current Digital Twin state: list zones NOR, SOU, EAS, WES, COR and for each provide Temperature (T), Relative Humidity (RH), and CO₂ (ppm). Also capture the topbar live indicator text (e.g., LIVE) and which viewer mode button is active (3D or Floor plan). Capture any visible equipment status or recommendation summaries from the left panel (e.g., damper %, fan status, cooling setpoints).
</query>
<result>
Topbar live indicator: LIVE

Viewer mode buttons visible: 3D and Floor plan
Active viewer mode: not explicitly indicated in the page content

Zone sensor readings (as shown)
- NOR: T 23.9°C; RH 66%; CO₂ 924 ppm
- SOU: T 27.9°C; RH 66%; CO₂ 924 ppm
- EAS: T 27.7°C; RH 66%; CO₂ 924 ppm
- WES: T 24.7°C; RH 66%; CO₂ 924 ppm
- COR: T 25.3°C; RH 66%; CO₂ 924 ppm

Visible equipment status / recommendation summaries (left panel)
- RECOMMENDATIONS: 3 actions (summary list)
1) ZONE CORE — HIGH IMPACT
   - Issue: Fan active at full speed during unoccupied hours; CO₂ at 415 ppm; no occupancy detected.
   - Current: 100% damper
   - Recommended: 15% damper
   - Estimated savings: ↓ 2.1 kWh/day · AED 287/yr

2) ZONE SOUTH — MEDIUM
   - Issue: Overcooling 1.8°C below lower setpoint during peak electricity price window (14:00–19:00).
   - Current: 21°C cooling setpoint
   - Recommended: 23°C cooling setpoint
   - Estimated savings: ↓ 1.4 kWh/day · AED 192/yr

3) ZONE NORTH — MEDIUM
   - Issue: Outside air damper 40% above IAQ minimum; CO₂ at 420 ppm (threshold 800 ppm).
   - Current: 75% OA damper
   - Recommended: 45% OA damper
   - Estimated savings: ↓ 0.9 kWh/day · AED 123/yr

Additional visible equipment / system status
- TOTAL SYSTEM POWER: 0.00 kW
- Fan: 0 W
- Chiller: 0 W
- EQUIPMENT: 0 assets; ASSETS ONLINE 0/0
- Equipment/zone analytics awaiting BOPTEST data (Equipment Health / Zone Comfort show "Awaiting ...")
</result>

extracted_content_1.md:
<url>
http://localhost:5173/
</url>
<query>
Capture current Digital Twin state: list zones NOR, SOU, EAS, WES, COR and for each provide Temperature (T), Relative Humidity (RH), and CO₂ (ppm). Also capture the topbar live indicator text (e.g., LIVE) and which viewer mode button is active (3D or Floor plan). Capture any visible equipment status or recommendation summaries from the left panel (e.g., damper %, fan status, cooling setpoints).
</query>
<result>
Topbar live indicator: LIVE

Viewer mode active: not specified on page (page shows both "3D" and "Floor plan" options as "3DFloor plan" with no clear active state)

Zones
- NOR: T 23.9°C, RH 66%, CO₂ 925 ppm
- SOU: T 27.9°C, RH 66%, CO₂ 925 ppm
- EAS: T 27.7°C, RH 66%, CO₂ 925 ppm
- WES: T 24.7°C, RH 66%, CO₂ 925 ppm
- COR: T 25.3°C, RH 66%, CO₂ 925 ppm

Visible equipment status / recommendation summaries (left panel)
- ZONE CORE (HIGH IMPACT)
  - Note: Fan active at full speed during unoccupied hours — CO₂ at 415 ppm, no occupancy detected.
  - CURRENT: 100% damper
  - RECOMMENDED: 15% damper
  - Estimated savings: ↓ 2.1 kWh/day · AED 287/yr
- ZONE SOUTH (MEDIUM)
  - Note: Overcooling 1.8°C below lower setpoint during peak electricity price window (14:00–19:00).
  - CURRENT: 21°C cooling setpoint
  - RECOMMENDED: 23°C cooling setpoint
  - Estimated savings: ↓ 1.4 kWh/day · AED 192/yr
- ZONE NORTH (MEDIUM)
  - Note: Outside air damper 40% above IAQ minimum — CO₂ at 420 ppm, threshold is 800 ppm.
  - CURRENT: 75% OA damper
  - RECOMMENDED: 45% OA damper
  - Estimated savings: ↓ 0.9 kWh/day · AED 123/yr

Other visible equipment metric
- TOTAL SYSTEM POWER: 0.00 kW (Fan 0 W · Chiller 0 W)
</result>
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/11511f4d-bfcf-40fa-9846-0ba08ff5a3ca
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Receives streaming updates without interrupting the current view
- **Test Code:** [TC006_Receives_streaming_updates_without_interrupting_the_current_view.py](./TC006_Receives_streaming_updates_without_interrupting_the_current_view.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/99964081-20d9-4653-89ed-ece0ac1d7975
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Shows disconnected status when live connection is unavailable and last-known data remains usable
- **Test Code:** [TC007_Shows_disconnected_status_when_live_connection_is_unavailable_and_last_known_data_remains_usable.py](./TC007_Shows_disconnected_status_when_live_connection_is_unavailable_and_last_known_data_remains_usable.py)
- **Test Error:** TEST FAILURE

The app shows a LIVE indicator but there is no UI control to simulate or force a disconnected live state. Without a way to make the app fail to establish live connectivity via the UI, the required verification cannot be completed.

Observations:
- The topbar shows a 'LIVE' indicator.
- No menu option, toggle, or button was found to disable or simulate live connectivity.
- The dashboard (3D model and recommendations) remains rendered and usable.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/0fb0a1e6-9ae6-4215-8602-91de25923c69
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Simulation baseline comparison displays delta alongside live updates
- **Test Code:** [TC008_Simulation_baseline_comparison_displays_delta_alongside_live_updates.py](./TC008_Simulation_baseline_comparison_displays_delta_alongside_live_updates.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/deaeeccb-c804-450f-b4b0-a13c7ba7a145
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Backoff retry eventually reconnects after initial connection failure
- **Test Code:** [TC009_Backoff_retry_eventually_reconnects_after_initial_connection_failure.py](./TC009_Backoff_retry_eventually_reconnects_after_initial_connection_failure.py)
- **Test Error:** TEST BLOCKED

The feature could not be fully tested because I cannot simulate or trigger an initial live connection failure from the UI or control network conditions in this environment.

Observations:
- The topbar shows a LIVE indicator (green) and the app is currently connected.
- There are no visible UI controls to disconnect or force a failed connection attempt.
- There is no visible log or retry indicator control to observe backoff/retry behavior.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/bcd4797c-bdc5-4da1-a8dd-d625cb8a2c00
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Open Predictive Maintenance and view an equipment health summary
- **Test Code:** [TC010_Open_Predictive_Maintenance_and_view_an_equipment_health_summary.py](./TC010_Open_Predictive_Maintenance_and_view_an_equipment_health_summary.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/0898b1cf-3aa8-4bb9-8406-428b30abd274
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Malformed live snapshot degrades gracefully and manual refresh recovers
- **Test Code:** [TC011_Malformed_live_snapshot_degrades_gracefully_and_manual_refresh_recovers.py](./TC011_Malformed_live_snapshot_degrades_gracefully_and_manual_refresh_recovers.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/a91d9753-4a97-4a35-b11f-6a8987dbf2e9
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 View 24h and 7d historical report charts
- **Test Code:** [TC012_View_24h_and_7d_historical_report_charts.py](./TC012_View_24h_and_7d_historical_report_charts.py)
- **Test Error:** TEST BLOCKED

The range controls could not be interacted with so the test could not finish.

Observations:
- Clicking the 24h range button failed with a stale/uninteractable element.
- The text '24h' is visible after scrolling but there is no responsive control available to change the report range.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/ebc847f1-6492-4f95-a902-c72be004d7cf
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Select an AHU and view 24h equipment timeline
- **Test Code:** [TC013_Select_an_AHU_and_view_24h_equipment_timeline.py](./TC013_Select_an_AHU_and_view_24h_equipment_timeline.py)
- **Test Error:** TEST BLOCKED

The test could not be completed because interactive controls required to open the Equipment/Asset Tree are not reliably interactable in this session.

Observations:
- Clicking the floating action button previously failed with 'element not interactable' and the attempted element index appears stale.
- The page intermittently rendered blank then recovered; although the UI is visible now, repeated clicks did not reveal the TreeView.
- 'AHU-01' and '24h' controls are present in the DOM, but I could not open the tree or select them through the visible interactive controls.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/a63a7720-2773-4058-ba70-8189ad0591fa
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 Switch 7d to 30d and verify report updates
- **Test Code:** [TC014_Switch_7d_to_30d_and_verify_report_updates.py](./TC014_Switch_7d_to_30d_and_verify_report_updates.py)
- **Test Error:** Scrolled to text: Building Report
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/58937f79-1172-4a65-bcb6-cc3057cb51d3
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Preserve TreeView selection when switching away and back
- **Test Code:** [TC015_Preserve_TreeView_selection_when_switching_away_and_back.py](./TC015_Preserve_TreeView_selection_when_switching_away_and_back.py)
- **Test Error:** TEST BLOCKED

The feature required to run this test could not be reached — the page does not expose a selectable equipment entry named 'AHU-1' nor an equipment selection list to exercise selection persistence.

Observations:
- The page rendered successfully but no 'AHU-1' string or equipment list was found among the visible interactive elements and page content.
- The UI contains zone cards and building view controls (3D / Floor plan) but no selectable equipment item named 'AHU-1' to select and verify.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2e2bbc87-a88a-4352-812f-ecd68d64d78d/9d6a9475-0931-4efa-a662-ec99baefc0a9
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **33.33** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---