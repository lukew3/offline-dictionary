import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom'
import SearchHistory from '../../pages/SearchHistory/SearchHistory'
import Bookmarks from '../../pages/Bookmarks/Bookmarks'
import Study from '../../pages/Study/Study'
import BottomNavbar from '../../components/BottomNavbar/BottomNavbar'
import Settings from '../../pages/Settings/Settings'
import QueryResults from '../../pages/QueryResults/QueryResults'
import SearchBar from '../../components/SearchBar/SearchBar'

import { Definition, SearchHistoryItem, HistoryCategory } from '../../interfaces'
import { useAtom } from 'jotai'
import { historyAtom, databasesAtom, activeDatabaseAtom } from '../../atoms'
import { dictClient, InstallState } from '../../db/dictClient'


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
  const [installState, setInstallState] = useState<InstallState>(() => dictClient.installState())

  const isReady = installState.state === 'done'
  const activeTab = window.location.pathname.slice(1) || 'history'

  useEffect(() => {
    dictClient.start()
    const unsubscribe = dictClient.onProgress(setInstallState)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!isReady) return
    const wordnetDb = databases.find(db => db.filename === 'wordnet.ndjson')
    if (wordnetDb && !wordnetDb.downloaded) {
      const updatedDatabases = databases.map(db =>
        db.filename === 'wordnet.ndjson'
          ? { ...db, downloaded: true, enabled: true, lastUpdated: new Date().toISOString() }
          : db
      )
      setDatabases(updatedDatabases)
      if (!activeDatabase) {
        setActiveDatabase('wordnet-full')
      }
    }
  }, [isReady, databases, activeDatabase])

  useEffect(() => {
    const wordParam = searchParams.get('word')
    if (wordParam && isReady && !window.location.pathname.startsWith('/word/')) {
      navigate(`/word/${wordParam}`)
    }
  }, [searchParams, isReady, navigate])

  const handleNavItemClick = (item: string): void => {
    setDefinitions([])
    setWordTitle('')
    setInfo('')
    setError('')

    const newParams = new URLSearchParams(searchParams)
    newParams.delete('word')
    setSearchParams(newParams)

    navigate(`/${item}`)
  }

  const escapeHtml = (str: string | null | undefined): string => {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;')
  }

  const handleWordClick = (word: string, source?: string) => {
    let category: HistoryCategory = 'link'
    if (source === 'history') {
      category = 'history-click'
    }

    const newHistoryItem: SearchHistoryItem = {
      word,
      timestamp: new Date().toISOString(),
      category
    }
    const newHistory = [newHistoryItem, ...history]
    setHistory(newHistory)

    const url = `/word/${encodeURIComponent(word)}`
    if (source === 'history') {
      navigate(`${url}?skipHistory=true`)
    } else {
      navigate(url)
    }
  }

  const installPercent = installState.total > 0
    ? Math.round((installState.loaded / installState.total) * 100)
    : 0

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

      <SearchBar isReady={isReady} />

      {!isReady && installState.state !== 'error' && (
        <div className="progress-container">
          <div className="progress-text">
            {installState.state === 'pending'
              ? 'Preparing dictionary…'
              : `Installing dictionary (${installPercent}%) — ${installState.loaded.toLocaleString()} / ${installState.total.toLocaleString()} words`}
          </div>
        </div>
      )}

      {installState.state === 'error' && (
        <div className="progress-container">
          <div className="progress-text">Install failed: {installState.error}</div>
        </div>
      )}

      <div id="info">{info}</div>
      <div id="error" role="alert" aria-live="assertive">{error}</div>

      <Routes>
        <Route path="/" element={<SearchHistory onWordClick={handleWordClick} />} />
        <Route path="/history" element={<SearchHistory onWordClick={handleWordClick} />} />
        <Route path="/bookmarks" element={<Bookmarks onWordClick={handleWordClick} />} />
        <Route path="/study" element={<Study />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/word/:word" element={
          <QueryResults
            escapeHtml={escapeHtml}
            definitions={definitions}
            wordTitle={wordTitle}
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
