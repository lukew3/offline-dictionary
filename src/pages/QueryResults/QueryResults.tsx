import { useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import './QueryResults.css'
import { Definition, HistoryCategory } from '../../interfaces'
import DefinitionComponent from '../../components/Definition/Definition'
import { performSearch, formatWordForDisplay } from '../../utils'
import { useAtom } from 'jotai'
import { historyAtom } from '../../atoms'

interface QueryResultsProps {
  escapeHtml: (str: string | null | undefined) => string
  definitions: Definition[]
  wordTitle: string
  setError: (error: string) => void
  setInfo: (info: string) => void
  setDefinitions: (definitions: Definition[]) => void
  setWordTitle: (title: string) => void
}

const QueryResults = ({
  escapeHtml,
  definitions,
  wordTitle,
  setError,
  setInfo,
  setDefinitions,
  setWordTitle
}: QueryResultsProps) => {
  const { word } = useParams<{ word: string }>()
  const [searchParams] = useSearchParams()
  const [history, setHistory] = useAtom(historyAtom)
  const searchedWord = useRef<string | null>(null)

  useEffect(() => {
    const decodedWord = word ? decodeURIComponent(word) : null
    const categoryParam = searchParams.get('category') as HistoryCategory | null
    const skipHistoryParam = searchParams.get('skipHistory')

    if (decodedWord && searchedWord.current !== decodedWord) {
      searchedWord.current = decodedWord
      const skipHistory = categoryParam === 'book' || skipHistoryParam === 'true'
      performSearch(decodedWord, setError, setInfo, setDefinitions, setWordTitle, history, setHistory, categoryParam || 'search', skipHistory)
    }
  }, [word, searchParams])

  const displayWord = word ? formatWordForDisplay(decodeURIComponent(word)) : formatWordForDisplay(wordTitle)

  return (
    <>
      {displayWord && <h2>{displayWord}</h2>}
      <div id="definitionList" aria-live="polite">
        {definitions.map((def, index) => 
          <DefinitionComponent
            key={index}
            definition={def}
            index={index}
            escapeHtml={escapeHtml}
          />
        )}
      </div>
    </>
  )
}

export default QueryResults