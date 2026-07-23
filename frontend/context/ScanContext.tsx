'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { getDashboard, getConnection, ConnectionInfo, ScanResult } from '@/lib/api'

interface ScanContextType {
  results: ScanResult | null
  setResults: (results: ScanResult | null) => void
  scanId: string | null
  setScanId: (id: string | null) => void
  scanning: boolean
  setScanning: (scanning: boolean) => void
  connection: ConnectionInfo | null
  setConnection: (connection: ConnectionInfo | null) => void
  refreshData: () => Promise<void>
}

const ScanContext = createContext<ScanContextType | undefined>(undefined)

export function ScanProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ScanResult | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)

  const refreshData = useCallback(async () => {
    try {
      const [dashData, connData] = await Promise.all([
        getDashboard('me'),
        getConnection('me')
      ])
      if (dashData && dashData.status !== 'no_scan') {
        setResults(dashData)
      }
      if (connData) {
        setConnection(connData)
      }
    } catch {
      // Ignore initial fetch errors if backend is starting
    }
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  return (
    <ScanContext.Provider value={{
      results, setResults,
      scanId, setScanId,
      scanning, setScanning,
      connection, setConnection,
      refreshData
    }}>
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

