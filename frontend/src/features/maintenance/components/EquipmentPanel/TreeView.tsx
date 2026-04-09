import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Snowflake, Wind, Filter, Cpu } from 'lucide-react'
import { useDashboardStore } from '../../../../store/dashboardStore'
import { useEquipmentData } from '../../hooks/useEquipmentData'
import { StatusDot } from '../../../../components/atoms/StatusDot'
import type { EnrichedEquipment } from '../../hooks/useEquipmentData'
import type { EquipmentData } from '../../../../types/building.types'
import './TreeView.css'

const TYPE_ICON: Record<EquipmentData['type'], React.ReactNode> = {
  chiller:       <Snowflake size={13} />,
  ahu:           <Wind size={13} />,
  filter:        <Filter size={13} />,
  cooling_tower: <Cpu size={13} />,
}

function alertCount(items: EnrichedEquipment[]): number {
  return items.filter((e) => e.status === 'warning' || e.status === 'critical').length
}

export function TreeView() {
  const equipment    = useEquipmentData()
  const selectedId   = useDashboardStore((s) => s.selectedAssetId)
  const expandedZones = useDashboardStore((s) => s.expandedZones)
  const setSelected  = useDashboardStore((s) => s.setSelectedAsset)
  const toggleZone   = useDashboardStore((s) => s.toggleZone)

  // Group equipment by zone
  const zones = useMemo(() => {
    const map = new Map<string, EnrichedEquipment[]>()
    equipment.forEach((eq) => {
      const zone = eq.zone ?? 'Unknown'
      if (!map.has(zone)) map.set(zone, [])
      map.get(zone)!.push(eq)
    })
    return map
  }, [equipment])

  return (
    <div className="tree-view" role="tree" aria-label="Equipment asset tree">
      <div className="tree-view-header">
        <span className="panel-title">Asset Tree</span>
        <span className="tree-asset-count">{equipment.length} assets</span>
      </div>

      <div className="tree-scroll">
        {/* Building root node */}
        <div className="tree-root-node" role="treeitem" aria-level={1}>
          <span className="tree-root-icon">🏢</span>
          <span className="tree-root-label">Building</span>
        </div>

        {Array.from(zones.entries()).map(([zoneName, assets]) => {
          const isExpanded = expandedZones.has(zoneName)
          const alerts     = alertCount(assets)
          const zoneTestId = `tree-zone-${zoneName.toLowerCase().replace(/\s+/g, '-')}`

          return (
            <div key={zoneName} className="tree-zone" role="treeitem" aria-level={2} aria-expanded={isExpanded}>
              {/* Zone header */}
              <button
                className="tree-zone-header"
                data-testid={zoneTestId}
                aria-expanded={isExpanded}
                aria-label={`${zoneName}${alerts > 0 ? `, ${alerts} alert${alerts > 1 ? 's' : ''}` : ''}`}
                onClick={() => toggleZone(zoneName)}
              >
                <span className="tree-zone-chevron">
                  {isExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />
                  }
                </span>
                <span className="tree-zone-name">{zoneName}</span>
                {alerts > 0 && (
                  <span className="tree-alert-badge">
                    {alerts} alert{alerts > 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {/* Assets inside zone */}
              {isExpanded && (
                <div className="tree-asset-list" role="group">
                  {assets.map((eq) => (
                    <button
                      key={eq.id}
                      data-testid={`tree-asset-${eq.id}`}
                      aria-label={`${eq.name}, ${eq.displayMetric}, status ${eq.status}`}
                      aria-selected={selectedId === eq.id}
                      aria-level={3}
                      className={`tree-asset-row ${selectedId === eq.id ? 'tree-asset-row--selected' : ''}`}
                      onClick={() => setSelected(selectedId === eq.id ? null : eq.id)}
                    >
                      <span className={`tree-asset-icon tree-asset-icon--${eq.type}`}>
                        {TYPE_ICON[eq.type]}
                      </span>
                      <span className="tree-asset-name">{eq.name}</span>
                      <span className="tree-asset-metric">{eq.displayMetric}</span>
                      <StatusDot status={eq.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
