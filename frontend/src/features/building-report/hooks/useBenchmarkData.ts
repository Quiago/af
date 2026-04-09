import { useQuery } from '@tanstack/react-query'
import type { BenchmarkResult } from '../../../types/building.types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function fetchBenchmark(): Promise<BenchmarkResult | null> {
  const res = await fetch(`${API_BASE}/api/v1/benchmark/latest`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Benchmark fetch failed: ${res.status}`)
  return res.json() as Promise<BenchmarkResult>
}

export function useBenchmarkData() {
  return useQuery<BenchmarkResult | null>({
    queryKey: ['benchmark'],
    queryFn: fetchBenchmark,
    // Poll every 10 s while running; slow down to 60 s once complete
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') return 60_000
      return 10_000
    },
    staleTime: 5_000,
    retry: false,
  })
}
