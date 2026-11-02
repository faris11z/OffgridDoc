import './style.css'
import * as pdfjsLib from 'pdfjs-dist'
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import { mergePdfs, splitPdf, organizePdf, rotatePdf, cropPdf, numberPdf, compressPdf, imagesToPdf, singleImageToPdf } from './pdf.js'

try {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker()
} catch {
  /* fallback to main thread */
}

const tools = [
  ['Merge', 'Combine files and images in order', '▣'], ['Split', 'Every page — or image — as its own file', '┆'],
  ['PDF to images', 'Export PDF pages as PNG or JPG', '▤'],
  ['Organize', 'Reorder pages', '⊞'], ['Rotate', 'Turn pages 90°', '↻'],
  ['Crop', 'Trim page margins', '⌗'], ['Page numbers', 'Number every page', '#'],
  ['Compress', 'Optimize PDF structure', '◒'], ['Protect', 'Encryption unavailable in browser', '⌁'],
  ['Redact', 'Requires visual review', '▰'], ['Convert', 'Images to PDF locally', '⇄'],
  ['OCR', 'Requires bundled OCR model', 'Aa'], ['Compare', 'Requires page renderer', '≋'],
]

const supportedTools = new Set(['Merge', 'Split', 'PDF to images', 'Organize', 'Rotate', 'Crop', 'Page numbers', 'Compress', 'Convert'])
const imageTools = new Set(['Merge', 'Split', 'Convert'])
const imageAccept = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.svg'
let files = []
let draggedIndex = null
let activeTool = 'Merge'
const app = document.querySelector('#app')

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar"><a class="brand" href="#" aria-label="OffgridDoc home"><span class="brand-mark">O</span><span>OffgridDoc</span></a><nav><a class="nav-link active" href="#workspace">Workspace</a><a class="nav-link" href="#tools">All tools</a><a class="nav-link" href="#privacy">Privacy</a></nav><div class="top-actions"><span class="offline-pill"><i></i> Offline mode</span><button class="icon-button" title="Settings" aria-label="Settings">⚙</button></div></header>
    <main id="workspace"><section class="intro"><div><p class="eyebrow">PRIVATE DOCUMENT WORKSPACE <span>·</span> NO UPLOADS</p><h1>Make PDFs behave.<br><em>Keep them yours.</em></h1><p class="lede">A focused toolkit for documents you work with every day. Everything happens in your browser, on this device.</p></div><div class="intro-note"><span class="note-dot"></span><strong>Local by design</strong><p>Your files never leave this tab.<br>No accounts. No servers. No surprises.</p></div></section>
      <section class="workspace-grid"><aside class="tool-rail" id="tools"><div class="rail-label">WORK WITH</div>${tools.map(([name, desc, icon]) => `<button class="tool ${name === activeTool ? 'selected' : ''}" data-tool="${name}"><span class="tool-icon">${icon}</span><span><b>${name}</b><small>${desc}</small></span><span class="tool-arrow">›</span></button>`).join('')}</aside>
        <section class="work-area"><div class="work-heading"><div><div class="section-kicker">01 / ${activeTool.toUpperCase()}</div><h2>${toolHeading(activeTool)}</h2></div><span class="format-chip">PDF <span>·</span> LOCAL</span></div><div id="toolNotice" class="tool-notice">${toolDescription(activeTool)}</div>
          <div class="drop-zone" id="dropZone"><div class="drop-orbit"><span>＋</span></div><h3>Drop your files here</h3><p>or <button class="browse-button" id="browseButton">browse from this device</button></p><small>${imageTools.has(activeTool) ? 'PDF or image' : 'PDF'} · up to 100 MB each</small><input id="fileInput" type="file" multiple accept="${imageTools.has(activeTool) ? (activeTool === 'Convert' ? '.pdf,.jpg,.jpeg,.png' : imageAccept) : '.pdf'}" hidden></div>
          <div id="optionPanel" class="option-panel">${toolOptions(activeTool)}</div><div class="queue-header"><span>FILES IN QUEUE <b id="fileCount">0</b></span><button id="clearButton" class="text-button">Clear all</button></div><div id="fileList" class="file-list"><div class="empty-queue"><span>◌</span><p>Your selected files will appear here</p></div></div><div class="action-row"><button id="runButton" class="primary-button" disabled><span id="runLabel">${actionLabel(activeTool)}</span><span>→</span></button><span class="action-hint">Runs entirely in your browser</span></div>
        </section></section><section class="privacy-strip" id="privacy"><div class="shield">✓</div><div><strong>Your documents stay on this device.</strong><span>Network access is blocked by the app policy. Closing this tab clears the working queue.</span></div><span class="privacy-tag">END-TO-END LOCAL</span></section></main><footer><span>OFFGRIDDOC / DOCUMENT TOOLS</span><span>Built for quiet, private work <span class="footer-dot">●</span></span></footer>
  </div>`

const fileInput = document.querySelector('#fileInput')
const dropZone = document.querySelector('#dropZone')
const fileList = document.querySelector('#fileList')
const runButton = document.querySelector('#runButton')

function toolHeading(tool) {
  if (tool === 'Merge') return 'Bring it all together.'
  if (tool === 'PDF to images') return 'Export PDF pages as images.'
  return `${tool} your document.`
}
function actionLabel(tool) {
  if (!supportedTools.has(tool)) return 'Unavailable offline'
  if (tool === 'PDF to images') return 'Export images'
  return `${tool} files`
}
function toolDescription(tool) {
  if (tool === 'PDF to images') return 'Each page is rendered to an image locally in your browser. Nothing is uploaded.'
  return supportedTools.has(tool) ? 'Files are processed locally and never sent anywhere.' : 'This feature needs an additional bundled engine before it can run offline. Nothing will be uploaded.'
}
function toolOptions(tool) {
  if (tool === 'Organize') return '<label class="option-label">Page order <input id="pageOrder" placeholder="Example: 3, 1, 2" inputmode="numeric"></label>'
  if (tool === 'Crop') return '<label class="option-label">Trim margin (points) <input id="cropMargin" type="number" min="0" value="18"></label>'
  if (tool === 'Page numbers') return '<label class="option-label">Starting number <input id="startNumber" type="number" min="1" value="1"></label>'
  if (tool === 'PDF to images') return '<label class="option-label">Format <select id="imageFormat" style="border:1px solid #b7cfca;background:#fff;color:var(--ink);padding:6px 8px;font:11px monospace;"><option value="png" selected>PNG (Lossless)</option><option value="jpeg">JPG (Compact)</option></select></label><label class="option-label" style="margin-left:14px;">Scale <select id="imageScale" style="border:1px solid #b7cfca;background:#fff;color:var(--ink);padding:6px 8px;font:11px monospace;"><option value="1">1x (Standard)</option><option value="2" selected>2x (High Res)</option><option value="3">3x (Ultra Sharp)</option></select></label>'
  return ''
}
function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') }
function addFiles(selected) { files = [...files, ...Array.from(selected)].filter((file, index, all) => all.findIndex(item => item.name === file.name && item.size === file.size) === index); renderFiles() }
function reorderFiles(from, to) { if (from === to) return; const [item] = files.splice(from, 1); files.splice(to, 0, item); renderFiles() }
function renderFiles() { document.querySelector('#fileCount').textContent = files.length; runButton.disabled = files.length === 0 || !supportedTools.has(activeTool); fileList.innerHTML = files.length ? files.map((file, index) => `<div class="file-row" draggable="true" data-index="${index}"><span class="file-type">${escapeHtml(file.name.split('.').pop().toUpperCase())}</span><span class="file-name"><b>${escapeHtml(file.name)}</b><small>${formatBytes(file.size)} <span>·</span> Ready locally</small></span><button class="remove-file" data-index="${index}" aria-label="Remove file">×</button></div>`).join('') : '<div class="empty-queue"><span>◌</span><p>Your selected files will appear here</p></div>'; document.querySelectorAll('.remove-file').forEach(button => button.addEventListener('click', () => { files.splice(Number(button.dataset.index), 1); renderFiles() })); document.querySelectorAll('.file-row').forEach(row => { row.addEventListener('dragstart', event => { draggedIndex = Number(row.dataset.index); event.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging') }); row.addEventListener('dragend', () => { draggedIndex = null; row.classList.remove('dragging'); fileList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')) }); row.addEventListener('dragover', event => { if (draggedIndex === null || draggedIndex === Number(row.dataset.index)) return; event.preventDefault(); row.classList.add('drag-over') }); row.addEventListener('dragleave', () => row.classList.remove('drag-over')); row.addEventListener('drop', event => { event.preventDefault(); row.classList.remove('drag-over'); if (draggedIndex === null) return; reorderFiles(draggedIndex, Number(row.dataset.index)); draggedIndex = null }) }) }
function download(bytes, name, mimeType = 'application/pdf') { const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([bytes], { type: mimeType })); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1200) }
function acceptFor(tool) { if (tool === 'PDF to images') return '.pdf'; return imageTools.has(tool) ? (tool === 'Convert' ? '.pdf,.jpg,.jpeg,.png' : imageAccept) : '.pdf' }
function imageKind(file) { if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) return 'jpg'; if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'png'; return '' }
function decodeImageToPng(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(async blob => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('Unsupported image format')), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unsupported image format')) }
    img.src = url
  })
}
async function toPdfBytes(file) {
  if (/\.pdf$/i.test(file.name)) return file.arrayBuffer()
  const kind = imageKind(file)
  if (kind) return singleImageToPdf(await file.arrayBuffer(), kind)
  return singleImageToPdf(await decodeImageToPng(file), 'png')
}
async function renderPdfFileToImages(file, options = {}) {
  const format = options.format || 'png'
  const scale = Number(options.scale) || 2
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdfDoc = await loadingTask.promise
  const numPages = pdfDoc.numPages
  const baseName = file.name.replace(/\.pdf$/i, '')
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 0.92 : undefined

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    document.querySelector('#runLabel').textContent = `Rendering page ${pageNum}/${numPages}…`
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise

    const imageBytes = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Failed to render page to image'))
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject)
      }, mime, quality)
    })

    const downloadName = numPages === 1
      ? `${baseName}.${ext}`
      : `${baseName}-page-${pageNum}.${ext}`

    download(imageBytes, downloadName, mime)
    if (numPages > 1) await new Promise(resolve => setTimeout(resolve, 150))
  }
}
async function convertPdfToImages() {
  const format = document.querySelector('#imageFormat')?.value || 'png'
  const scale = Number(document.querySelector('#imageScale')?.value) || 2
  for (const file of files) {
    if (!/\.pdf$/i.test(file.name)) throw new Error('Select PDF files for this operation.')
    await renderPdfFileToImages(file, { format, scale })
  }
}
async function runTool() {
  if (!files.length || !supportedTools.has(activeTool)) return
  runButton.disabled = true; document.querySelector('#runLabel').textContent = 'Working locally…'
  try {
    if (activeTool === 'PDF to images') await convertPdfToImages()
    else if (activeTool === 'Convert') {
      if (files.every(file => /\.(jpe?g|png)$/i.test(file.name))) await convertImages()
      else if (files.every(file => /\.pdf$/i.test(file.name))) await convertPdfToImages()
      else throw new Error('Select either images or PDFs.')
    }
    else if (activeTool === 'Merge') await merge()
    else if (activeTool === 'Split') await split()
    else if (activeTool === 'Organize') await organize()
    else if (activeTool === 'Rotate') await rotate()
    else if (activeTool === 'Crop') await crop()
    else if (activeTool === 'Page numbers') await pageNumbers()
    else if (activeTool === 'Compress') await compress()
    else throw new Error('Select PDF files for this operation.')
    document.querySelector('#runLabel').textContent = 'Downloaded locally'
  } catch (error) { document.querySelector('#runLabel').textContent = error.message.length > 26 ? 'Check file and try again' : error.message }
  runButton.disabled = false; setTimeout(() => { document.querySelector('#runLabel').textContent = actionLabel(activeTool) }, 2200)
}
async function merge() { if (files.length < 2) throw new Error('Add 2+ files'); download(await mergePdfs(await Promise.all(files.map(file => toPdfBytes(file)))), 'offgriddoc-merged.pdf') }
async function split() { for (const file of files) { if (/\.pdf$/i.test(file.name)) { const results = await splitPdf(await file.arrayBuffer()); results.forEach((bytes, index) => download(bytes, `${file.name.replace(/\.pdf$/i, '')}-page-${index + 1}.pdf`)) } else { download(await toPdfBytes(file), `${file.name.replace(/\.[^.]+$/, '')}.pdf`) } } }
async function organize() { const order = (document.querySelector('#pageOrder')?.value || '').split(',').map(value => Number(value.trim()) - 1); download(await organizePdf(await files[0].arrayBuffer(), order), 'offgriddoc-organized.pdf') }
async function rotate() { download(await rotatePdf(await files[0].arrayBuffer()), 'offgriddoc-rotated.pdf') }
async function crop() { const margin = Number(document.querySelector('#cropMargin').value) || 0; download(await cropPdf(await files[0].arrayBuffer(), margin), 'offgriddoc-cropped.pdf') }
async function pageNumbers() { const start = Number(document.querySelector('#startNumber').value) || 1; download(await numberPdf(await files[0].arrayBuffer(), start), 'offgriddoc-numbered.pdf') }
async function compress() { download(await compressPdf(await files[0].arrayBuffer()), 'offgriddoc-compressed.pdf') }
async function convertImages() { const images = await Promise.all(files.map(async file => ({ bytes: await file.arrayBuffer(), kind: /png$/i.test(file.name) ? 'png' : 'jpg' }))); download(await imagesToPdf(images), 'offgriddoc-images.pdf') }
function setTool(tool) { activeTool = tool; document.querySelectorAll('.tool').forEach(button => button.classList.toggle('selected', button.dataset.tool === tool)); document.querySelector('.section-kicker').textContent = `01 / ${tool.toUpperCase()}`; document.querySelector('.work-heading h2').textContent = toolHeading(tool); document.querySelector('#toolNotice').textContent = toolDescription(tool); document.querySelector('#optionPanel').innerHTML = toolOptions(tool); document.querySelector('#runLabel').textContent = actionLabel(tool); fileInput.accept = acceptFor(tool); document.querySelector('#dropZone small').textContent = `${imageTools.has(tool) ? 'PDF or image' : 'PDF'} · up to 100 MB each`; renderFiles() }

document.querySelectorAll('.tool').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)))
document.querySelector('#browseButton').addEventListener('click', () => fileInput.click())
document.querySelector('.drop-orbit').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', event => addFiles(event.target.files))
document.querySelector('#clearButton').addEventListener('click', () => { files = []; renderFiles() })
;['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('dragging') }))
;['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('dragging') }))
dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files))
runButton.addEventListener('click', runTool)
