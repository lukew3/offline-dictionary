/// <reference lib="webworker" />
import { openDB, IDBPDatabase } from 'idb'
import type { Definition } from '../interfaces'
import type { ClientToWorker, WorkerToClient, InstallState } from './protocol'

const DB_NAME = 'wordcollector'
const DB_VERSION = 1
const STORE_WORDS = 'words'
const STORE_META = 'meta'
const META_KEY = 'install'
const NDJSON_URL = '/wordnet.ndjson'
const META_URL = '/wordnet.meta.json'

interface StoredWord {
  id?: number
  word: string
  word_lower: string
  pos: string
  definition: string
}

let dbPromise: Promise<IDBPDatabase> | null = null
let installState: InstallState = {
  state: 'pending',
  loaded: 0,
  total: 0,
  version: 0,
}

function post(msg: WorkerToClient) {
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(msg)
}

async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_WORDS)) {
          const store = db.createObjectStore(STORE_WORDS, { keyPath: 'id', autoIncrement: true })
          store.createIndex('by_word_lower', 'word_lower', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

async function loadInstallState(): Promise<InstallState> {
  const db = await getDb()
  const record = await db.get(STORE_META, META_KEY) as
    | { key: string; state: InstallState }
    | undefined
  if (record?.state) return record.state
  return { state: 'pending', loaded: 0, total: 0, version: 0 }
}

async function saveInstallState(state: InstallState): Promise<void> {
  const db = await getDb()
  await db.put(STORE_META, { key: META_KEY, state })
}

let lastProgressPost = 0
function postProgress() {
  const now = performance.now()
  if (now - lastProgressPost < 50 && installState.state === 'streaming') return
  lastProgressPost = now
  post({ type: 'progress', state: { ...installState } })
}

async function fetchMeta(): Promise<{ recordCount: number; version: number }> {
  const res = await fetch(META_URL)
  if (!res.ok) throw new Error(`failed to fetch ${META_URL}: ${res.status}`)
  return res.json() as Promise<{ recordCount: number; version: number }>
}

async function flushBatch(rows: StoredWord[]): Promise<void> {
  if (rows.length === 0) return
  const db = await getDb()
  const tx = db.transaction(STORE_WORDS, 'readwrite')
  const store = tx.objectStore(STORE_WORDS)
  for (const row of rows) store.put(row)
  await tx.done
}

async function runInstall(): Promise<void> {
  const meta = await fetchMeta()
  installState = {
    state: 'streaming',
    loaded: 0,
    total: meta.recordCount,
    version: meta.version,
  }
  await saveInstallState(installState)
  postProgress()

  const res = await fetch(NDJSON_URL)
  if (!res.ok || !res.body) throw new Error(`failed to fetch ${NDJSON_URL}: ${res.status}`)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()

  const BATCH_SIZE = 1000
  let tail = ''
  let batch: StoredWord[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = tail + value
    const lines = text.split('\n')
    tail = lines.pop() ?? ''
    for (const line of lines) {
      if (!line) continue
      const obj = JSON.parse(line) as { w: string; p: string; d: string }
      batch.push({
        word: obj.w,
        word_lower: obj.w.toLowerCase(),
        pos: obj.p,
        definition: obj.d,
      })
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch)
        installState.loaded += batch.length
        batch = []
        postProgress()
      }
    }
  }
  if (tail.trim()) {
    const obj = JSON.parse(tail) as { w: string; p: string; d: string }
    batch.push({
      word: obj.w,
      word_lower: obj.w.toLowerCase(),
      pos: obj.p,
      definition: obj.d,
    })
  }
  if (batch.length) {
    await flushBatch(batch)
    installState.loaded += batch.length
  }

  installState.state = 'done'
  await saveInstallState(installState)
  postProgress()
}

