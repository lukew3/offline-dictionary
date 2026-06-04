import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRandomWords } from '../../utils'

interface SearchBarProps {
  isReady: boolean
}

function SearchBar({ isReady }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState<string>('')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (!localQuery.trim()) return

    navigate(`/word/${encodeURIComponent(localQuery)}`)
    setLocalQuery('')
  }

  const handleRandomSearch = async (): Promise<void> => {
    const randomWords = await getRandomWords(1)
    if (randomWords.length > 0) {
      const randomWord = randomWords[0].word
      navigate(`/word/${encodeURIComponent(randomWord)}?category=random`)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Enter exact word"
        required
      />
      <button type="submit">Search</button>
      <button
        type="button"
        onClick={handleRandomSearch}
        disabled={!isReady}
        title="Random word"
        aria-label="Search for a random word"
      >
        <i className="fas fa-dice-five"></i>
      </button>
    </form>
  )
}

export default SearchBar
