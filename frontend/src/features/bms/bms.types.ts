export interface BmsSnapshot {
  timestamp: number

  // Chiller
  chi_reaPChi_y: number
  chi_reaPPumDis_y: number
  chi_reaTSup_y: number
  chi_reaTRet_y: number
  chi_reaFloSup_y: number

  // Heat pump
  heaPum_reaPHeaPum_y: number
  heaPum_reaPPumDis_y: number
  heaPum_reaTSup_y: number
  heaPum_reaTRet_y: number
  heaPum_reaFloSup_y: number

  // AHU
  hvac_reaAhu_PFanSup_y: number
  hvac_reaAhu_TMix_y: number
  hvac_reaAhu_TSup_y: number
  hvac_reaAhu_TRet_y: number
  hvac_reaAhu_V_flow_sup_y: number
  hvac_reaAhu_V_flow_ret_y: number
  hvac_reaAhu_TCooCoiSup_y: number
  hvac_reaAhu_TCooCoiRet_y: number
  hvac_reaAhu_dp_sup_y: number

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

  // Weather
  weaSta_reaWeaTDryBul_y: number

  // Derived
  total_elec_kw: number
  pue: number
  cooling_load_kw: number
  heating_load_kw: number
  co2_kg_per_hr: number
  chw_flow_lph: number
}

export interface BmsControlPayload {
  point_name: string
  value: number
  activate: number
}

export type ZoneId = 'cor' | 'nor' | 'sou' | 'eas' | 'wes'

export interface ZoneComfort {
  zoneId: ZoneId
  tempC: number
  co2: number
  flowM3s: number
  status: 'comfort' | 'warm' | 'hot'
}

export interface KpiHistory {
  total_elec_kw: number[]
  cooling_load_kw: number[]
  heating_load_kw: number[]
  co2_kg_per_hr: number[]
  chw_flow_lph: number[]
  pue: number[]
}
