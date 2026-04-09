import { create } from 'zustand'
import type { BuildingSnapshot, TimePreset, ActiveView } from '../types/building.types'
import type { ConnectionStatus } from '../lib/websocket'
import type { SimulationProjection } from '../features/digital-twin/types/simulation.types'

const MAX_HISTORY = 288 // 24h at 5-min steps

// Pre-expand all equipment zones used by the backend
const DEFAULT_EXPANDED = new Set(['Central Plant', 'Air Handling'])

interface DashboardState {
  snapshot: BuildingSnapshot | null
  history: BuildingSnapshot[]
  selectedZoneId: string | null
  timePreset: TimePreset
  connectionStatus: ConnectionStatus

  // Asset tree
  selectedAssetId: string | null
  expandedZones: Set<string>

  // Navigation
  activeView: ActiveView
  selectedFloor: number

  // Simulation preview
  simulationProjection: SimulationProjection | null
  appliedRecIds: Set<string>

  setSnapshot: (snapshot: BuildingSnapshot) => void
  appendToHistory: (snapshot: BuildingSnapshot) => void
  selectZone: (zoneId: string | null) => void
  setTimePreset: (preset: TimePreset) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setSelectedAsset: (id: string | null) => void
  toggleZone: (zoneId: string) => void
  setActiveView: (view: ActiveView) => void
  setSelectedFloor: (floor: number) => void
  setSimulationProjection: (p: SimulationProjection | null) => void
  applyRecommendation: (id: string) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  snapshot: null,
  history: [],
  selectedZoneId: null,
  timePreset: '1h',
  connectionStatus: 'disconnected',
  selectedAssetId: null,
  expandedZones: DEFAULT_EXPANDED,
  activeView: 'dash',
  selectedFloor: 1,
  simulationProjection: null,
  appliedRecIds: new Set<string>(),

  setSnapshot: (snapshot) =>
    set((state) => {
      const last = state.history[state.history.length - 1]
      if (last && last.timestamp === snapshot.timestamp) {
        return { snapshot }
      }
      const newHistory = [...state.history, snapshot]
      if (newHistory.length > MAX_HISTORY) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY)
      }
      return { snapshot, history: newHistory }
    }),

  appendToHistory: (snapshot) =>
    set((state) => {
      const newHistory = [...state.history, snapshot]
      if (newHistory.length > MAX_HISTORY) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY)
      }
      return { history: newHistory }
    }),

  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),

  setTimePreset: (preset) => set({ timePreset: preset }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setSelectedAsset: (id) => set({ selectedAssetId: id }),

  toggleZone: (zoneId) =>
    set((state) => {
      const next = new Set(state.expandedZones)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return { expandedZones: next }
    }),

  setActiveView: (view) => set({ activeView: view }),

  setSelectedFloor: (floor) => set({ selectedFloor: floor }),

  setSimulationProjection: (p) => set({ simulationProjection: p }),

  applyRecommendation: (id) =>
    set((state) => ({
      appliedRecIds: new Set([...state.appliedRecIds, id]),
      simulationProjection: null,
    })),
}))
