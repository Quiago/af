import type { BuildingSnapshot } from '../types/building.types'
import { mockWsManager } from './mockWebSocket'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

const IS_MOCKED = import.meta.env.VITE_MOCKED_DATA === 'true'
type SnapshotListener = (snapshot: BuildingSnapshot) => void
type StatusListener = (status: ConnectionStatus) => void

const WS_BASE_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000'

// Minimum ms to show "connecting" so the status is visible in the UI
const MIN_CONNECTING_MS = 500

class WebSocketManager {
  private ws: WebSocket | null = null
  private snapshotListeners: Set<SnapshotListener> = new Set()
  private statusListeners: Set<StatusListener> = new Set()
  private reconnectDelay = 1000
  private readonly maxReconnectDelay = 30000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = false
  private _status: ConnectionStatus = 'disconnected'
  private _connectingAt = 0

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return
    this._status = status
    this.statusListeners.forEach((l) => l(status))
  }

  connect(): void {
    this.shouldReconnect = true
    this.reconnectDelay = 1000
    this._connectingAt = Date.now()
    this.setStatus('connecting')
    this._connect()
  }

  private _connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    console.debug('[WS] Connecting to', `${WS_BASE_URL}/ws`)

    let ws: WebSocket
    try {
      ws = new WebSocket(`${WS_BASE_URL}/ws`)
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err)
      this.setStatus('disconnected')
      if (this.shouldReconnect) this.scheduleReconnect()
      return
    }

    // Assign immediately so _connect guard works
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return   // stale socket — a newer one took over
      console.info('[WS] Connected')
      this.reconnectDelay = 1000
      const elapsed = Date.now() - this._connectingAt
      const remaining = MIN_CONNECTING_MS - elapsed
      if (remaining > 0) {
        setTimeout(() => { if (this.ws === ws) this.setStatus('connected') }, remaining)
      } else {
        this.setStatus('connected')
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return   // stale socket
      try {
        const snapshot = JSON.parse(event.data as string) as BuildingSnapshot
        console.debug('[WS] Snapshot received — timestamp:', snapshot.timestamp, 'zones:', snapshot.zones.length)
        this.snapshotListeners.forEach((l) => l(snapshot))
      } catch (err) {
        console.warn('[WS] Failed to parse message:', err)
      }
    }

    ws.onclose = (event) => {
      if (this.ws !== ws) return   // stale socket — do NOT null out the current one
      console.info(`[WS] Disconnected (code=${event.code} reason="${event.reason}")`)
      this.ws = null
      this.setStatus('disconnected')
      if (this.shouldReconnect) {
        console.debug(`[WS] Reconnecting in ${this.reconnectDelay}ms…`)
        this.setStatus('connecting')
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      if (this.ws !== ws) return   // stale socket
      console.warn('[WS] Socket error — closing to trigger reconnect')
      ws.close()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
  }

  disconnect(): void {
    console.debug('[WS] Disconnecting (shouldReconnect=false)')
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    const ws = this.ws
    this.ws = null          // null BEFORE close so the onclose handler skips
    ws?.close()
    this.setStatus('disconnected')
  }

  subscribe(listener: SnapshotListener): void {
    this.snapshotListeners.add(listener)
  }

  unsubscribe(listener: SnapshotListener): void {
    this.snapshotListeners.delete(listener)
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  get connectionStatus(): ConnectionStatus {
    return this._status
  }

  get isConnected(): boolean {
    return this._status === 'connected'
  }
}

// In mock mode, use the mock WebSocket manager so equipment data populates
// the store without requiring a live backend connection.
export const wsManager = IS_MOCKED ? mockWsManager : new WebSocketManager()
