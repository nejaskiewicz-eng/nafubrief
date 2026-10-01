// Zasada nadrzędna panelu: żadnych długich myślników (U+2014) ani półpauz (U+2013), tylko krótki "-".
// Uruchamiane przed buildem: build się nie uda, jeśli taki znak pojawi się w kodzie lub tekstach panelu.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['src', 'netlify', 'index.html', 'public/feedback.js']
const bad = /[–—]/
const hits = []
const walk = (p) => {
  const st = statSync(p)
  if (st.isDirectory()) return readdirSync(p).forEach((f) => walk(join(p, f)))
  if (!/\.(tsx?|jsx?|mjs|css|html|md|json)$/.test(p)) return
  readFileSync(p, 'utf8').split('\n').forEach((line, i) => bad.test(line) && hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 120)}`))
}
roots.forEach((r) => {
  try {
    walk(r)
  } catch {
    /* brak katalogu */
  }
})
if (hits.length) {
  console.error('Długie myślniki lub półpauzy są zakazane w panelu. Zamień je na krótki "-":\n' + hits.join('\n'))
  process.exit(1)
}
