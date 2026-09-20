import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const APP_FILES = ['src/main.js', 'src/pdf.js', 'index.html', 'electron/main.cjs', 'electron/preload.cjs']

const FORBIDDEN = [
  ['fetch(', 'fetch()'],
  ['XMLHttpRequest', 'XMLHttpRequest'],
  ['WebSocket', 'WebSocket'],
  ['EventSource', 'EventSource'],
  ['sendBeacon', 'navigator.sendBeacon'],
  ['navigator.geolocation', 'geolocation'],
  ['http://', 'plain http url'],
  ['https://', 'plain https url'],
  ['ws://', 'websocket url'],
  ['wss://', 'secure websocket url'],
]

function read(name) {
  return readFileSync(`${ROOT}${name}`, 'utf8')
}

describe('offline guarantee', () => {
  for (const name of APP_FILES) {
    test(`${name} contains no network calls`, () => {
      const source = read(name)
      for (const [needle, label] of FORBIDDEN) {
        expect(source.includes(needle), `${name} must not use ${label}`).toBe(false)
      }
    })
  }

  test('browser CSP allows no remote connections', () => {
    expect(read('index.html')).toContain("connect-src 'none'")
  })

  test('electron CSP blocks remote connections and the <webContents> policy blocks all traffic', () => {
    const main = read('electron/main.cjs')
    expect(main).toContain("connect-src 'none'")
    expect(main).toMatch(/setPermissionRequestHandler/)
    expect(main).toMatch(/onBeforeRequest/)
  })

  test('renderer runs sandboxed without node access', () => {
    const main = read('electron/main.cjs')
    expect(main).toContain('nodeIntegration: false')
    expect(main).toContain('contextIsolation: true')
    expect(main).toContain('sandbox: true')
  })

  test('working directory is not bundled into the shipped app', () => {
    const pkg = read('package.json')
    expect(pkg).not.toContain('/mnt/d/')
  })
})