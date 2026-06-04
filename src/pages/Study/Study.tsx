import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import './Study.css'
import { useAtom } from 'jotai'
import { historyAtom } from '../../atoms'
import { Definition, SearchHistoryItem } from '../../interfaces'
import { getDefinitionsForWords, getRandomWords, formatWordForDisplay } from '../../utils'

const Study: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [history, setHistory] = useAtom(historyAtom)
  const [showWordFirst, setShowWordFirst] = useState(() =>
    searchParams.get('showWordFirst') === 'true' ? true : searchParams.get('showWordFirst') === 'false' ? false : true
  )
  const [useHistory, setUseHistory] = useState(() =>
    searchParams.get('useHistory') === 'true' ? true : searchParams.get('useHistory') === 'false' ? false : true
  )
  const [currentCard, setCurrentCard] = useState<Definition | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [allWords, setAllWords] = useState<Definition[]>([])
  const [historyDefinitions, setHistoryDefinitions] = useState<Record<string, Definition[]>>({})
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsInitializing(true)

    ;(async () => {
      const initial = await getRandomWords(20)
      if (cancelled) return
      setAllWords(initial)
      setIsInitializing(false)

      const more = await getRandomWords(80)
      if (cancelled) return
      setAllWords([...initial, ...more])
    })()

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!useHistory || history.length === 0) {
      setHistoryDefinitions({})
      return
    }
    let cancelled = false
    ;(async () => {
      const map = await getDefinitionsForWords(history.map(item => item.word))
      if (!cancelled) setHistoryDefinitions(map)
    })()
    return () => { cancelled = true }
  }, [useHistory, history])

  const loadNextCard = () => {
    let wordsToUse: Definition[] = []

    if (useHistory && history.length > 0) {
      const historyWords: Definition[] = []
      history.forEach(item => {
        const definitions = historyDefinitions[item.word.toLowerCase()] || []
        if (definitions.length > 0) {
          const randomDefinition = definitions[Math.floor(Math.random() * definitions.length)]
          historyWords.push(randomDefinition)
        }
      })
      wordsToUse = historyWords
    } else {
      wordsToUse = allWords
    }

    if (wordsToUse.length === 0) {
      setCurrentCard(null)
      return
    }

    const randomIndex = Math.floor(Math.random() * wordsToUse.length)
    setCurrentCard(wordsToUse[randomIndex])
    setIsFlipped(false)
  }

  useEffect(() => {
    if (isInitializing) return
    loadNextCard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, useHistory, allWords, historyDefinitions])

  const handleCardClick = () => {
    setIsFlipped(!isFlipped)
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleNext = () => {
    loadNextCard()
  }

  const handleExpand = () => {
    if (currentCard) {
      const newHistoryItem: SearchHistoryItem = {
        word: currentCard.word,
        timestamp: new Date().toISOString(),
        category: 'book'
      }
      const newHistory = [newHistoryItem, ...history]
      setHistory(newHistory)
      navigate(`/word/${encodeURIComponent(currentCard.word)}?category=book`)
    }
  }

  const handleShowWordFirstChange = (value: boolean) => {
    setShowWordFirst(value)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('showWordFirst', value.toString())
    setSearchParams(newParams)
  }

  const handleUseHistoryChange = (value: boolean) => {
    setUseHistory(value)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('useHistory', value.toString())
    setSearchParams(newParams)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    if (Math.abs(diff) > 50) {
      loadNextCard()
    }

    setTouchStart(null)
  }



  if (isInitializing) {
    return (
      <div className="study-container">
        <div className="study-controls">
          <div className="toggle-group">
            <div className="toggle-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showWordFirst}
                  onChange={(e) => handleShowWordFirstChange(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span className="toggle-option-text">
                <span className={`option ${!showWordFirst ? 'selected' : ''}`}>Definition</span> / <span className={`option ${showWordFirst ? 'selected' : ''}`}>Word</span>
              </span>
            </div>
            <div className="toggle-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={useHistory}
                  onChange={(e) => handleUseHistoryChange(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span className="toggle-option-text">
                <span className={`option ${!useHistory ? 'selected' : ''}`}>Random</span> / <span className={`option ${useHistory ? 'selected' : ''}`}>History</span>
              </span>
            </div>
          </div>
        </div>
        <div className="loading-state">
          <p>Loading study content...</p>
        </div>
      </div>
    )
  }

  if (!currentCard) {
    return (
      <div className="study-container">
        <div className="study-controls">
          <div className="toggle-group">
            <div className="toggle-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showWordFirst}
                  onChange={(e) => handleShowWordFirstChange(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span className="toggle-option-text">
                <span className={`option ${!showWordFirst ? 'selected' : ''}`}>Definition</span> / <span className={`option ${showWordFirst ? 'selected' : ''}`}>Word</span>
              </span>
            </div>
            <div className="toggle-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={useHistory}
                  onChange={(e) => handleUseHistoryChange(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span className="toggle-option-text">
                <span className={`option ${!useHistory ? 'selected' : ''}`}>Random</span> / <span className={`option ${useHistory ? 'selected' : ''}`}>History</span>
              </span>
            </div>
          </div>
        </div>
        <div className="no-cards">
          <p>No words available for study</p>
        </div>
      </div>
    )
  }

  return (
    <div className="study-container">
        <div className="study-controls">
          <div className="toggle-group">
            <div className="toggle-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showWordFirst}
                  onChange={(e) => handleShowWordFirstChange(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span className="toggle-option-text">
                <span className={`option ${!showWordFirst ? 'selected' : ''}`}>Definition</span> / <span className={`option ${showWordFirst ? 'selected' : ''}`}>Word</span>
              </span>
            </div>
            <div className="toggle-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={useHistory}
                  onChange={(e) => handleUseHistoryChange(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <span className="toggle-option-text">
                <span className={`option ${!useHistory ? 'selected' : ''}`}>Random</span> / <span className={`option ${useHistory ? 'selected' : ''}`}>History</span>
              </span>
            </div>
          </div>
        </div>

      <div className="flashcard-container">
        <div
          className={`flashcard ${isFlipped ? 'flipped' : ''}`}
          onClick={handleCardClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flashcard-face flashcard-front">
            {showWordFirst ? (
              <div className="card-content">
                <h2 className="word">{formatWordForDisplay(currentCard.word)}</h2>
                <span className="pos">{currentCard.pos}</span>
              </div>
            ) : (
              <div className="card-content">
                <p className="definition">{currentCard.definition}</p>
              </div>
            )}
          </div>
          <div className="flashcard-face flashcard-back">
            {showWordFirst ? (
              <div className="card-content">
                <p className="definition">{currentCard.definition}</p>
              </div>
            ) : (
              <div className="card-content">
                <h2 className="word">{formatWordForDisplay(currentCard.word)}</h2>
                <span className="pos">{currentCard.pos}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flashcard-controls">
        <button className="control-button" onClick={handleExpand}>
          Expand
        </button>
        <button className="control-button" onClick={handleFlip}>
          Flip
        </button>
        <button className="control-button" onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  )
}

export default Study
