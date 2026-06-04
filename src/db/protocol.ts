import type { Definition } from '../interfaces'

export type InstallStateName = 'pending' | 'streaming' | 'done' | 'error'

export interface InstallState {
  state: InstallStateName
  loaded: number
  total: number
  version: number
  error?: string
}

export type ClientToWorker =
  | { type: 'init'; id: number }
  | { type: 'search'; id: number; word: string }
  | { type: 'getMany'; id: number; words: string[] }
  | { type: 'getRandom'; id: number; count: number }
  | { type: 'wipe'; id: number }

export type WorkerToClient =
  | { type: 'ready'; id: number; state: InstallState }
  | { type: 'progress'; state: InstallState }
  | { type: 'result'; id: number; rows: Definition[] }
  | { type: 'resultMap'; id: number; map: Record<string, Definition[]> }
  | { type: 'ok'; id: number }
  | { type: 'error'; id: number; message: string }
