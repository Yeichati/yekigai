import './styles.css'

const root = document.getElementById('root')

const PHASES = ['intro', 'selection', 'intersections', 'discussion', 'final', 'result']

const state = {
  data: null,
  phase: 'intro',
  draws: {},
  selected: {},
  deckIndex: 0,
  intersectionMode: 'today',
  todayIntersection: null,
  developIntersection: null,
  todayQuestion: '',
  developQuestion: '',
  promptId: null,
  completion: '',
  exportUrl: null,
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const DATA_BASE_URL = `${import.meta.env.BASE_URL}data/`

async function fetchJson(path) {
  const response = await fetch(`${DATA_BASE_URL}${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Impossible de charger ${path}`)
  return response.json()
}

async function loadData() {
  const [config, decksData, intersectionsData, promptsData] = await Promise.all([
    fetchJson('config.json'),
    fetchJson('decks.json'),
    fetchJson('intersections.json'),
    fetchJson('final-card-prompts.json'),
  ])

  const byId = Object.fromEntries(decksData.decks.map((deck) => [deck.id, deck]))
  const decks = config.deckOrder.map((id) => byId[id]).filter(Boolean)

  return {
    config,
    decks,
    intersections: intersectionsData.intersections,
    prompts: promptsData.prompts,
  }
}

function sample(items, count) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function phaseProgress(phase) {
  const index = PHASES.indexOf(phase)
  if (index <= 0) return 0
  return Math.round((index / (PHASES.length - 1)) * 100)
}

function currentDeck() {
  return state.data.decks[state.deckIndex]
}

function getIntersection(id) {
  return state.data.intersections.find((item) => item.id === id)
}

function getPrompt(id) {
  return state.data.prompts.find((item) => item.id === id)
}

function finalText() {
  const prompt = getPrompt(state.promptId)
  if (!prompt || !state.completion.trim()) return ''
  return `${prompt.prefix} ${state.completion.trim()}`
}

function clearExport() {
  if (state.exportUrl) URL.revokeObjectURL(state.exportUrl)
  state.exportUrl = null
}

function clearFinalCard() {
  clearExport()
  state.promptId = null
  state.completion = ''
}

function clearIntersections() {
  state.intersectionMode = 'today'
  state.todayIntersection = null
  state.developIntersection = null
  state.todayQuestion = ''
  state.developQuestion = ''
}

function headerHtml() {
  const { config } = state.data
  return `
    <header class="topbar">
      <div class="brand" aria-label="Yekigai">
        <span class="brand-dot" aria-hidden="true"></span>
        ${esc(config.brand.name)}
      </div>
      <div class="topbar-meta">${esc(config.brand.meta)}</div>
    </header>
    ${state.phase !== 'intro' ? `
      <div class="progress-strip" aria-hidden="true">
        <span style="width:${phaseProgress(state.phase)}%"></span>
      </div>
    ` : ''}
  `
}

function footerHtml() {
  const { footer } = state.data.config
  return `
    <footer class="footer">
      <a href="${esc(footer.url)}" target="_blank" rel="noreferrer">${esc(footer.text)}</a>
    </footer>
  `
}

function introHtml() {
  const { config, decks } = state.data
  return `
    <main>
      <section class="hero yekigai-hero">
        <div class="hero-copy">
          <span class="eyebrow">${esc(config.intro.kicker)}</span>
          <h1>${esc(config.intro.heroLine1)}<br><span>${esc(config.intro.heroLine2)}</span></h1>
          <p>${esc(config.intro.text)}</p>
          <button class="primary hero-cta" data-action="start">${esc(config.intro.startLabel)} →</button>
        </div>
        <div class="hero-orbit" aria-hidden="true">
          ${decks.map((deck, index) => `<div class="chip chip-${index}">${esc(deck.shortLabel)}</div>`).join('')} 
          <div class="orbit-center">Y</div>
        </div>
      </section>

      <section class="intro-shell">
        <div class="intro-heading">
          <span class="section-kicker">${esc(config.intro.howKicker)}</span>
          <h2>${esc(config.intro.howTitle)}</h2>
          <p>${esc(config.intro.note)}</p>
        </div>
        <div class="rules-grid">
          ${config.rules.map((rule) => `
            <article class="rule-card">
              <span>${esc(rule.number)}</span>
              <strong>${esc(rule.title)}</strong>
              <p>${esc(rule.text)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    </main>
  `
}

function boardHtml({ interactiveIntersections = false, final = '' } = {}) {
  const { decks, intersections } = state.data
  const deckById = Object.fromEntries(decks.map((deck) => [deck.id, deck]))

  const dimensions = decks.map((deck) => {
    const card = state.selected[deck.id]
    return `
      <article class="board-dimension board-${esc(deck.id)} ${card ? 'filled' : ''}" style="--accent:${esc(deck.accent)}">
        <div class="board-dimension-label">
          <span>${esc(deck.symbol)}</span>
          <strong>${esc(deck.label)}</strong>
        </div>
        ${card ? `
          <p>${esc(card.text)}</p>
          <small>${esc(card.theme)}</small>
        ` : `<p class="board-placeholder">${esc(state.data.config.board.emptyDimension)}</p>`}
      </article>
    `
  }).join('')

  const intersectionCells = intersections.map((intersection) => {
    const pairReady = intersection.deckIds.every((id) => Boolean(state.selected[id]))
    const isToday = state.todayIntersection === intersection.id
    const isDevelop = state.developIntersection === intersection.id
    const unavailable = state.intersectionMode === 'develop' && isToday && !isDevelop
    const clickable = interactiveIntersections && pairReady && !unavailable
    const pair = intersection.deckIds.map((id) => deckById[id])

    return `
      <button
        type="button"
        class="board-intersection board-${esc(intersection.id)} ${clickable ? 'clickable' : ''} ${isToday ? 'today' : ''} ${isDevelop ? 'develop' : ''}"
        style="--intersection-accent:${esc(intersection.accent)}"
        ${clickable ? `data-action="select-intersection" data-id="${esc(intersection.id)}"` : 'disabled'}
        aria-label="${esc(`${intersection.label} : ${pair.map((d) => d.label).join(' + ')}`)}"
      >
        <span class="intersection-name">${esc(intersection.label)}</span>
        <small>${esc(pair.map((d) => d.shortLabel).join(' + '))}</small>
        ${isToday ? `<b class="intersection-state">${esc(state.data.config.intersections.todayBadge)}</b>` : ''}
        ${isDevelop ? `<b class="intersection-state">${esc(state.data.config.intersections.developBadge)}</b>` : ''}
      </button>
    `
  }).join('')

  const center = final
    ? `<div class="board-center filled"><span>${esc(state.data.config.board.finalLabel)}</span><p>${esc(final)}</p></div>`
    : `<div class="board-center"><b>Y</b><span>${esc(state.data.config.board.brand)}</span></div>`

  return `
    <section class="board-wrap" aria-label="Plateau Yekigai">
      <div class="board">
        ${dimensions}
        ${intersectionCells}
        ${center}
      </div>
    </section>
  `
}

function deckBadgeHtml(deck) {
  return `
    <span class="deck-badge" style="--accent:${esc(deck.accent)}">
      <b>${esc(deck.symbol)}</b>
      <span>${esc(deck.label)}</span>
    </span>
  `
}

function selectionHtml() {
  const { config, decks, intersections } = state.data
  const deck = currentDeck()
  const cards = state.draws[deck.id] || []
  const chosen = state.selected[deck.id]

  return `
    <main class="game-shell selection-layout">
      <div class="game-head">
        <div>
          <span class="section-kicker">${esc(config.selection.kicker)}</span>
          <h1>${esc(config.selection.title)}</h1>
          <p>${esc(config.selection.hint)}</p>
        </div>
        <div class="step-counter">${state.deckIndex + 1} / ${decks.length}</div>
      </div>

      <div class="selection-main">
        ${boardHtml()}

        <aside class="draw-panel">
          ${deckBadgeHtml(deck)}
          <p class="deck-description">${esc(deck.description)}</p>
          <div class="draw-stack">
            ${cards.map((card) => `
              <button
                type="button"
                class="choice-card ${chosen?.id === card.id ? 'selected' : ''}"
                style="--accent:${esc(deck.accent)}"
                data-action="select-card"
                data-deck="${esc(deck.id)}"
                data-id="${esc(card.id)}"
              >
                <div class="choice-card-top">
                  <span>${esc(card.theme)}</span>
                  <b class="choice-check">${chosen?.id === card.id ? '✓' : '+'}</b>
                </div>
                <strong>${esc(card.text)}</strong>
              </button>
            `).join('')}
          </div>
          <div class="panel-actions">
            <button class="secondary" data-action="selection-back" ${state.deckIndex === 0 ? 'disabled' : ''}>← ${esc(config.selection.back)}</button>
            <button class="primary" data-action="selection-next" ${chosen ? '' : 'disabled'}>
              ${state.deckIndex === decks.length - 1 ? esc(config.selection.finish) : esc(config.selection.next)} →
            </button>
          </div>
        </aside>
      </div>
    </main>
  `
}

function intersectionsHtml() {
  const { config } = state.data
  const today = getIntersection(state.todayIntersection)
  const develop = getIntersection(state.developIntersection)
  const instruction = state.intersectionMode === 'today'
    ? config.intersections.todayInstruction
    : config.intersections.developInstruction

  return `
    <main class="game-shell">
      <div class="game-head intersection-head">
        <div>
          <span class="section-kicker">${esc(config.intersections.kicker)}</span>
          <h1>${esc(config.intersections.title)}</h1>
          <p>${esc(instruction)}</p>
        </div>
        ${(state.todayIntersection || state.developIntersection) ? `<button class="text-button" data-action="reset-intersections">${esc(config.intersections.reset)}</button>` : ''}
      </div>

      ${boardHtml({ interactiveIntersections: true })}

      <div class="intersection-summary">
        <article class="summary-choice ${today ? 'ready' : ''}">
          <span>${esc(config.intersections.todayLabel)}</span>
          <strong>${esc(today?.label || config.intersections.todayEmpty)}</strong>
          <p>${esc(today?.description || config.intersections.todayInstruction)}</p>
        </article>
        <article class="summary-choice ${develop ? 'ready' : ''}">
          <span>${esc(config.intersections.developLabel)}</span>
          <strong>${esc(develop?.label || config.intersections.developEmpty)}</strong>
          <p>${esc(develop?.description || config.intersections.developInstruction)}</p>
        </article>
      </div>

      <div class="page-actions">
        <button class="secondary" data-action="intersections-back">← ${esc(config.intersections.back)}</button>
        <button class="primary" data-action="intersections-continue" ${today && develop ? '' : 'disabled'}>${esc(config.intersections.continue)} →</button>
      </div>
    </main>
  `
}

function questionCardHtml({ label, intersection, question }) {
  const deckById = Object.fromEntries(state.data.decks.map((deck) => [deck.id, deck]))
  return `
    <article class="question-card" style="--accent:${esc(intersection.accent)}">
      <div class="question-card-top">
        <span>${esc(label)}</span>
        <b>${esc(intersection.label)}</b>
      </div>
      <div class="question-pair">
        ${intersection.deckIds.map((deckId) => `
          <div>
            <small>${esc(deckById[deckId].label)}</small>
            <p>${esc(state.selected[deckId].text)}</p>
          </div>
        `).join('')}
      </div>
      <blockquote>${esc(question)}</blockquote>
    </article>
  `
}

function discussionHtml() {
  const { config } = state.data
  const today = getIntersection(state.todayIntersection)
  const develop = getIntersection(state.developIntersection)

  return `
    <main class="game-shell discussion-shell">
      <div class="game-head">
        <div>
          <span class="section-kicker">${esc(config.discussion.kicker)}</span>
          <h1>${esc(config.discussion.title)}</h1>
          <p>${esc(config.discussion.text)}</p>
        </div>
      </div>

      <div class="question-grid">
        ${questionCardHtml({ label: config.intersections.todayLabel, intersection: today, question: state.todayQuestion })}
        ${questionCardHtml({ label: config.intersections.developLabel, intersection: develop, question: state.developQuestion })}
      </div>

      <div class="conversation-note">
        <span>?</span>
        <p>${esc(config.discussion.note)}</p>
      </div>

      <div class="page-actions">
        <button class="secondary" data-action="discussion-back">← ${esc(config.discussion.back)}</button>
        <button class="primary" data-action="discussion-continue">${esc(config.discussion.continue)} →</button>
      </div>
    </main>
  `
}

function finalEditorHtml() {
  const { config, prompts } = state.data
  const prompt = getPrompt(state.promptId)
  const final = finalText()

  return `
    <main class="game-shell final-editor-shell">
      <div class="game-head">
        <div>
          <span class="section-kicker">${esc(config.finalCard.kicker)}</span>
          <h1>${esc(config.finalCard.title)}</h1>
          <p>${esc(config.finalCard.text)}</p>
        </div>
      </div>

      <div class="final-editor-grid">
        <section class="prompt-panel">
          <h2>${esc(config.finalCard.promptHeading)}</h2>
          <div class="prompt-list">
            ${prompts.map((item) => `
              <button
                type="button"
                class="${state.promptId === item.id ? 'active' : ''}"
                data-action="select-prompt"
                data-id="${esc(item.id)}"
              >${esc(item.prefix)}…</button>
            `).join('')}
          </div>

          <h2>${esc(config.finalCard.completionHeading)}</h2>
          <div class="sentence-editor">
            ${prompt ? `<strong>${esc(prompt.prefix)}</strong>` : `<strong>${esc(config.finalCard.choosePromptFirst)}</strong>`}
            <textarea
              data-input="completion"
              placeholder="${esc(config.finalCard.placeholder)}"
              maxlength="220"
              rows="4"
              ${prompt ? '' : 'disabled'}
            >${esc(state.completion)}</textarea>
            <small>${state.completion.length} / 220</small>
          </div>
        </section>

        <section class="final-card-preview ${final ? 'ready' : ''}">
          <span>${esc(config.finalCard.previewLabel)}</span>
          ${final ? `<p>${esc(final)}</p>` : `<p class="empty-sentence">${esc(config.finalCard.previewEmpty)}</p>`}
          <div class="mini-brand"><i></i> Yekigai</div>
        </section>
      </div>

      <div class="page-actions">
        <button class="secondary" data-action="final-back">← ${esc(config.finalCard.back)}</button>
        <button class="primary" data-action="final-continue" ${final ? '' : 'disabled'}>${esc(config.finalCard.continue)} →</button>
      </div>
    </main>
  `
}

function resultHtml() {
  const { config } = state.data
  const final = finalText()

  return `
    <main class="game-shell result-shell">
      <div class="game-head">
        <div>
          <span class="section-kicker">${esc(config.result.kicker)}</span>
          <h1>${esc(config.result.title)}</h1>
          <p>${esc(config.result.text)}</p>
        </div>
      </div>

      <div class="result-grid">
        ${boardHtml({ final })}

        <aside class="takeaway-panel">
          <section class="takeaway-card">
            <span>${esc(config.result.cardLabel)}</span>
            <p>${esc(final)}</p>
            <div class="takeaway-footer"><i></i> Yekigai</div>
          </section>
          <button class="primary export-button" data-action="export">${esc(config.result.export)} ↓</button>
          ${state.exportUrl ? `
            <div class="export-confirmation">
              <strong>${esc(config.result.generated)}</strong>
              <img src="${esc(state.exportUrl)}" alt="Aperçu de la carte Yekigai générée">
            </div>
          ` : ''}
          <button class="text-button centered" data-action="edit-final">${esc(config.finalCard.edit)}</button>
        </aside>
      </div>

      <div class="restart-row">
        <button class="secondary" data-action="restart">↻ ${esc(config.result.restart)}</button>
      </div>
    </main>
  `
}

function mainHtml() {
  switch (state.phase) {
    case 'selection': return selectionHtml()
    case 'intersections': return intersectionsHtml()
    case 'discussion': return discussionHtml()
    case 'final': return finalEditorHtml()
    case 'result': return resultHtml()
    default: return introHtml()
  }
}

function render({ preserveFocus = false } = {}) {
  root.innerHTML = `
    <div class="app">
      <div class="noise"></div>
      ${headerHtml()}
      ${mainHtml()}
      ${footerHtml()}
    </div>
  `

  if (preserveFocus && state.phase === 'final') {
    const textarea = root.querySelector('[data-input="completion"]')
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  }
}

function scrollTop(behavior = 'auto') {
  window.scrollTo({ top: 0, behavior })
}

function startSession() {
  const count = state.data.config.game.cardsDrawnPerDeck
  state.draws = Object.fromEntries(state.data.decks.map((deck) => [deck.id, sample(deck.cards, count)]))
  state.selected = {}
  state.deckIndex = 0
  clearIntersections()
  clearFinalCard()
  state.phase = 'selection'
  render()
  scrollTop()
}

function goToPhase(phase) {
  state.phase = phase
  render()
  scrollTop()
}

function resetIntersections() {
  clearIntersections()
  clearFinalCard()
  render()
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 9) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  })
  if (line) lines.push(line)

  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight))
}

function exportCard() {
  const { config } = state.data
  const text = finalText()
  if (!text) return

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f7f5ef'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#201e28'
  ctx.fillRect(0, 0, canvas.width, 185)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 56px Arial, Helvetica, sans-serif'
  ctx.fillText(config.brand.name, 72, 112)

  ctx.fillStyle = '#efff75'
  ctx.font = '800 22px Arial, Helvetica, sans-serif'
  ctx.fillText(config.result.imageLabel, 790, 108)

  ctx.fillStyle = '#ff7187'
  ctx.fillRect(72, 225, 112, 30)
  ctx.fillStyle = '#efff75'
  ctx.fillRect(150, 270, 145, 30)
  ctx.fillStyle = '#53e6ab'
  ctx.fillRect(850, 1075, 120, 30)
  ctx.fillStyle = '#8d79ff'
  ctx.fillRect(805, 1120, 165, 30)

  ctx.save()
  ctx.shadowColor = '#201e28'
  ctx.shadowOffsetX = 12
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#fffdf8'
  roundRect(ctx, 72, 330, 936, 650, 34)
  ctx.fill()
  ctx.restore()

  ctx.lineWidth = 4
  ctx.strokeStyle = '#201e28'
  roundRect(ctx, 72, 330, 936, 650, 34)
  ctx.stroke()

  ctx.fillStyle = '#6a48f6'
  ctx.font = '800 20px Arial, Helvetica, sans-serif'
  ctx.fillText(config.result.imageKicker, 128, 420)

  ctx.fillStyle = '#201e28'
  ctx.font = '800 50px Arial, Helvetica, sans-serif'
  drawWrappedText(ctx, text, 128, 520, 820, 68, 7)

  ctx.fillStyle = '#716d78'
  ctx.font = '700 21px Arial, Helvetica, sans-serif'
  ctx.fillText(config.result.imageNote, 128, 900)

  ctx.fillStyle = '#201e28'
  ctx.font = '800 26px Arial, Helvetica, sans-serif'
  ctx.fillText(config.footer.imageText, 72, 1260)
  ctx.fillStyle = '#ff7187'
  roundRect(ctx, 438, 1237, 24, 24, 6)
  ctx.fill()

  canvas.toBlob((blob) => {
    if (!blob) return
    if (state.exportUrl) URL.revokeObjectURL(state.exportUrl)
    state.exportUrl = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = state.exportUrl
    anchor.download = config.result.imageFilename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    render()
  }, 'image/png')
}

root.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]')
  if (!target || target.disabled) return
  const action = target.dataset.action

  if (action === 'start' || action === 'restart') {
    startSession()
    return
  }

  if (action === 'select-card') {
    const deck = state.data.decks.find((item) => item.id === target.dataset.deck)
    const card = deck?.cards.find((item) => item.id === target.dataset.id)
    if (!deck || !card) return
    if (state.selected[deck.id]?.id !== card.id) {
      state.selected[deck.id] = card
      clearIntersections()
      clearFinalCard()
    }
    render()
    return
  }

  if (action === 'selection-back') {
    state.deckIndex = Math.max(0, state.deckIndex - 1)
    render()
    scrollTop('smooth')
    return
  }

  if (action === 'selection-next') {
    const deck = currentDeck()
    if (!state.selected[deck.id]) return
    if (state.deckIndex < state.data.decks.length - 1) {
      state.deckIndex += 1
      render()
      scrollTop('smooth')
    } else {
      goToPhase('intersections')
    }
    return
  }

  if (action === 'reset-intersections') {
    resetIntersections()
    return
  }

  if (action === 'select-intersection') {
    const intersection = getIntersection(target.dataset.id)
    if (!intersection) return
    clearFinalCard()

    if (state.intersectionMode === 'today') {
      state.todayIntersection = intersection.id
      state.todayQuestion = pickRandom(intersection.questions.today)
      state.developIntersection = null
      state.developQuestion = ''
      state.intersectionMode = 'develop'
    } else if (intersection.id !== state.todayIntersection) {
      state.developIntersection = intersection.id
      state.developQuestion = pickRandom(intersection.questions.develop)
    }
    render()
    return
  }

  if (action === 'intersections-back') {
    state.deckIndex = state.data.decks.length - 1
    goToPhase('selection')
    return
  }

  if (action === 'intersections-continue') {
    if (!state.todayIntersection || !state.developIntersection) return
    goToPhase('discussion')
    return
  }

  if (action === 'discussion-back') {
    goToPhase('intersections')
    return
  }

  if (action === 'discussion-continue') {
    goToPhase('final')
    return
  }

  if (action === 'select-prompt') {
    clearExport()
    state.promptId = target.dataset.id
    render({ preserveFocus: true })
    return
  }

  if (action === 'final-back') {
    goToPhase('discussion')
    return
  }

  if (action === 'final-continue') {
    if (!finalText()) return
    goToPhase('result')
    return
  }

  if (action === 'edit-final') {
    goToPhase('final')
    return
  }

  if (action === 'export') {
    exportCard()
  }
})

root.addEventListener('input', (event) => {
  if (event.target.matches('[data-input="completion"]')) {
    clearExport()
    state.completion = event.target.value
    const count = root.querySelector('.sentence-editor small')
    if (count) count.textContent = `${state.completion.length} / 220`

    const preview = root.querySelector('.final-card-preview')
    if (preview) {
      const text = finalText()
      const paragraph = preview.querySelector('p')
      if (paragraph) {
        paragraph.textContent = text || state.data.config.finalCard.previewEmpty
        paragraph.classList.toggle('empty-sentence', !text)
      }
      preview.classList.toggle('ready', Boolean(text))
    }

    const continueButton = root.querySelector('[data-action="final-continue"]')
    if (continueButton) continueButton.disabled = !finalText()
  }
})

loadData()
  .then((data) => {
    state.data = data
    render()
  })
  .catch((error) => {
    root.innerHTML = `<div class="status-page"><strong>Impossible de charger Yekigai.</strong><span>${esc(error.message)}</span></div>`
  })
