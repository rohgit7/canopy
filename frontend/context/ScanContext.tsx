'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface ScanResult {
  scan_id: string
  status: string
  resource_count?: number
  node_count?: number
  edge_count?: number
  score?: number
  attack_paths?: any[]
  graph_data?: any
  completed_at?: string
}

interface ScanContextType {
  results: ScanResult | null
  setResults: (results: ScanResult | null) => void
  scanId: string | null
  setScanId: (id: string | null) => void
  scanning: boolean
  setScanning: (scanning: boolean) => void
}

const ScanContext = createContext<ScanContextType | undefined>(undefined)

export function ScanProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ScanResult | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  return (
    <ScanContext.Provider value={{ results, setResults, scanId, setScanId, scanning, setScanning }}>
      {children}
    </ScanContext.Provider>
  )
}

export function useScan() {
  const context = useContext(ScanContext)
  if (!context) {
    throw new Error('useScan must be used within ScanProvider')
  }
  return context
}
