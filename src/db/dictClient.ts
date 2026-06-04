import type { Definition } from '../interfaces'
import type {
  ClientToWorker,
  WorkerToClient,
  InstallState,
} from './protocol'

export type { InstallState } from './protocol'

type ProgressListener = (state: InstallState) => void

class DictClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >()
  private state: InstallState = {
    state: 'pending',
    loaded: 0,
    total: 0,
    version: 0,
  }
  private listeners = new Set<ProgressListener>()
  private readyPromise: Promise<void> | null = null
  private resolveReady: (() => void) | null = null

  start(): void {
    if (this.worker) return
    this.worker = new Worker(
      new URL('./dictWorker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.addEventListener('message', this.onMessage)
    this.readyPromise = new Promise(resolve => {
      this.resolveReady = resolve
    })
    this.send({ type: 'init', id: this.allocId() })
  }

  private onMessage = (e: MessageEvent<WorkerToClient>) => {
    const msg = e.data
    if (msg.type === 'progress') {
      this.updateState(msg.state)
      return
    }
    if (msg.type === 'ready') {
      this.updateState(msg.state)
      // 'ready' resolves the init request; readyPromise resolves on
      // state.state === 'done' (handled in updateState).
      const pending = this.pending.get(msg.id)
      if (pending) {
        this.pending.delete(msg.id)
        pending.resolve(msg.state)
      }
      return
    }
    const pending = this.pending.get(msg.id)
    if (!pending) return
    this.pending.delete(msg.id)
    if (msg.type === 'error') {
      pending.reject(new Error(msg.message))
    } else if (msg.type === 'result') {
      pending.resolve(msg.rows)
    } else if (msg.type === 'resultMap') {
      pending.resolve(msg.map)
    } else if (msg.type === 'ok') {
      pending.resolve(undefined)
    }
  }

  private updateState(state: InstallState) {
    this.state = state
    for (const cb of this.listeners) cb(state)
    if (state.state === 'done' && this.resolveReady) {
      this.resolveReady()
      this.resolveReady = null
    }
  }

  private allocId(): number {
    return this.nextId++
  }

  private send(msg: ClientToWorker): void {
    if (!this.worker) throw new Error('dictClient not started')
    this.worker.postMessage(msg)
  }

  private request<T>(build: (id: number) => ClientToWorker): Promise<T> {
    if (!this.worker) this.start()
    const id = this.allocId()
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })
      this.send(build(id))
    })
  }

  installState(): InstallState {
    return this.state
  }

  onProgress(cb: ProgressListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Resolves once the install pipeline reports state === 'done'. */
  ready(): Promise<void> {
    if (!this.worker) this.start()
    if (this.state.state === 'done') return Promise.resolve()
    return this.readyPromise ?? Promise.resolve()
  }

  search(word: string): Promise<Definition[]> {
    return this.request<Definition[]>(id => ({ type: 'search', id, word }))
  }

  getDefinitionsFor(words: string[]): Promise<Record<string, Definition[]>> {
    return this.request<Record<string, Definition[]>>(id => ({
      type: 'getMany',
      id,
      words,
    }))
  }

  getRandom(count: number): Promise<Definition[]> {
    return this.request<Definition[]>(id => ({ type: 'getRandom', id, count }))
  }

  wipe(): Promise<void> {
    return this.request<void>(id => ({ type: 'wipe', id }))
  }
}

export const dictClient = new DictClient()
