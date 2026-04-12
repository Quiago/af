export interface BmsSnapshot {
  timestamp: number
  sim_time_s: number              // BOPTEST simulation time [s]

  // Chiller
  chi_reaPChi_y: number           // W
  chi_reaPPumDis_y: number        // W — CHW distribution pump
  chi_reaTSup_y: number           // K
  chi_reaTRet_y: number           // K
  chi_reaFloSup_y: number         // m3/s

  // Heat pump
  heaPum_reaPHeaPum_y: number     // W
  heaPum_reaPPumDis_y: number     // W — HW distribution pump
  heaPum_reaTSup_y: number        // K
  heaPum_reaTRet_y: number        // K
  heaPum_reaFloSup_y: number      // m3/s

  // AHU fans & pumps
  hvac_reaAhu_PFanSup_y: number   // W
  hvac_reaAhu_PPumCoo_y: number   // W — cooling coil pump
  hvac_reaAhu_PPumHea_y: number   // W — heating coil pump

  // AHU air-side
  hvac_reaAhu_TMix_y: number      // K — mixed air
  hvac_reaAhu_TSup_y: number      // K — supply air
  hvac_reaAhu_TRet_y: number      // K — return air
  hvac_reaAhu_V_flow_sup_y: number
  hvac_reaAhu_V_flow_ret_y: number
  hvac_reaAhu_dp_sup_y: number    // Pa

  // AHU cooling coil water
  hvac_reaAhu_TCooCoiSup_y: number
  hvac_reaAhu_TCooCoiRet_y: number

  // AHU heating coil water (distinct from heat pump supply/return)
  hvac_reaAhu_THeaCoiSup_y: number
  hvac_reaAhu_THeaCoiRet_y: number

  // Zones
  hvac_reaZonCor_TZon_y: number
  hvac_reaZonCor_V_flow_y: number
  hvac_reaZonCor_CO2Zon_y: number
  hvac_reaZonCor_TSup_y: number

  hvac_reaZonNor_TZon_y: number
  hvac_reaZonNor_V_flow_y: number
  hvac_reaZonNor_CO2Zon_y: number
  hvac_reaZonNor_TSup_y: number

  hvac_reaZonSou_TZon_y: number
  hvac_reaZonSou_V_flow_y: number
  hvac_reaZonSou_CO2Zon_y: number
  hvac_reaZonSou_TSup_y: number

  hvac_reaZonEas_TZon_y: number
  hvac_reaZonEas_V_flow_y: number
  hvac_reaZonEas_CO2Zon_y: number
  hvac_reaZonEas_TSup_y: number

  hvac_reaZonWes_TZon_y: number
  hvac_reaZonWes_V_flow_y: number
  hvac_reaZonWes_CO2Zon_y: number
  hvac_reaZonWes_TSup_y: number

  // Weather (Chicago O'Hare TMY3)
  weaSta_reaWeaTDryBul_y: number    // K
  weaSta_reaWeaTWetBul_y: number    // K
  weaSta_reaWeaRelHum_y: number     // 0-1
  weaSta_reaWeaWinSpe_y: number     // m/s
  weaSta_reaWeaWinDir_y: number     // rad
  weaSta_reaWeaHGloHor_y: number    // W/m2
  weaSta_reaWeaHDirNor_y: number    // W/m2
  weaSta_reaWeaPAtm_y: number       // Pa

  // Derived KPIs
  total_elec_kw: number
  cooling_load_kw: number
  heating_load_kw: number
  chiller_cop: number
  hp_cop: number
  co2_kg_per_hr: number
  chw_flow_lph: number
}

export interface BmsControlPayload {
  point_name: string
  value: number       // MUST be in BOPTEST native units (K, 0-1 fraction, Pa)
  activate: number
}

export type ZoneId = 'cor' | 'nor' | 'sou' | 'eas' | 'wes'

export interface KpiHistory {
  total_elec_kw: number[]
  cooling_load_kw: number[]
  heating_load_kw: number[]
  chiller_cop: number[]
  hp_cop: number[]
  co2_kg_per_hr: number[]
  oa_temp_c: number[]
}
