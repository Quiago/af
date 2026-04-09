import { Snowflake, Wind, Filter, Cpu, Calendar, BookOpen } from 'lucide-react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { EquipmentData } from '../../../../types/building.types'
import { HealthGauge } from './HealthGauge'
import { HealthBar } from './HealthBar'
import './AssetDetail.css'

const TYPE_ICON: Record<EquipmentData['type'], React.ReactNode> = {
  chiller:       <Snowflake size={20} />,
  ahu:           <Wind size={20} />,
  filter:        <Filter size={20} />,
  cooling_tower: <Cpu size={20} />,
}

const TYPE_LABEL: Record<EquipmentData['type'], string> = {
  chiller:       'Chiller Unit',
  ahu:           'Air Handling Unit',
  filter:        'Filter Bank',
  cooling_tower: 'Cooling Tower',
}

interface AssetDetailProps {
  asset: EquipmentData | null
}

function ComingSoonButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button className="action-btn action-btn--disabled" disabled>
            {icon}
            <span>{label}</span>
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="tooltip-content" sideOffset={4}>
            Coming soon
            <TooltipPrimitive.Arrow className="tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export function AssetDetail({ asset }: AssetDetailProps) {
  if (!asset) {
    return (
      <div className="asset-detail asset-detail--empty">
        <span className="asset-empty-icon">⬡</span>
        <p className="asset-empty-text">Select an asset to inspect</p>
      </div>
    )
  }

  const score   = asset.healthScore ?? 0
  const metrics = asset.healthMetrics ?? []

  return (
    <div className="asset-detail">
      {/* Header: icon + name + gauge side by side */}
      <div className="asset-detail-header">
        <div className="asset-identity">
          <div className={`asset-type-icon asset-type-icon--${asset.type}`}>
            {TYPE_ICON[asset.type]}
          </div>
          <div className="asset-identity-text">
            <span className="asset-name">{asset.name}</span>
            <span className="asset-type-label">{TYPE_LABEL[asset.type]}</span>
            {asset.zone && <span className="asset-zone">{asset.zone}</span>}
          </div>
        </div>
        <HealthGauge score={score} />
      </div>

      {/* Health bars */}
      {metrics.length > 0 && (
        <div className="asset-health-bars">
          {metrics.map((m) => (
            <HealthBar key={m.label} metric={m} />
          ))}
        </div>
      )}

      {/* Footer: service date + action buttons */}
      <div className="asset-detail-footer">
        {asset.lastServiceDate && (
          <p className="asset-service-date">
            <span className="service-date-label">Last service</span>
            <span className="service-date-value">
              {new Date(asset.lastServiceDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </p>
        )}
        <div className="asset-actions">
          <ComingSoonButton icon={<Calendar size={12} />} label="Calendar ↗" />
          <ComingSoonButton icon={<BookOpen size={12} />} label="Manual ↗" />
        </div>
      </div>
    </div>
  )
}
