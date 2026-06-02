import { create } from 'zustand'
import type { BuildingSnapshot, TimePreset, ActiveView } from '../types/building.types'
import type { ConnectionStatus } from '../lib/websocket'
import type { SimulationProjection, CfdCinematic, SimZoneId } from '../features/digital-twin/types/simulation.types'

const MAX_HISTORY = 288 // 24h at 5-min steps

// Flythrough order for the CFD cinematic — primary zone first, then the rest.
const ALL_ZONES: SimZoneId[] = ['cor', 'nor', 'eas', 'sou', 'wes']

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

  // CFD cinematic — set on apply, played once by the 3D scene, then cleared
  cfdCinematic: CfdCinematic | null

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
  applyRecommendation: (id: string, primaryZoneId?: SimZoneId, kpiDeltas?: { energy: number; comfort: number; co2: number }) => void
  endCfd: () => void
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
  cfdCinematic: null,

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

  applyRecommendation: (id, primaryZoneId, kpiDeltas) =>
    set((state) => {
      const floor = state.selectedFloor
      const cfd: CfdCinematic | null = primaryZoneId
        ? {
            jobId:         `${id}-${Date.now()}`,
            floor,
            primaryZoneId,
            zoneIds:       [primaryZoneId, ...ALL_ZONES.filter((z) => z !== primaryZoneId)],
            kpiDeltas:     kpiDeltas ?? { energy: 0, comfort: 0, co2: 0 },
          }
        : state.cfdCinematic
      return {
        appliedRecIds:        new Set([...state.appliedRecIds, id]),
        simulationProjection: null,
        cfdCinematic:         cfd,
      }
    }),

  endCfd: () => set({ cfdCinematic: null }),
}))
