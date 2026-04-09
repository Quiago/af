import { useEffect, useRef } from 'react'
import { createChart, LineSeries, LineStyle, TickMarkType } from 'lightweight-charts'
import type { HistoryPoint } from '../../types/building.types'

interface ReportChartProps {
  data: HistoryPoint[]
  height?: number
}

function dedup(points: HistoryPoint[]): HistoryPoint[] {
  const seen = new Set<number>()
  return [...points]
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((p) => { if (seen.has(p.timestamp)) return false; seen.add(p.timestamp); return true })
}

export function ReportChart({ data, height = 220 }: ReportChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef    = useRef<{
    fanPower: ReturnType<typeof createChart>['addSeries'] extends (t: infer _, o: infer __) => infer R ? R : never
    coreTemp: ReturnType<typeof createChart>['addSeries'] extends (t: infer _, o: infer __) => infer R ? R : never
    co2:      ReturnType<typeof createChart>['addSeries'] extends (t: infer _, o: infer __) => infer R ? R : never
  } | null>(null)

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6B7E96',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: 'rgba(0,200,150,0.4)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(0,200,150,0.4)', width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number, tickMarkType: TickMarkType, locale: string) => {
          const d = new Date(time * 1000)
          if (tickMarkType === TickMarkType.Year)       return d.toLocaleDateString(locale, { year: 'numeric' })
          if (tickMarkType === TickMarkType.Month)      return d.toLocaleDateString(locale, { month: 'short' })
          if (tickMarkType === TickMarkType.DayOfMonth) return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
          return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        },
      },
      localization: {
        timeFormatter: (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      leftPriceScale:  { visible: true,  borderColor: 'rgba(255,255,255,0.06)' },
      rightPriceScale: { visible: true,  borderColor: 'rgba(255,255,255,0.06)' },
    })

    const fanPower = chart.addSeries(LineSeries, {
      color: '#00C896', lineWidth: 2,
      title: 'Fan Power (W)',
      priceScaleId: 'left',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    const coreTemp = chart.addSeries(LineSeries, {
      color: '#3B82F6', lineWidth: 2,
      title: 'Core Temp (°C)',
      priceScaleId: 'right',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    const co2 = chart.addSeries(LineSeries, {
      color: '#F59E0B', lineWidth: 2,
      title: 'CO₂ (ppm)',
      priceScaleId: 'right',
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    chartRef.current  = chart
    seriesRef.current = { fanPower, coreTemp, co2 } as typeof seriesRef.current

    return () => {
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [])  // create once

  // Load data
  useEffect(() => {
    if (!data.length || !seriesRef.current) return

    const pts = dedup(data)

    seriesRef.current.fanPower.setData(
      pts.filter((p) => p.fan_power_w != null)
         .map((p) => ({ time: p.timestamp as unknown as string, value: p.fan_power_w! }))
    )
    seriesRef.current.coreTemp.setData(
      pts.filter((p) => p.core_temp_c != null)
         .map((p) => ({ time: p.timestamp as unknown as string, value: p.core_temp_c! }))
    )
    seriesRef.current.co2.setData(
      pts.filter((p) => p.core_co2_ppm != null)
         .map((p) => ({ time: p.timestamp as unknown as string, value: p.core_co2_ppm! }))
    )

    chartRef.current?.timeScale().fitContent()
  }, [data])

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />
  )
}
