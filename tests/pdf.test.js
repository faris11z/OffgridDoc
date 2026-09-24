import { describe, expect, test } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { inflateSync } from 'node:zlib'
import { mergePdfs, splitPdf, organizePdf, rotatePdf, cropPdf, numberPdf, compressPdf, imagesToPdf, singleImageToPdf } from '../src/pdf.js'

const TINIEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

async function makePdf(widths) {
  const doc = await PDFDocument.create()
  for (const width of widths) doc.addPage([width, 200])
  return doc.save()
}

function widths(doc) {
  return doc.getPages().map(page => page.getSize().width)
}

function inflateAll(raw, out = []) {
  const text = raw.toString('latin1')
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match
  while ((match = re.exec(text)) !== null) {
    try {
      const expanded = inflateSync(Buffer.from(match[1], 'latin1'))
      out.push(expanded)
      inflateAll(expanded, out)
    } catch {
      /* not a flate stream */
    }
  }
  return out
}

function allInflated(raw) {
  return Buffer.concat(inflateAll(Buffer.from(raw))).toString('latin1')
}

describe('mergePdfs', () => {
  test('combines pages in file order', async () => {
    const [a, b] = await Promise.all([makePdf([100, 200]), makePdf([300])])
    const out = await PDFDocument.load(await mergePdfs([a, b]))
    expect(out.getPageCount()).toBe(3)
    expect(widths(out)).toEqual([100, 200, 300])
  })

  test('combines pdfs with image-derived pages in order', async () => {
    const pdfBytes = await makePdf([100, 200])
    const imagePdf = await singleImageToPdf(new Uint8Array(TINIEST_PNG), 'png')
    const out = await PDFDocument.load(await mergePdfs([pdfBytes, imagePdf]))
    expect(out.getPageCount()).toBe(3)
    expect(widths(out)).toEqual([100, 200, 1])
  })
})

describe('singleImageToPdf', () => {
  test('wraps a single image as a 1-page pdf sized to the image', async () => {
    const out = await PDFDocument.load(await singleImageToPdf(new Uint8Array(TINIEST_PNG), 'png'))
    expect(out.getPageCount()).toBe(1)
    const [page] = out.getPages()
    expect(page.getSize().width).toBe(1)
    expect(page.getSize().height).toBe(1)
  })
})

describe('splitPdf', () => {
  test('extracts every page to its own pdf', async () => {
    const bytes = await makePdf([100, 200, 300])
    const parts = await splitPdf(bytes)
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect((await PDFDocument.load(part)).getPageCount()).toBe(1)
    }
  })
})

describe('organizePdf', () => {
  test('reorders pages by 0-based index', async () => {
    const bytes = await makePdf([100, 200, 300])
    const out = await PDFDocument.load(await organizePdf(bytes, [2, 0, 1]))
    expect(widths(out)).toEqual([300, 100, 200])
  })

  test('rejects an out-of-range order', async () => {
    const bytes = await makePdf([100, 200])
    await expect(organizePdf(bytes, [0, 5])).rejects.toThrow('Enter a valid page order')
  })

  test('rejects an empty order', async () => {
    const bytes = await makePdf([100, 200])
    await expect(organizePdf(bytes, [])).rejects.toThrow('Enter a valid page order')
  })
})

describe('rotatePdf', () => {
  test('adds 90 degrees to every page', async () => {
    const bytes = await makePdf([200, 200])
    const out = await PDFDocument.load(await rotatePdf(bytes))
    expect(out.getPages().map(page => page.getRotation().angle)).toEqual([90, 90])
  })
})

describe('cropPdf', () => {
  test('trims every margin by the requested amount', async () => {
    const bytes = await makePdf([200, 200])
    const out = await PDFDocument.load(await cropPdf(bytes, 18))
    for (const page of out.getPages()) {
      const crop = page.getCropBox()
      expect(crop.x).toBe(18)
      expect(crop.y).toBe(18)
      expect(crop.width).toBe(164)
      expect(crop.height).toBe(164)
    }
  })
})

describe('numberPdf', () => {
  test('draws the correct page numbers', async () => {
    const bytes = await makePdf([200, 200])
    const content = allInflated(await numberPdf(bytes, 5))
    expect(content).toContain('<35> Tj')
    expect(content).toContain('<36> Tj')
  })
})

describe('compressPdf', () => {
  test('returns a loadable pdf with all pages intact', async () => {
    const bytes = await makePdf([200])
    const out = await PDFDocument.load(await compressPdf(bytes))
    expect(out.getPageCount()).toBe(1)
  })
})

describe('imagesToPdf', () => {
  test('embeds images as full-page pdfs', async () => {
    const out = await PDFDocument.load(await imagesToPdf([{ bytes: new Uint8Array(TINIEST_PNG), kind: 'png' }]))
    expect(out.getPageCount()).toBe(1)
    const [page] = out.getPages()
    expect(page.getSize().width).toBe(1)
    expect(page.getSize().height).toBe(1)
  })
})