import './style.css'
import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib'

const tools = [
  ['Merge', 'Combine files in order', '▣'], ['Split', 'Extract every page', '┆'],
  ['Organize', 'Reorder pages', '⊞'], ['Rotate', 'Turn pages 90°', '↻'],
  ['Crop', 'Trim page margins', '⌗'], ['Page numbers', 'Number every page', '#'],
  ['Compress', 'Optimize PDF structure', '◒'], ['Protect', 'Encryption unavailable in browser', '⌁'],
  ['Redact', 'Requires visual review', '▰'], ['Convert', 'Images to PDF locally', '⇄'],
  ['OCR', 'Requires bundled OCR model', 'Aa'], ['Compare', 'Requires page renderer', '≋'],
]

const supportedTools = new Set(['Merge', 'Split', 'Organize', 'Rotate', 'Crop', 'Page numbers', 'Compress', 'Convert'])
let files = []
let activeTool = 'Merge'
const app = document.querySelector('#app')

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar"><a class="brand" href="#" aria-label="OffgridDoc home"><span class="brand-mark">O</span><span>OffgridDoc</span></a><nav><a class="nav-link active" href="#workspace">Workspace</a><a class="nav-link" href="#tools">All tools</a><a class="nav-link" href="#privacy">Privacy</a></nav><div class="top-actions"><span class="offline-pill"><i></i> Offline mode</span><button class="icon-button" title="Settings" aria-label="Settings">⚙</button></div></header>
    <main id="workspace"><section class="intro"><div><p class="eyebrow">PRIVATE DOCUMENT WORKSPACE <span>·</span> NO UPLOADS</p><h1>Make PDFs behave.<br><em>Keep them yours.</em></h1><p class="lede">A focused toolkit for documents you work with every day. Everything happens in your browser, on this device.</p></div><div class="intro-note"><span class="note-dot"></span><strong>Local by design</strong><p>Your files never leave this tab.<br>No accounts. No servers. No surprises.</p></div></section>
      <section class="workspace-grid"><aside class="tool-rail" id="tools"><div class="rail-label">WORK WITH</div>${tools.map(([name, desc, icon]) => `<button class="tool ${name === activeTool ? 'selected' : ''}" data-tool="${name}"><span class="tool-icon">${icon}</span><span><b>${name}</b><small>${desc}</small></span><span class="tool-arrow">›</span></button>`).join('')}</aside>
        <section class="work-area"><div class="work-heading"><div><div class="section-kicker">01 / ${activeTool.toUpperCase()}</div><h2>${toolHeading(activeTool)}</h2></div><span class="format-chip">PDF <span>·</span> LOCAL</span></div><div id="toolNotice" class="tool-notice">${toolDescription(activeTool)}</div>
          <div class="drop-zone" id="dropZone"><div class="drop-orbit"><span>＋</span></div><h3>Drop your files here</h3><p>or <button class="browse-button" id="browseButton">browse from this device</button></p><small>PDF${activeTool === 'Convert' ? ', JPG, PNG' : ''} · up to 100 MB each</small><input id="fileInput" type="file" multiple accept="${activeTool === 'Convert' ? '.pdf,.jpg,.jpeg,.png' : '.pdf'}" hidden></div>
          <div id="optionPanel" class="option-panel">${toolOptions(activeTool)}</div><div class="queue-header"><span>FILES IN QUEUE <b id="fileCount">0</b></span><button id="clearButton" class="text-button">Clear all</button></div><div id="fileList" class="file-list"><div class="empty-queue"><span>◌</span><p>Your selected files will appear here</p></div></div><div class="action-row"><button id="runButton" class="primary-button" disabled><span id="runLabel">${actionLabel(activeTool)}</span><span>→</span></button><span class="action-hint">Runs entirely in your browser</span></div>
        </section></section><section class="privacy-strip" id="privacy"><div class="shield">✓</div><div><strong>Your documents stay on this device.</strong><span>Network access is blocked by the app policy. Closing this tab clears the working queue.</span></div><span class="privacy-tag">END-TO-END LOCAL</span></section></main><footer><span>OFFGRIDDOC / DOCUMENT TOOLS</span><span>Built for quiet, private work <span class="footer-dot">●</span></span></footer>
  </div>`

const fileInput = document.querySelector('#fileInput')
const dropZone = document.querySelector('#dropZone')
const fileList = document.querySelector('#fileList')
const runButton = document.querySelector('#runButton')

function toolHeading(tool) { return tool === 'Merge' ? 'Bring it all together.' : `${tool} your document.` }
function actionLabel(tool) { return supportedTools.has(tool) ? `${tool} files` : 'Unavailable offline' }
function toolDescription(tool) { return supportedTools.has(tool) ? 'Files are processed locally and never sent anywhere.' : 'This feature needs an additional bundled engine before it can run offline. Nothing will be uploaded.' }
function toolOptions(tool) {
  if (tool === 'Organize') return '<label class="option-label">Page order <input id="pageOrder" placeholder="Example: 3, 1, 2" inputmode="numeric"></label>'
  if (tool === 'Crop') return '<label class="option-label">Trim margin (points) <input id="cropMargin" type="number" min="0" value="18"></label>'
  if (tool === 'Page numbers') return '<label class="option-label">Starting number <input id="startNumber" type="number" min="1" value="1"></label>'
  return ''
}
function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') }
function addFiles(selected) { files = [...files, ...Array.from(selected)].filter((file, index, all) => all.findIndex(item => item.name === file.name && item.size === file.size) === index); renderFiles() }
function renderFiles() { document.querySelector('#fileCount').textContent = files.length; runButton.disabled = files.length === 0 || !supportedTools.has(activeTool); fileList.innerHTML = files.length ? files.map((file, index) => `<div class="file-row"><span class="file-type">${escapeHtml(file.name.split('.').pop().toUpperCase())}</span><span class="file-name"><b>${escapeHtml(file.name)}</b><small>${formatBytes(file.size)} <span>·</span> Ready locally</small></span><button class="remove-file" data-index="${index}" aria-label="Remove file">×</button></div>`).join('') : '<div class="empty-queue"><span>◌</span><p>Your selected files will appear here</p></div>'; document.querySelectorAll('.remove-file').forEach(button => button.addEventListener('click', () => { files.splice(Number(button.dataset.index), 1); renderFiles() })) }
function download(bytes, name) { const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
async function loadPdf(file) { return PDFDocument.load(await file.arrayBuffer()) }
async function pdfFromFile(file) { return loadPdf(file) }

async function runTool() {
  if (!files.length || !supportedTools.has(activeTool)) return
  runButton.disabled = true; document.querySelector('#runLabel').textContent = 'Working locally…'
  try {
    if (activeTool === 'Convert' && files.every(file => /\.(jpe?g|png)$/i.test(file.name))) await imagesToPdf()
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
async function merge() { if (files.length < 2) throw new Error('Add 2+ files'); const out = await PDFDocument.create(); for (const file of files) { const source = await loadPdf(file); const pages = await out.copyPages(source, source.getPageIndices()); pages.forEach(page => out.addPage(page)) } download(await out.save(), 'offgriddoc-merged.pdf') }
async function split() { for (const file of files) { const source = await loadPdf(file); for (let index = 0; index < source.getPageCount(); index++) { const out = await PDFDocument.create(); const [page] = await out.copyPages(source, [index]); out.addPage(page); download(await out.save(), `${file.name.replace(/\.pdf$/i, '')}-page-${index + 1}.pdf`) } } }
async function organize() { const source = await loadPdf(files[0]); const order = (document.querySelector('#pageOrder')?.value || '').split(',').map(value => Number(value.trim()) - 1); if (!order.length || order.some(index => !Number.isInteger(index) || index < 0 || index >= source.getPageCount())) throw new Error('Enter a valid page order'); const out = await PDFDocument.create(); const pages = await out.copyPages(source, order); pages.forEach(page => out.addPage(page)); download(await out.save(), 'offgriddoc-organized.pdf') }
async function rotate() { const source = await loadPdf(files[0]); source.getPages().forEach(page => page.setRotation(degrees((page.getRotation().angle + 90) % 360))); download(await source.save(), 'offgriddoc-rotated.pdf') }
async function crop() { const source = await loadPdf(files[0]); const margin = Number(document.querySelector('#cropMargin').value) || 0; source.getPages().forEach(page => { const { width, height } = page.getSize(); page.setCropBox(margin, margin, Math.max(1, width - margin * 2), Math.max(1, height - margin * 2)) }); download(await source.save(), 'offgriddoc-cropped.pdf') }
async function pageNumbers() { const source = await loadPdf(files[0]); const font = await source.embedFont(StandardFonts.Helvetica); const start = Number(document.querySelector('#startNumber').value) || 1; source.getPages().forEach((page, index) => page.drawText(String(start + index), { x: page.getWidth() / 2 - 4, y: 18, size: 9, font, color: rgb(.2, .25, .25) })); download(await source.save(), 'offgriddoc-numbered.pdf') }
async function compress() { const source = await loadPdf(files[0]); download(await source.save({ useObjectStreams: true, addDefaultPage: false }), 'offgriddoc-compressed.pdf') }
async function imagesToPdf() { const out = await PDFDocument.create(); for (const file of files) { const bytes = await file.arrayBuffer(); const image = /png$/i.test(file.name) ? await out.embedPng(bytes) : await out.embedJpg(bytes); const page = out.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height }) } download(await out.save(), 'offgriddoc-images.pdf') }
function setTool(tool) { activeTool = tool; document.querySelectorAll('.tool').forEach(button => button.classList.toggle('selected', button.dataset.tool === tool)); document.querySelector('.section-kicker').textContent = `01 / ${tool.toUpperCase()}`; document.querySelector('.work-heading h2').textContent = toolHeading(tool); document.querySelector('#toolNotice').textContent = toolDescription(tool); document.querySelector('#optionPanel').innerHTML = toolOptions(tool); document.querySelector('#runLabel').textContent = actionLabel(tool); fileInput.accept = tool === 'Convert' ? '.pdf,.jpg,.jpeg,.png' : '.pdf'; renderFiles() }

document.querySelectorAll('.tool').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)))
document.querySelector('#browseButton').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', event => addFiles(event.target.files))
document.querySelector('#clearButton').addEventListener('click', () => { files = []; renderFiles() })
;['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('dragging') }))
;['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('dragging') }))
dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files))
runButton.addEventListener('click', runTool)
