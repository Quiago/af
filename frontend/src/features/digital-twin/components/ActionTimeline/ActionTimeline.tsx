import { useState } from 'react'
import { useDashboardStore } from '../../../../store/dashboardStore'
import styles from './ActionTimeline.module.css'

interface TimelineNode {
  id: string
  shortLabel: string
  description: string
  impact: string
  author: string
  type: 'historical' | 'simulated' | 'base'
}

// Pre-defined mock states to demonstrate the timeline feature
const MOCK_NODES: TimelineNode[] = [
  {
    id: 'c0b8f1a',
    shortLabel: 'System Baseline',
    description: 'Initial building state loaded from BMS history before AI autonomous operations started.',
    impact: 'Base parameters',
    author: 'Auto-snapshot · 06:00',
    type: 'base'
  },
  {
    id: 'a73d9e2',
    shortLabel: 'Morning pull-down rescheduled',
    description: 'MPC shifted the guestroom-block pull-down 40 min later using the temperature forecast — zones still reached setpoint before occupancy, with less morning-ramp cooling.',
    impact: '↓ 210 kWh/day',
    author: 'Applied · 08:30',
    type: 'historical'
  },
  {
    id: 'f92ca1b',
    shortLabel: 'Overcooling corrected — Core',
    description: 'MPC raised the core cooling setpoint 1.5°C after the comfort model confirmed PMV stayed within band — removed sustained overcooling.',
    impact: '↓ 120 kWh/day',
    author: 'Applied · 10:15',
    type: 'historical'
  },
  {
    id: 'sim-1',
    shortLabel: 'Night setback — F&B Lounge',
    description: 'Occupancy forecast shows the lounge empty after 23:00. MPC applies a 2.5°C night setback on the cooling setpoint until a scheduled morning pull-down before opening.',
    impact: '↓ 33 kWh/day · AED 3,860/yr',
    author: 'Pending Simulation',
    type: 'simulated'
  }
]

export function ActionTimeline() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  
  // We use this local state to simply truncate the visual line if they "rollback"
  const [nodes, setNodes] = useState<TimelineNode[]>(MOCK_NODES)
  
  const simulationProjection = useDashboardStore((s) => s.simulationProjection)
  const setSimulationProjection = useDashboardStore((s) => s.setSimulationProjection)

  function handleNodeClick(id: string) {
    if (selectedNodeId === id) {
      setSelectedNodeId(null) // toggle off
    } else {
      setSelectedNodeId(id)
    }
  }

  function handleRollback(nodeId: string) {
    // Determine the index of the node we are rolling back from.
    // If we rollback a specific node, we typically revert to the state *before* it.
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx > 0) {
      // slice the array to practically "revert" visually
      setNodes(nodes.slice(0, idx))
    }

    // Always clear the simulation if we are rolling things back, 
    // to cleanly reset the UI into a live state.
    if (simulationProjection) {
      setSimulationProjection(null)
    }

    // Close popup
    setSelectedNodeId(null)
  }

  // Calculate widths for the connecting line
  const totalNodes = nodes.length
  // Active means it covers all valid historical nodes.
  const activeCount = nodes.filter(n => n.type === 'historical' || n.type === 'base').length
  const activeLineWidth = totalNodes > 1 ? ((activeCount - 1) / (totalNodes - 1)) * 100 : 0

  return (
    <div className={styles.container}>
      <div className={styles.timeline}>
        
        {/* Background track line */}
        <div className={styles.line} />
        
        {/* Active track line representing firm commits */}
        <div 
          className={styles.lineActive} 
          style={{ width: `${activeLineWidth}%` }} 
        />

        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id
          
          let nodeClass = styles.node
          if (node.type === 'historical' || node.type === 'base') nodeClass += ` ${styles.nodeActive}`
          if (node.type === 'simulated') nodeClass += ` ${styles.nodeSimulated}`

          return (
            <div key={node.id} className={styles.nodeWrapper}>
              
              {/* Point on the timeline */}
              <button 
                className={nodeClass}
                onClick={() => handleNodeClick(node.id)}
                aria-label={`View commit: ${node.shortLabel}`}
              />

              {/* Hover Tooltip (Git Commit style message) */}
              {/* Hidden via CSS when not hovered, UNLESS it's selected */}
              {!isSelected && (
                <div className={styles.tooltip}>
                  {node.shortLabel}
                </div>
              )}

              {/* Detailed floating popup */}
              {isSelected && (
                <div className={styles.popup}>
                  <div className={styles.popupHeader}>
                    <span>{node.type === 'simulated' ? 'SIMULATION' : 'COMMIT'}</span>
                    <span className={styles.popupId}>{node.id}</span>
                  </div>
                  
                  <div className={styles.popupDesc}>
                    <strong>{node.shortLabel}</strong><br/>
                    {node.description}
                  </div>
                  
                  <div className={styles.popupImpact}>
                    {node.impact}
                  </div>
                  
                  <div className={styles.popupAuthor}>
                    {node.author}
                  </div>

                  {/* Rollback arrow button */}
                  {node.type !== 'base' && (
                    <button 
                      className={styles.rollbackBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRollback(node.id)
                      }}
                    >
                      ↶ Rollback State
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
