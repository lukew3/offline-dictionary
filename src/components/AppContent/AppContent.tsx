import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom'
import initSqlJs from 'sql.js'
import SearchHistory from '../../pages/SearchHistory/SearchHistory'
import Bookmarks from '../../pages/Bookmarks/Bookmarks'
import Study from '../../pages/Study/Study'
import BottomNavbar from '../../components/BottomNavbar/BottomNavbar'
import Settings from '../../pages/Settings/Settings'
import QueryResults from '../../pages/QueryResults/QueryResults'
import SearchBar from '../../components/SearchBar/SearchBar'

import { Definition, Database, SearchHistoryItem, HistoryCategory } from '../../interfaces'
import { useAtom } from 'jotai'
import { historyAtom, databasesAtom, activeDatabaseAtom } from '../../atoms'
import { isDatabaseCached } from '../../cacheUtils'


const AppContent = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [history, setHistory] = useAtom(historyAtom)
  const [databases, setDatabases] = useAtom(databasesAtom)
  const [activeDatabase, setActiveDatabase] = useAtom(activeDatabaseAtom)
  
  
  const [error, setError] = useState<string>('')
  const [info, setInfo] = useState<string>('')
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [wordTitle, setWordTitle] = useState<string>('')
  const [db, setDb] = useState<Database | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [progress, setProgress] = useState<number>(0)

  const activeTab = window.location.pathname.slice(1) || 'history'

  // Reconcile metadata with actual cache state on startup
  useEffect(() => {
    const syncCacheState = async () => {
      const updatedDatabases = await Promise.all(
        databases.map(async (dbInfo) => {
          const cached = await isDatabaseCached(dbInfo.filename)
          if (dbInfo.downloaded && !cached) {
            return { ...dbInfo, downloaded: false, enabled: false, lastUpdated: undefined }
          }
          if (!dbInfo.downloaded && cached) {
            return { ...dbInfo, downloaded: true, enabled: true, lastUpdated: new Date().toISOString() }
          }
          return dbInfo
        })
      )
      const changed = updatedDatabases.some((dbInfo, i) => dbInfo !== databases[i])
      if (changed) {
        setDatabases(updatedDatabases)
      }
    }
    syncCacheState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadDatabase()
  }, [])

  // Sync database state when it loads successfully
  useEffect(() => {
    if (db && !isLoading) {
      // Mark wordnetFull.db as downloaded if database is loaded
      const wordnetDb = databases.find(db => db.filename === 'wordnetFull.db')
      if (wordnetDb && !wordnetDb.downloaded) {
        const updatedDatabases = databases.map(db => 
          db.filename === 'wordnetFull.db' 
            ? { ...db, downloaded: true, enabled: true, lastUpdated: new Date().toISOString() }
            : db
        )
        setDatabases(updatedDatabases)
        
        // Set as active database if not already set
        if (!activeDatabase) {
          setActiveDatabase('wordnet-full')
        }
      }
    }
  }, [db, isLoading, databases, activeDatabase])

  

  // Handle legacy query parameter - redirect to word route if needed
  useEffect(() => {
    const wordParam = searchParams.get('word')
    if (wordParam && !isLoading && !window.location.pathname.startsWith('/word/')) {
      navigate(`/word/${wordParam}`)
    }
  }, [searchParams, isLoading, navigate])

  const loadDatabase = async (): Promise<void> => {
    try {
      setIsLoading(true)
      setProgress(0)

      const SQL = await initSqlJs({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      })

      setProgress(10)

      const res = await fetch('wordnetFull.db')
      if (!res.ok) throw new Error('Failed to fetch wordnet.db: ' + res.status)

      const contentLength = res.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      let loaded = 0

      const reader = res.body!.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        loaded += value.length
        const percent = total > 0 ? Math.min((loaded / total) * 60 + 20, 80) : Math.min(loaded / 1000000 * 10 + 20, 80)
        setProgress(percent)
      }

      const buffer = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        buffer.set(chunk, offset)
        offset += chunk.length
      }

      setProgress(90)

      const database = new SQL.Database(buffer as any)
      setDb(database as unknown as Database)
      
      setProgress(100)
      setIsLoading(false)
    } catch (e) {
      setError('Error loading database')
      setIsLoading(false)
      console.error(e)
    }
  }

  const handleNavItemClick = (item: string): void => {
    // Clear search state when switching tabs
    setDefinitions([])
    setWordTitle('')
    setInfo('')
    setError('')
    
    // Navigate to the new route and clear word search param
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('word')
    setSearchParams(newParams)
    
    navigate(`/${item}`)
  }

  const escapeHtml = (str: string | null | undefined): string => {
    if (str === null || str === undefined) return ''
    return String(str)
  }

  const handleWordClick = (word: string, source?: string) => {
    // Determine category based on source
    let category: HistoryCategory = 'link'
    if (source === 'history') {
      category = 'history-click'
    }
    
    // Add to history with appropriate category when clicking from history/bookmarks/study
    const newHistoryItem: SearchHistoryItem = {
      word,
      timestamp: new Date().toISOString(),
      category
    }
    const newHistory = [newHistoryItem, ...history]
    setHistory(newHistory)
    
    // Navigate to word route with category parameter to prevent duplicate history creation
    const url = `/word/${encodeURIComponent(word)}`
    if (source === 'history') {
      navigate(`${url}?skipHistory=true`)
    } else {
      navigate(url)
    }
  }

  return (
    <div className="container">
      <nav>
        <div className="nav-content">
          <a
            href="https://github.com/lukew3/aard2-web-offline"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            aria-label="View on GitHub"
          >
            <i className="fab fa-github"></i>
          </a>
          <h1 id="navTitle" onClick={() => handleNavItemClick('history')} style={{cursor: 'pointer'}}>Word Collector</h1>
          <button
            className="settings-icon"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </nav>

      <SearchBar
        db={db}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="progress-container">
          <div className="progress-text">Loading database ({Math.round(progress)}%)</div>
        </div>
      )}

      <div id="info">{info}</div>
      <div id="error" role="alert" aria-live="assertive">{error}</div>

      <Routes>
        <Route path="/" element={<SearchHistory onWordClick={handleWordClick} />} />
        <Route path="/history" element={<SearchHistory onWordClick={handleWordClick} />} />
        <Route path="/bookmarks" element={<Bookmarks onWordClick={handleWordClick} />} />
        <Route path="/study" element={<Study db={db} />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/word/:word" element={
          <QueryResults
            escapeHtml={escapeHtml}
            definitions={definitions}
            wordTitle={wordTitle}
            db={db}
            setError={setError}
            setInfo={setInfo}
            setDefinitions={setDefinitions}
            setWordTitle={setWordTitle}
          />
        } />
      </Routes>

      <BottomNavbar activeTab={activeTab} onNavItemClick={handleNavItemClick} />
    </div>
  )
}

export default AppContent