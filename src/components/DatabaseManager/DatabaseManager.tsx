import React, { useState } from 'react'
import { useAtom } from 'jotai'
import { databasesAtom, downloadProgressAtom } from '../../atoms'
import { dictClient } from '../../db/dictClient'

import './DatabaseManager.css'

const DatabaseManager: React.FC = () => {
  const [databases, setDatabases] = useAtom(databasesAtom)
  const [downloadProgress] = useAtom(downloadProgressAtom)

  const [deletingDb, setDeletingDb] = useState<string | null>(null)

  const downloadedDatabases = databases.filter(db => db.downloaded)

  const handleDeleteDatabase = async (databaseId: string) => {
    const database = databases.find(db => db.id === databaseId)
    if (!database) return

    setDeletingDb(databaseId)
    try {
      await dictClient.wipe()

      const updatedDatabases = databases.map(db =>
        db.id === databaseId
          ? { ...db, downloaded: false, enabled: false, lastUpdated: undefined }
          : db
      )
      setDatabases(updatedDatabases)
      // Reload so the worker re-runs install on a fresh state.
      window.location.reload()
    } catch (error) {
      console.error('Error deleting database:', error)
    } finally {
      setDeletingDb(null)
    }
  }

  const getProgressPercentage = (databaseId: string): number => {
    const progress = downloadProgress[databaseId]
    if (!progress || progress.total === 0) return 0
    return Math.round((progress.loaded / progress.total) * 100)
  }

  if (downloadedDatabases.length === 0) {
    return (
      <div className="database-manager">
        <h3><i className="fas fa-database"></i> Downloaded Databases</h3>
        <p className="no-databases">No databases downloaded yet. Use the selector above to download a database.</p>
      </div>
    )
  }

  return (
    <div className="database-manager">
      <h3><i className="fas fa-database"></i> Downloaded Databases</h3>
      <div className="database-list">
        {downloadedDatabases.map(database => (
          <div key={database.id} className="database-item">
            <div className="database-info">
              <div className="database-name">{database.name}</div>
              <div className="database-details">
                <span className="database-size">{database.size}</span>
                {database.lastUpdated && (
                  <span className="database-updated">
                    Updated: {new Date(database.lastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="database-controls">
              <button
                className="delete-btn"
                onClick={() => handleDeleteDatabase(database.id)}
                disabled={deletingDb === database.id}
                title="Delete database"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>

            {downloadProgress[database.id] && getProgressPercentage(database.id) < 100 && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${getProgressPercentage(database.id)}%` }}
                />
                <span className="progress-text">{getProgressPercentage(database.id)}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DatabaseManager
