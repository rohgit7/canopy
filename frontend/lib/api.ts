const DEFAULT_API_BASE = 'http://127.0.0.1:8000'

function normalizeBase(base: string | undefined): string {
  const value = (base ?? '').trim()
  if (!value) return DEFAULT_API_BASE
  return value.replace(/\/+$/, '')
}

export function buildApiUrl(path: string): string {
  if (!path) return normalizeBase(process.env.NEXT_PUBLIC_API_URL)
  if (/^https?:\/\//i.test(path)) return path

  const base = normalizeBase(process.env.NEXT_PUBLIC_API_URL)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  try {
    return new URL(normalizedPath, `${base}/`).toString()
  } catch {
    return `${base}${normalizedPath}`
  }
}

const cache = new Map<string, { data: any; timestamp: number }>()
const inFlight = new Map<string, Promise<any>>()

export function clearApiCache() {
  cache.clear()
  inFlight.clear()
}

export async function requestJson<T = any>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 2500
): Promise<T | null> {
  const method = (init.method || 'GET').toUpperCase()
  const url = buildApiUrl(path)
  const isGet = method === 'GET'

  if (isGet) {
    const cached = cache.get(url)
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data as T
    }
    if (inFlight.has(url)) {
      return inFlight.get(url) as Promise<T | null>
    }
  }

  const fetchPromise = (async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Request failed with ${response.status}`)
      }
      const data = (await response.json()) as T
      if (isGet && data !== null) {
        cache.set(url, { data, timestamp: Date.now() })
      }
      return data
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.warn(`Request to ${url} timed out after ${timeoutMs}ms`)
        return null
      }
      console.warn(`Request to ${url} failed`, error)
      return null
    } finally {
      clearTimeout(timeoutId)
      if (isGet) {
        inFlight.delete(url)
      }
    }
  })()

  if (isGet) {
    inFlight.set(url, fetchPromise)
  }

  return fetchPromise
}

export interface ScanResult {
  scan_id: string
  status: 'running' | 'complete' | 'failed' | 'no_scan' | string
  resource_count?: number
  node_count?: number
  edge_count?: number
  score?: number
  attack_paths?: any[]
  graph_data?: { nodes?: any[]; links?: any[] }
  started_at?: string
  completed_at?: string
  error?: string
}

const customerPath = (customerId: string) => encodeURIComponent(customerId)

export function getDashboard(customerId: string) {
  return requestJson<ScanResult>(`/dashboard/${customerPath(customerId)}`)
}

export function getScanHistory(customerId: string) {
  return requestJson<ScanResult[]>(`/scans/${customerPath(customerId)}`)
}

export function getScan(scanId: string) {
  return requestJson<ScanResult>(`/scan/${encodeURIComponent(scanId)}`)
}

export function deleteScan(scanId: string) {
  return requestJson<{ status: string; scan_id: string }>(
    `/scan/${encodeURIComponent(scanId)}`,
    { method: 'DELETE' },
    5000
  )
}

export interface ConnectionInfo {
  status?: string
  account_id?: string
  role_arn?: string
  connected_at?: string
}

export function getConnection(customerId: string) {
  return requestJson<ConnectionInfo>(`/connection/${customerPath(customerId)}`)
}
