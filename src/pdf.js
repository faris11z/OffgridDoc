import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib'

export async function mergePdfs(sources) {
  const out = await PDFDocument.create()
  for (const bytes of sources) {
    const source = await PDFDocument.load(bytes)
    const pages = await out.copyPages(source, source.getPageIndices())
    pages.forEach(page => out.addPage(page))
  }
  return out.save()
}

export async function splitPdf(bytes) {
  const source = await PDFDocument.load(bytes)
  const results = []
  for (let index = 0; index < source.getPageCount(); index++) {
    const out = await PDFDocument.create()
    const [page] = await out.copyPages(source, [index])
    out.addPage(page)
    results.push(await out.save())
  }
  return results
}

export async function organizePdf(bytes, order) {
  const source = await PDFDocument.load(bytes)
  if (!Array.isArray(order) || order.length === 0 || order.some(i => !Number.isInteger(i) || i < 0 || i >= source.getPageCount())) throw new Error('Enter a valid page order')
  const out = await PDFDocument.create()
  const pages = await out.copyPages(source, order)
  pages.forEach(page => out.addPage(page))
  return out.save()
}

export async function rotatePdf(bytes) {
  const source = await PDFDocument.load(bytes)
  source.getPages().forEach(page => page.setRotation(degrees((page.getRotation().angle + 90) % 360)))
  return source.save()
}

export async function cropPdf(bytes, margin) {
  const source = await PDFDocument.load(bytes)
  source.getPages().forEach(page => {
    const { width, height } = page.getSize()
    page.setCropBox(margin, margin, Math.max(1, width - margin * 2), Math.max(1, height - margin * 2))
  })
  return source.save()
}

export async function numberPdf(bytes, start = 1) {
  const source = await PDFDocument.load(bytes)
  const font = await source.embedFont(StandardFonts.Helvetica)
  source.getPages().forEach((page, index) =>
    page.drawText(String(start + index), { x: page.getWidth() / 2 - 4, y: 18, size: 9, font, color: rgb(.2, .25, .25) })
  )
  return source.save()
}

export async function compressPdf(bytes) {
  const source = await PDFDocument.load(bytes)
  return source.save({ useObjectStreams: true, addDefaultPage: false })
}

export async function imagesToPdf(images) {
  const out = await PDFDocument.create()
  for (const { bytes, kind } of images) {
    const image = kind === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes)
    const page = out.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  return out.save()
}