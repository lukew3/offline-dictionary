import { DatabaseInfo } from '../interfaces'

export const AVAILABLE_DATABASES: DatabaseInfo[] = [
  {
    id: 'wordnet-full',
    name: 'WordNet Full Dictionary',
    url: '/wordnet.ndjson',
    filename: 'wordnet.ndjson',
    size: '23MB',
    description: 'WordNet lexical database (definitions only)',
    downloaded: false,
    enabled: false,
  },
]

export const DATABASE_CACHE_PREFIX = 'dictionary-db-'

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`
}