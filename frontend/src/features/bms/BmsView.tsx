import { useBmsData } from './useBmsData'
import { KpiStrip } from './KpiStrip'
import { TopologyGraph } from './TopologyGraph'
import { ControlPanel } from './ControlPanel'
import './BmsView.css'

const EMPTY_SNAPSHOT = {
  timestamp: 0,
  chi_reaPChi_y: 0, chi_reaPPumDis_y: 0,
  chi_reaTSup_y: 293.15, chi_reaTRet_y: 293.15, chi_reaFloSup_y: 0,
  heaPum_reaPHeaPum_y: 0, heaPum_reaPPumDis_y: 0,
  heaPum_reaTSup_y: 293.15, heaPum_reaTRet_y: 293.15, heaPum_reaFloSup_y: 0,
  hvac_reaAhu_PFanSup_y: 0, hvac_reaAhu_TMix_y: 293.15,
  hvac_reaAhu_TSup_y: 293.15, hvac_reaAhu_TRet_y: 293.15,
  hvac_reaAhu_V_flow_sup_y: 0, hvac_reaAhu_V_flow_ret_y: 0,
  hvac_reaAhu_TCooCoiSup_y: 293.15, hvac_reaAhu_TCooCoiRet_y: 293.15,
  hvac_reaAhu_dp_sup_y: 0,
  hvac_reaZonCor_TZon_y: 293.15, hvac_reaZonCor_V_flow_y: 0,
  hvac_reaZonCor_CO2Zon_y: 400, hvac_reaZonCor_TSup_y: 293.15,
  hvac_reaZonNor_TZon_y: 293.15, hvac_reaZonNor_V_flow_y: 0,
  hvac_reaZonNor_CO2Zon_y: 400, hvac_reaZonNor_TSup_y: 293.15,
  hvac_reaZonSou_TZon_y: 293.15, hvac_reaZonSou_V_flow_y: 0,
  hvac_reaZonSou_CO2Zon_y: 400, hvac_reaZonSou_TSup_y: 293.15,
  hvac_reaZonEas_TZon_y: 293.15, hvac_reaZonEas_V_flow_y: 0,
  hvac_reaZonEas_CO2Zon_y: 400, hvac_reaZonEas_TSup_y: 293.15,
  hvac_reaZonWes_TZon_y: 293.15, hvac_reaZonWes_V_flow_y: 0,
  hvac_reaZonWes_CO2Zon_y: 400, hvac_reaZonWes_TSup_y: 293.15,
  weaSta_reaWeaTDryBul_y: 293.15,
  total_elec_kw: 0, pue: 1, cooling_load_kw: 0,
  heating_load_kw: 0, co2_kg_per_hr: 0, chw_flow_lph: 0,
}

export function BmsView() {
  const { snapshot, history, isStale, isLoading, refetchNow } = useBmsData()

  const snap = snapshot ?? EMPTY_SNAPSHOT

  return (
    <div className="bms-view">

      {/* ── Status bar ──────────────────────────────────────────────── */}
      {(isStale || isLoading) && (
        <div className={`bms-status-bar ${isStale ? 'bms-status-bar--stale' : ''}`}>
          {isLoading ? 'Fetching BMS data…' : 'DATA STALE — reconnecting…'}
        </div>
      )}

      {/* ── KPI strip (full width) ──────────────────────────────────── */}
      <KpiStrip snapshot={snap} history={history} />

      {/* ── Body: topology + control panel ─────────────────────────── */}
      <div className="bms-body">
        <div className="bms-graph-slot">
          <TopologyGraph snapshot={snap} />
        </div>
        <div className="bms-control-slot">
          <ControlPanel snapshot={snap} onControlSent={refetchNow} />
        </div>
      </div>

    </div>
  )
}
