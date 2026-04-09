import { useCallback, useEffect, useRef, useState } from 'react'
import './ZoomableSVG.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 8.0

export interface ZoomableSVGProps {
  /** Natural coordinate-space width of the SVG content */
  contentWidth: number
  /** Natural coordinate-space height of the SVG content */
  contentHeight: number
  children: React.ReactNode
  className?: string
}

export function ZoomableSVG({ contentWidth, contentHeight, children, className = '' }: ZoomableSVGProps) {
  const containerRef  = useRef<HTMLDivElement>(null)

  // View state — also kept in a ref so the non-React wheel listener can read it
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })
  const viewRef = useRef(view)
  viewRef.current = view

  // Drag state
  const isDragging   = useRef(false)
  const hasMoved     = useRef(false)
  const dragOrigin   = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // ── Fit content into container ────────────────────────────────────────
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
    const zoom = Math.min(el.clientWidth / contentWidth, el.clientHeight / contentHeight) * 0.92
    const panX = (el.clientWidth  - contentWidth  * zoom) / 2
    const panY = (el.clientHeight - contentHeight * zoom) / 2
    setView({ zoom, panX, panY })
  }, [contentWidth, contentHeight])

  // ── Auto-fit when container first becomes visible ──────────────────────
  const hasEverFit = useRef(false)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (!hasEverFit.current && el.clientWidth > 0) {
        hasEverFit.current = true
        fitView()
      }
    })
    ro.observe(el)
    // immediate attempt (panel may already be visible)
    if (el.clientWidth > 0) { hasEverFit.current = true; fitView() }
    return () => ro.disconnect()
  }, [fitView])

  // ── Wheel zoom (non-passive to allow preventDefault) ──────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const { zoom, panX, panY } = viewRef.current
      const factor  = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const rect    = el!.getBoundingClientRect()
      const mx      = e.clientX - rect.left
      const my      = e.clientY - rect.top
      const newZoom = Math.min(Math.max(zoom * factor, MIN_ZOOM), MAX_ZOOM)
      const ratio   = newZoom / zoom
      setView({
        zoom: newZoom,
        panX: mx - (mx - panX) * ratio,
        panY: my - (my - panY) * ratio,
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Drag pan ──────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    isDragging.current = true
    hasMoved.current   = false
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return
    const dx = e.clientX - dragOrigin.current.x
    const dy = e.clientY - dragOrigin.current.y
    if (!hasMoved.current && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    hasMoved.current = true
    setView((v) => ({
      ...v,
      panX: dragOrigin.current.panX + dx,
      panY: dragOrigin.current.panY + dy,
    }))
  }
  function onMouseUp() { isDragging.current = false }

  // ── Toolbar helpers ───────────────────────────────────────────────────
  function zoomStep(factor: number) {
    setView((v) => {
      const el       = containerRef.current
      const cx       = el ? el.clientWidth  / 2 : 0
      const cy       = el ? el.clientHeight / 2 : 0
      const newZoom  = Math.min(Math.max(v.zoom * factor, MIN_ZOOM), MAX_ZOOM)
      const ratio    = newZoom / v.zoom
      return { zoom: newZoom, panX: cx - (cx - v.panX) * ratio, panY: cy - (cy - v.panY) * ratio }
    })
  }

  const { zoom, panX, panY } = view

  return (
    <div
      className={`zsvg-wrap ${isDragging.current ? 'zsvg-wrap--dragging' : ''} ${className}`}
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg width="100%" height="100%" style={{ display: 'block', overflow: 'hidden' }}>
        <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
          {children}
        </g>
      </svg>

      {/* ── Zoom toolbar ──────────────────────────────────────────────── */}
      <div className="zsvg-toolbar">
        <button className="zsvg-btn" onClick={() => zoomStep(1.25)} title="Zoom in">+</button>
        <span className="zsvg-pct">{Math.round(zoom * 100)}%</span>
        <button className="zsvg-btn" onClick={() => zoomStep(0.8)} title="Zoom out">−</button>
        <button className="zsvg-btn zsvg-btn--fit" onClick={fitView} title="Fit to view">⊞</button>
      </div>
    </div>
  )
}