async function ensureReady(): Promise<void> {
  const persisted = await loadInstallState()
  if (persisted.state === 'done') {
    installState = persisted
    return
  }
  // pending, streaming (interrupted), or error: (re)run install.
  // Existing rows are kept (idempotent put on word_lower would dedupe; but
  // since we use auto-increment ids, an interrupted run leaves orphaned rows.
  // For correctness on re-install, wipe the words store first.)
  const db = await getDb()
  await db.clear(STORE_WORDS)
  installState = { state: 'pending', loaded: 0, total: persisted.total, version: persisted.version }
  await saveInstallState(installState)
  await runInstall()
}

let initPromise: Promise<void> | null = null
function initOnce(): Promise<void> {
  if (!initPromise) {
    initPromise = ensureReady().catch(err => {
      installState = {
        ...installState,
        state: 'error',
        error: String(err?.message ?? err),
      }
      postProgress()
      throw err
    })
  }
  return initPromise
}

function rowToDefinition(row: StoredWord): Definition {
  return { word: row.word, pos: row.pos, definition: row.definition }
}

async function search(word: string): Promise<Definition[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex(STORE_WORDS, 'by_word_lower', word.toLowerCase()) as StoredWord[]
  return rows.map(rowToDefinition)
}

async function getMany(words: string[]): Promise<Record<string, Definition[]>> {
  const db = await getDb()
  const tx = db.transaction(STORE_WORDS, 'readonly')
  const index = tx.objectStore(STORE_WORDS).index('by_word_lower')
  const result: Record<string, Definition[]> = {}
  await Promise.all(words.map(async w => {
    const lower = w.toLowerCase()
    const rows = await index.getAll(lower) as StoredWord[]
    if (rows.length) result[lower] = rows.map(rowToDefinition)
  }))
  await tx.done
  return result
}

async function getRandom(count: number): Promise<Definition[]> {
  const db = await getDb()
  const tx = db.transaction(STORE_WORDS, 'readonly')
  const store = tx.objectStore(STORE_WORDS)
  // Use the count of inserted rows so we don't pick ids that don't exist yet
  // during partial install. autoIncrement keys start at 1 and are dense for
  // a fresh install, so [1, loaded] is a valid id range.
  const upper = installState.loaded > 0 ? installState.loaded : (await store.count())
  if (upper === 0) {
    await tx.done
    return []
  }
  const want = Math.min(count, upper)
  const ids = new Set<number>()
  // Oversample a bit in case the upper bound is slightly off (e.g. progress
  // not yet flushed). Cap attempts.
  let attempts = 0
  while (ids.size < want && attempts < want * 4) {
    ids.add(1 + Math.floor(Math.random() * upper))
    attempts++
  }
  const rows = await Promise.all(
    Array.from(ids).map(id => store.get(id) as Promise<StoredWord | undefined>)
  )
  await tx.done
  return rows.filter((r): r is StoredWord => !!r).map(rowToDefinition)
}

async function wipe(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_WORDS)
  await db.clear(STORE_META)
  installState = { state: 'pending', loaded: 0, total: 0, version: 0 }
  initPromise = null
}

self.addEventListener('message', async (e: MessageEvent<ClientToWorker>) => {
  const msg = e.data
  try {
    switch (msg.type) {
      case 'init': {
        // Don't await readiness here — respond with current state and let
        // the install run in the background. The client subscribes to
        // 'progress' events for updates.
        loadInstallState().then(state => {
          installState = state
          post({ type: 'ready', id: msg.id, state: { ...state } })
          if (state.state !== 'done') {
            initOnce().catch(() => { /* error already posted */ })
          }
        })
        return
      }
      case 'search': {
        const rows = await search(msg.word)
        post({ type: 'result', id: msg.id, rows })
        return
      }
      case 'getMany': {
        const map = await getMany(msg.words)
        post({ type: 'resultMap', id: msg.id, map })
        return
      }
      case 'getRandom': {
        const rows = await getRandom(msg.count)
        post({ type: 'result', id: msg.id, rows })
        return
      }
      case 'wipe': {
        await wipe()
        post({ type: 'ok', id: msg.id })
        return
      }
    }
  } catch (err) {
    post({
      type: 'error',
      id: (msg as { id: number }).id,
      message: String((err as Error)?.message ?? err),
    })
  }
})
