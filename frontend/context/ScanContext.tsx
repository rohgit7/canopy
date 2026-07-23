'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { getDashboard, getConnection, getScan, ConnectionInfo, ScanResult } from '@/lib/api'

interface ScanContextType {

  results: ScanResult | null
  setResults: (results: ScanResult | null) => void
  scanId: string | null
  setScanId: (id: string | null) => void
  scanning: boolean
  setScanning: (scanning: boolean) => void
  connection: ConnectionInfo | null
  setConnection: (connection: ConnectionInfo | null) => void
  loaded: boolean
  refreshData: () => Promise<void>
  selectScan: (scanId: string) => Promise<void>
}

const ScanContext = createContext<ScanContextType | undefined>(undefined)

export function ScanProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ScanResult | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refreshData = useCallback(async () => {
    try {
      const [dashData, connData] = await Promise.all([
        getDashboard('me'),
        getConnection('me')
      ])
      if (dashData) {
        setResults(dashData)
        if (dashData.scan_id) {
          setScanId(dashData.scan_id)
        }
      }
      if (connData) {
        setConnection(connData)
      }
    } catch {
      // Ignore initial fetch errors if backend is starting
    } finally {
      setLoaded(true)
    }
  }, [])

  const selectScan = useCallback(async (targetScanId: string) => {
    try {
      const scanData = await getScan(targetScanId)
      if (scanData) {
        setResults(scanData)
        setScanId(targetScanId)
      }
    } catch {
      // Ignore fetch error
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
      loaded,
      refreshData,
      selectScan
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

