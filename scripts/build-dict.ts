import { Database } from 'bun:sqlite'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const SOURCE_DB = 'data/wordnetFull.db'
const OUT_NDJSON = 'public/wordnet.ndjson'
const OUT_META = 'public/wordnet.meta.json'
const VERSION = 1

await mkdir(dirname(OUT_NDJSON), { recursive: true })

const db = new Database(SOURCE_DB, { readonly: true })
const total = (db.query('SELECT COUNT(*) AS c FROM words').get() as { c: number }).c

const stream = createWriteStream(OUT_NDJSON)
const rows = db.query('SELECT word, pos, definition FROM words ORDER BY id') as {
  iterate: () => IterableIterator<{ word: string; pos: string; definition: string }>
}

let written = 0
for (const row of rows.iterate()) {
  if (!stream.write(JSON.stringify({ w: row.word, p: row.pos, d: row.definition }) + '\n')) {
    await new Promise<void>(resolve => stream.once('drain', resolve))
  }
  written++
  if (written % 25000 === 0) console.log(`  ${written} / ${total}`)
}
await new Promise<void>((resolve, reject) => {
  stream.end(err => err ? reject(err) : resolve())
})
db.close()

await writeFile(OUT_META, JSON.stringify({
  recordCount: written,
  version: VERSION,
  generatedAt: new Date().toISOString(),
}, null, 2))

console.log(`Wrote ${written} records to ${OUT_NDJSON}`)
console.log(`Wrote meta to ${OUT_META}`)
