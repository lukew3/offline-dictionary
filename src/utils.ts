import { Definition, SearchHistoryItem, HistoryCategory } from './interfaces'
import { dictClient } from './db/dictClient'

export const performSearch = async (
  searchQuery: string,
  setError: (error: string) => void,
  setInfo: (info: string) => void,
  setDefinitions: (definitions: Definition[]) => void,
  setWordTitle: (title: string) => void,
  history?: SearchHistoryItem[],
  setHistory?: any,
  category?: HistoryCategory,
  skipHistory?: boolean
): Promise<void> => {
  if (!searchQuery.trim()) return

  setError('')
  setDefinitions([])
  setWordTitle('')
  setInfo('Searching...')

  try {
    const rows = await dictClient.search(searchQuery)

    setDefinitions(rows)
    setWordTitle(searchQuery)
    setInfo('')
    if (rows.length === 0) {
      setInfo('No definitions found')
    } else if (history && setHistory && !skipHistory) {
      const newHistoryItem: SearchHistoryItem = {
        word: searchQuery,
        timestamp: new Date().toISOString(),
        category: category || 'search'
      }
      const newHistory = [newHistoryItem, ...history]
      setHistory(newHistory)
    }
  } catch(err){
    console.error(err)
    setError('Search error: ' + (err as Error).message)
    setInfo('')
  }
}

export const removeBookmark = (bookmarks: Record<string, string[]>, word: string, definition: string) => {
  if (bookmarks[word] && bookmarks[word].includes(definition)) {
    const newBookmarks = bookmarks[word].filter(def => def !== definition)
    if (newBookmarks.length === 0) {
      const { [word]: _, ...rest } = bookmarks
      return rest;
    } else {
      return {
        ...bookmarks,
        [word]: newBookmarks
      }
    }
  } else {
    console.error('Bookmark not found')
  }
  return bookmarks
}

export const addBookmark = (bookmarks: Record<string, string[]>, word: string, definition: string) => {
  return {
    ...bookmarks,
    [word]: [...(bookmarks[word] || []), definition]
  }
}

export const checkBookmarked = (bookmarks: Record<string, string[]>, word: string, definition: string) => {
  return bookmarks[word] && bookmarks[word].includes(definition)
}

export const getDefinitionsForWord = async (word: string): Promise<Definition[]> => {
  try {
    return await dictClient.search(word)
  } catch(err) {
    console.error('Error fetching definitions for word:', word, err)
    return []
  }
}

export const getDefinitionsForWords = async (words: string[]): Promise<Record<string, Definition[]>> => {
  if (words.length === 0) return {}
  try {
    return await dictClient.getDefinitionsFor(words)
  } catch(err) {
    console.error('Error fetching definitions for words:', err)
    return {}
  }
}

export const getRandomWords = async (count: number = 50): Promise<Definition[]> => {
  try {
    return await dictClient.getRandom(count)
  } catch(err) {
    console.error('Error fetching random words:', err)
    return []
  }
}

export const formatWordForDisplay = (word: string): string => {
  return word.replace(/_/g, ' ')
}
