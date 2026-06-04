import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { databasesAtom, downloadProgressAtom } from '../../atoms'
import './DatabaseSelector.css'

const DatabaseSelector: React.FC = () => {
  const [databases, setDatabases] = useAtom(databasesAtom)
  const [downloadProgress] = useAtom(downloadProgressAtom)
  const [selectedDatabase, setSelectedDatabase] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const availableDatabases = useMemo(() => {
    return databases.filter(db => !db.downloaded)
  }, [databases])

  const filteredDatabases = useMemo(() => {
    return availableDatabases.filter(db => 
      db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      db.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [availableDatabases, searchTerm])

  const handleDownload = async () => {
    if (!selectedDatabase) return

    const database = databases.find(db => db.id === selectedDatabase)
    if (!database) return

    // The dictionary now auto-installs on first app load via the dict worker.
    // This UI is preserved as a status surface; clicking "download" simply
    // marks the entry as downloaded once install has finished.
    setIsDownloading(true)
    try {
      const updatedDatabases = databases.map(db =>
        db.id === selectedDatabase
          ? {
              ...db,
              downloaded: true,
              enabled: true,
              lastUpdated: new Date().toISOString()
            }
          : db
      )
      setDatabases(updatedDatabases)
      setSelectedDatabase('')
      setSearchTerm('')
      setShowDropdown(false)
    } finally {
      setIsDownloading(false)
    }
  }

  const getProgressPercentage = (databaseId: string): number => {
    const progress = downloadProgress[databaseId]
    if (!progress || progress.total === 0) return 0
    return Math.round((progress.loaded / progress.total) * 100)
  }

  if (availableDatabases.length === 0) {
    return (
      <div className="database-selector">
        <h3>Download New Databases</h3>
        <p className="all-downloaded">All available databases have been downloaded.</p>
      </div>
    )
  }

  return (
    <div className="database-selector">
      <h3>Download New Databases</h3>
      <div className="download-controls">
        <div className="dropdown-container">
          <div className="search-wrapper" ref={dropdownRef}>
            <input
              type="text"
              placeholder="Search databases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onClick={() => setShowDropdown(!showDropdown)}
              className="database-search"
            />
            {showDropdown && filteredDatabases.length > 0 && (
              <div className="dropdown-menu">
                {filteredDatabases.map(database => (
                  <div
                    key={database.id}
                    className={`dropdown-item ${selectedDatabase === database.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDatabase(database.id)
                      setSearchTerm(database.name)
                      setShowDropdown(false)
                    }}
                  >
                    <div className="database-option">
                      <div className="database-option-name">{database.name}</div>
                      <div className="database-option-details">
                        <span className="database-option-size">{database.size}</span>
                        <span className="database-option-description">{database.description}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={!selectedDatabase || isDownloading}
        >
          <i className="fas fa-download"></i>
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>
      </div>

      {selectedDatabase && downloadProgress[selectedDatabase] && getProgressPercentage(selectedDatabase) < 100 && (
        <div className="download-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${getProgressPercentage(selectedDatabase)}%` }}
            />
          </div>
          <span className="progress-text">
            {getProgressPercentage(selectedDatabase)}% - {Math.round(downloadProgress[selectedDatabase].loaded / 1024 / 1024)}MB / {Math.round(downloadProgress[selectedDatabase].total / 1024 / 1024)}MB
          </span>
        </div>
      )}
    </div>
  )
}

export default DatabaseSelector