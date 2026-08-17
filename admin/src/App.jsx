import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { get, ref, update } from 'firebase/database'
import { auth, database } from './firebase'
import { flattenUserQuestions, isAdminRole, questionLibrary } from './adminData'
import './App.css'

const defaultQuestionCategories = {
  cat_players: { name: 'Kto z graczy' },
  cat_impreza: { name: 'Impreza' },
  cat_zyciowka: { name: 'Życiówka' },
  cat_ambicje: { name: 'Ambicje i cele' },
}

const navigationGroups = [
  {
    title: 'Pytania',
    items: [
      { id: 'questions', label: 'Baza pytań' },
      { id: 'pending', label: 'Propozycje pytań' },
      { id: 'reports', label: 'Zgłoszone pytania' },
    ],
  },
  {
    title: 'Gracze',
    items: [
      { id: 'users', label: 'Baza graczy' },
      { id: 'playerReports', label: 'Zgłoszeni gracze' },
    ],
  },
]

const utilityNavigation = [
  { id: 'games', label: 'Baza rozegranych gier' },
  { id: 'stats', label: 'Statystyki graczy' },
]

const copy = {
  questions: { title: 'Baza pytań', description: 'Biblioteka pytań używana w grze.' },
  pending: { title: 'Propozycje pytań', description: 'Pytania przesłane przez graczy i oczekujące na decyzję.' },
  reports: { title: 'Zgłoszone pytania', description: 'Treści zgłoszone podczas rozgrywek.' },
  users: { title: 'Baza graczy', description: 'Konta, role i dane graczy.' },
  playerReports: { title: 'Zgłoszeni gracze', description: 'Zgłoszenia dotyczące zachowania lub profili graczy.' },
  games: { title: 'Baza rozegranych gier', description: 'Rozgrywki i stałe pokoje zapisane w bazie.' },
  stats: { title: 'Statystyki graczy', description: 'Zestawienie wyliczane na podstawie danych kont graczy.' },
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    back: <><path d="m14 6-6 6 6 6" /><path d="M8 12h12" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function toEntries(value = {}) { return Object.entries(value || {}).map(([id, item]) => ({ id, ...(item || {}) })) }
function formatDate(value) { return value ? new Date(value).toLocaleString('pl-PL') : 'import początkowy' }
function redirectToGame() { window.location.replace('../') }
function authorFor(item, usersById) {
  const uid = item.authorUid || item.uid
  const account = uid ? usersById[uid] : null
  if (account) return { uid, label: account.displayName || account.username || 'Użytkownik' }
  if (item.source === 'user') return { uid, label: String(item.authorEmail || 'Użytkownik').replace(/@wiem\.click$/, '') }
  return { uid: null, label: 'Kuba' }
}
function userMetric(user, names) {
  const sources = [user.stats, user.statistics, user]
  for (const source of sources) {
    for (const name of names) {
      const value = Number(source?.[name])
      if (Number.isFinite(value)) return value
    }
  }
  return 0
}

function legacyCategoryFor(question) {
  if (question?.categoryId) return question.categoryId
  if (question?.type === 'players') return 'cat_players'
  if (question?.cat === 'impreza') return 'cat_impreza'
  if (question?.cat === 'zyciowka') return 'cat_zyciowka'
  if (question?.cat === 'ambicje') return 'cat_ambicje'
  return ''
}

function categoryIdFromName(name) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return slug ? `cat_${slug}` : ''
}

function App() {
  const [tab, setTab] = useState('questions')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [decisionId, setDecisionId] = useState('')
  const [editor, setEditor] = useState(null)
  const [focusedUserId, setFocusedUserId] = useState(null)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(() => new Set())
  const selectAllQuestionsRef = useRef(null)
  const categoryFilterRef = useRef(null)
  const [expandedGroups, setExpandedGroups] = useState(() => ({ Pytania: false, Gracze: false }))
  const [theme, setTheme] = useState(() => window.localStorage.getItem('wiem-admin-theme') || 'dark')
  document.documentElement.dataset.theme = theme
  const [data, setData] = useState({ questions: {}, questionCategories: {}, games: {}, permanentRooms: {}, reports: {}, playerReports: {}, userQuestions: {}, users: {} })
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('wiem-admin-theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return redirectToGame()
      try {
        const roleSnapshot = await get(ref(database, `users/${user.uid}/role`))
        if (!isAdminRole(roleSnapshot.val())) return redirectToGame()
        const paths = ['questions', 'questionCategories', 'games', 'permanentRooms', 'reports', 'playerReports', 'userQuestions', 'users']
        const snapshots = await Promise.all(paths.map((path) => get(ref(database, path))))
        if (!active) return
        const loaded = Object.fromEntries(paths.map((path, index) => [path, snapshots[index].val() || {}]))
        const migration = {}
        for (const [id, category] of Object.entries(defaultQuestionCategories)) {
          if (!loaded.questionCategories[id]) migration[`questionCategories/${id}`] = category
        }
        for (const [id, question] of Object.entries(loaded.questions)) {
          const categoryId = legacyCategoryFor(question)
          if (categoryId && !question.categoryId) migration[`questions/${id}/categoryId`] = categoryId
        }
        if (Object.keys(migration).length) await update(ref(database), migration)
        if (!active) return
        loaded.questionCategories = { ...defaultQuestionCategories, ...loaded.questionCategories }
        loaded.questions = Object.fromEntries(Object.entries(loaded.questions).map(([id, question]) => [id, { ...question, categoryId: question.categoryId || legacyCategoryFor(question) }]))
        setData(loaded)
        setStatus('ready')
      } catch {
        if (!active) return
        setError('Nie udało się pobrać danych panelu.')
        setStatus('error')
      }
    })
    return () => { active = false; unsubscribe() }
  }, [])

  async function decideSubmission(item, decision) {
    const key = `user-${item.uid}-${item.id}`
    setDecisionId(key)
    try {
      const changes = { [`userQuestions/${item.uid}/${item.id}/status`]: decision }
      if (decision === 'approved') changes[`questions/${key}`] = { ...item, authorUid: item.uid, status: 'approved', source: 'user', approvedAt: Date.now() }
      await update(ref(database), changes)
      setData((current) => {
        const next = structuredClone(current)
        next.userQuestions[item.uid][item.id].status = decision
        if (decision === 'approved') next.questions[key] = changes[`questions/${key}`]
        return next
      })
    } catch { setError('Nie udało się zapisać decyzji.') } finally { setDecisionId('') }
  }

  function startManualQuestion() {
    setEditor({ id: `manual-${Date.now()}`, q: '', qs: '', a: ['', '', ''], as: ['', '', ''], type: 'custom', status: 'approved', source: 'admin', createdAt: Date.now(), isNew: true })
  }

  async function saveQuestion() {
    if (!editor?.q.trim()) return
    const payload = { ...editor, q: editor.q.trim(), qs: editor.qs.trim(), a: editor.a.map((answer) => answer.trim()), as: editor.as.map((answer) => answer.trim()) }
    delete payload.id
    delete payload.isNew
    try {
      await update(ref(database), { [`questions/${editor.id}`]: payload })
      setData((current) => ({ ...current, questions: { ...current.questions, [editor.id]: payload } }))
      setEditor(null)
    } catch { setError('Nie udało się zapisać pytania.') }
  }

  async function addCategory(event) {
    event.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    const id = categoryIdFromName(name)
    if (!id) return
    if (data.questionCategories[id]) {
      setError('Kategoria o takiej nazwie już istnieje.')
      return
    }
    const category = { name }
    try {
      await update(ref(database), { [`questionCategories/${id}`]: category })
      setData((current) => ({ ...current, questionCategories: { ...current.questionCategories, [id]: category } }))
      setNewCategoryName('')
      setCategoryFilter(id)
    } catch { setError('Nie udało się dodać kategorii.') }
  }

  function toggleQuestion(id) {
    setSelectedQuestionIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisibleQuestions() {
    const visibleIds = filteredLibrary.map((item) => item.id)
    setSelectedQuestionIds((current) => {
      const next = new Set(current)
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
      visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  async function deleteSelectedQuestions() {
    if (!selectedQuestionIds.size || !window.confirm(`Usunąć zaznaczone pytania (${selectedQuestionIds.size})?`)) return
    const changes = Object.fromEntries([...selectedQuestionIds].map((id) => [`questions/${id}`, null]))
    await update(ref(database), changes)
    setData((current) => {
      const questions = { ...current.questions }
      selectedQuestionIds.forEach((id) => delete questions[id])
      return { ...current, questions }
    })
    setSelectedQuestionIds(new Set())
  }

  const submissions = useMemo(() => flattenUserQuestions(data.userQuestions), [data.userQuestions])
  const library = useMemo(() => questionLibrary(data.questions), [data.questions])
  const pending = useMemo(() => submissions.filter((item) => item.status === 'pending'), [submissions])
  const reports = useMemo(() => toEntries(data.reports).sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0)), [data.reports])
  const playerReports = useMemo(() => toEntries(data.playerReports).sort((a, b) => (b.reportedAt || b.createdAt || 0) - (a.reportedAt || a.createdAt || 0)), [data.playerReports])
  const games = useMemo(() => toEntries(data.games).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)), [data.games])
  const rooms = useMemo(() => toEntries(data.permanentRooms), [data.permanentRooms])
  const users = useMemo(() => toEntries(data.users).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [data.users])
  const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users])
  const visibleUsers = useMemo(() => focusedUserId ? users.filter((user) => user.id === focusedUserId) : users, [users, focusedUserId])
  const categories = useMemo(() => Object.entries(data.questionCategories).map(([id, category]) => ({ id, ...category })).sort((a, b) => a.name.localeCompare(b.name, 'pl')), [data.questionCategories])
  const filteredLibrary = useMemo(() => library.filter((item) => item.text.toLowerCase().includes(query.toLowerCase()) && (!categoryFilter || (categoryFilter === '__unassigned__' ? !item.categoryId : item.categoryId === categoryFilter))), [library, query, categoryFilter])
  const allVisibleQuestionsSelected = filteredLibrary.length > 0 && filteredLibrary.every((item) => selectedQuestionIds.has(item.id))
  const someVisibleQuestionsSelected = filteredLibrary.some((item) => selectedQuestionIds.has(item.id))
  useEffect(() => {
    if (selectAllQuestionsRef.current) selectAllQuestionsRef.current.indeterminate = someVisibleQuestionsSelected && !allVisibleQuestionsSelected
  }, [someVisibleQuestionsSelected, allVisibleQuestionsSelected])
  useEffect(() => {
    if (!isCategoryFilterOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!categoryFilterRef.current?.contains(event.target)) setIsCategoryFilterOpen(false)
    }
    document.addEventListener('click', closeOnOutsideClick)
    return () => document.removeEventListener('click', closeOnOutsideClick)
  }, [isCategoryFilterOpen])
  const playerStats = useMemo(() => ({
    playerCount: users.length,
    adminCount: users.filter((user) => user.role === 'admin').length,
    gamesPlayed: users.reduce((total, user) => total + userMetric(user, ['gamesPlayed', 'games', 'playedGames']), 0),
    wins: users.reduce((total, user) => total + userMetric(user, ['wins', 'wonGames', 'victories']), 0),
  }), [users])
  const screen = copy[tab]
  const counts = { pending: pending.length, reports: reports.filter((item) => !item.resolved).length, playerReports: playerReports.filter((item) => !item.resolved).length }
  const openProfile = (uid) => { if (uid) { setFocusedUserId(uid); setTab('users') } }
  const selectTab = (id) => { setTab(id); if (id !== 'users') setFocusedUserId(null) }
  const toggleGroup = (title) => setExpandedGroups((current) => ({ ...current, [title]: !current[title] }))

  if (status === 'loading') return <main className="access-state">Sprawdzanie dostępu administratora…</main>
  if (status === 'error') return <main className="access-state"><strong>{error}</strong><button type="button" onClick={redirectToGame}>Wróć do gry</button></main>

  return <div className="admin-app">
    <header className="topbar"><a className="brand" href="../">Wiem!</a><span className="topbar-separator" /><span className="topbar-title">Panel zarządzania</span><div className="profile-menu"><button className="profile" type="button" aria-label="Administrator">A</button><div className="profile-dropdown" role="menu"><div className="profile-menu-header"><span className="profile-name">Kuba</span><button className="profile-theme" type="button" role="menuitem" aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button></div><button type="button" role="menuitem">Profil</button><button className="logout-action" type="button" role="menuitem" onClick={() => signOut(auth)}>Wyloguj się</button></div></div></header>
    <div className="app-shell">
      <aside className="sidebar"><button className="back-button" type="button" onClick={redirectToGame}><Icon name="back" /> Wróć do gry</button><nav aria-label="Panel administracyjny">{navigationGroups.map((group) => <section className={`nav-card ${expandedGroups[group.title] ? '' : 'is-collapsed'}`} key={group.title}><button className="nav-group-toggle" type="button" aria-expanded={expandedGroups[group.title]} aria-controls={`nav-group-${group.title}`} onClick={() => toggleGroup(group.title)}><span>{group.title}</span><span className="nav-group-chevron"><Icon name="chevron" /></span></button><div className={`nav-group-items ${expandedGroups[group.title] ? '' : 'is-collapsed'}`} id={`nav-group-${group.title}`} aria-hidden={!expandedGroups[group.title]}><div className="nav-group-items-inner">{group.items.map((item) => <NavButton item={item} tab={tab} count={counts[item.id]} onSelect={selectTab} key={item.id} />)}</div></div></section>)}<div className="nav-utilities">{utilityNavigation.map((item) => <NavButton item={item} tab={tab} count={counts[item.id]} onSelect={selectTab} key={item.id} />)}</div></nav><p className="sidebar-foot">Wiem! · administracja</p></aside>
      <main className="workspace">
        <div className="workspace-heading"><div><h1>{screen.title}</h1><p>{screen.description}</p></div></div>
        {tab === 'questions' && <section aria-label="Lista pytań"><div className="toolbar"><div className="question-toolbar-left"><label className="select-all-questions" title="Zaznacz wszystkie widoczne pytania"><input ref={selectAllQuestionsRef} type="checkbox" checked={allVisibleQuestionsSelected} disabled={!filteredLibrary.length} onChange={toggleVisibleQuestions} aria-label="Zaznacz wszystkie widoczne pytania" /></label><label className="search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj pytania…" /></label><CategoryFilter containerRef={categoryFilterRef} categories={categories} value={categoryFilter} isOpen={isCategoryFilterOpen} newCategoryName={newCategoryName} onToggle={() => setIsCategoryFilterOpen((open) => !open)} onSelect={(id) => { setCategoryFilter(id); setIsCategoryFilterOpen(false) }} onNameChange={setNewCategoryName} onAdd={addCategory} /></div><div className="question-toolbar-right"><div className="list-summary"><span>{filteredLibrary.length} pytań w bibliotece</span></div><button className="bulk-delete" type="button" disabled={!selectedQuestionIds.size} onClick={deleteSelectedQuestions}>Usuń zaznaczone ({selectedQuestionIds.size})</button><button className="primary-action" type="button" onClick={startManualQuestion}>Dodaj pytanie</button></div></div><div className="question-list">{filteredLibrary.map((item) => { const author = authorFor(item, usersById); return <article className={`question-row ${selectedQuestionIds.has(item.id) ? 'is-selected' : ''}`} key={item.id}><label className="question-check"><input type="checkbox" checked={selectedQuestionIds.has(item.id)} onChange={() => toggleQuestion(item.id)} aria-label={`Zaznacz ${item.text}`} /></label><div className="question-content"><h2>{item.text}</h2><div className="answers">{item.answers.map((answer, index) => <span key={`${item.id}-${index}`}>{answer}</span>)}</div></div><div className="question-details"><span>Dodano: {formatDate(item.approvedAt || item.createdAt)}</span><span>przez <button className="author-link" type="button" onClick={() => openProfile(author.uid)} disabled={!author.uid}>{author.label}</button></span></div><div className="question-actions"><button type="button" aria-label={`Edytuj ${item.text}`} onClick={() => setEditor({ ...item, a: [...item.answers], as: [...(item.as || [])], qs: item.qs || '' })}>Edytuj</button></div></article>})}{!filteredLibrary.length && <p className="empty-copy">Brak pytań w bibliotece.</p>}</div></section>}
        {tab === 'pending' && <List title="Oczekujące propozycje" items={pending} render={(item) => <><strong>{item.text}</strong><small>{item.uid} · {formatDate(item.createdAt)}</small><div className="decision-actions"><button type="button" disabled={decisionId === `user-${item.uid}-${item.id}`} onClick={() => decideSubmission(item, 'approved')}>Zaakceptuj</button><button type="button" disabled={decisionId === `user-${item.uid}-${item.id}`} onClick={() => decideSubmission(item, 'rejected')}>Odrzuć</button></div></>} />}
        {tab === 'reports' && <List title="Zgłoszone pytania" items={reports} render={(item) => <><strong>{item.questionText || item.qText || 'Zgłoszenie bez treści pytania'}</strong><small>{item.status || (item.resolved ? 'rozwiązane' : 'otwarte')} · {formatDate(item.reportedAt)}</small></>} />}
        {tab === 'playerReports' && <List title="Zgłoszeni gracze" items={playerReports} render={(item) => <><strong>{item.reportedName || item.reportedUserId || item.userId || item.uid || 'Nieznany gracz'}</strong><small>Zgłosił/a: {item.reporterName || 'nieznany gracz'} · {item.reason || 'bez wskazania powodu'} · {item.context === 'lobby' ? 'lobby' : 'rozgrywka'} · {item.status || (item.resolved ? 'rozwiązane' : 'otwarte')} · {formatDate(item.reportedAt || item.createdAt)}</small></>} />}
        {tab === 'games' && <><List title="Rozegrane gry" items={games} render={(item) => <><strong>{item.name || item.id}</strong><small>{item.phase || item.archiveStatus || 'brak statusu'} · {formatDate(item.updatedAt || item.createdAt)}</small></>} /><List title="Stałe pokoje" items={rooms} render={(item) => <><strong>{item.name || item.id}</strong><small>utworzono: {formatDate(item.created || item.createdAt)}</small></>} /></>}
        {tab === 'users' && <><div className="user-list-tools">{focusedUserId && <button type="button" onClick={() => setFocusedUserId(null)}>← Wszyscy gracze</button>}</div><List title={focusedUserId ? 'Profil gracza' : 'Gracze'} items={visibleUsers} render={(item) => <><strong>{item.displayName || item.username || item.id}</strong><small>{item.role || 'gracz'} · utworzono: {formatDate(item.createdAt)}</small></>} /></>}
        {tab === 'stats' && <Stats stats={playerStats} />}
      </main>
    </div>
    {editor && <QuestionEditor categories={categories} editor={editor} onChange={setEditor} onCancel={() => setEditor(null)} onSave={saveQuestion} />}
  </div>
}

function CategoryFilter({ containerRef, categories, value, isOpen, newCategoryName, onToggle, onSelect, onNameChange, onAdd }) {
  const selectedLabel = value === '__unassigned__' ? 'Bez kategorii' : categories.find((category) => category.id === value)?.name || 'Wszystkie kategorie'
  return <div className="category-filter" ref={containerRef}><button className="category-filter-toggle" type="button" aria-label="Filtruj według kategorii" aria-expanded={isOpen} onClick={onToggle}><span>{selectedLabel}</span><span className="category-filter-arrows" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="m3 4 3-3 3 3" /><path d="m3 8 3 3 3-3" /></svg></span></button>{isOpen && <div className="category-filter-panel"><button type="button" className={!value ? 'is-selected' : ''} onClick={() => onSelect('')}>Wszystkie kategorie</button><button type="button" className={value === '__unassigned__' ? 'is-selected' : ''} onClick={() => onSelect('__unassigned__')}>Bez przypisanej kategorii</button>{categories.map((category) => <button type="button" className={value === category.id ? 'is-selected' : ''} key={category.id} onClick={() => onSelect(category.id)}>{category.name}</button>)}<form onSubmit={onAdd}><input aria-label="Nazwa nowej kategorii" autoComplete="off" name="new-question-category" data-1p-ignore="true" value={newCategoryName} onChange={(event) => onNameChange(event.target.value)} placeholder="Nowa kategoria" /><button type="submit">Dodaj kategorię</button></form></div>}</div>
}
function NavButton({ item, tab, count, onSelect }) { return <button className={`nav-item ${tab === item.id ? 'is-active' : ''}`} type="button" onClick={() => onSelect(item.id)}><span>{item.label}</span>{count ? <span className="nav-count">{count}</span> : null}</button> }
function Stats({ stats }) { return <section className="stats-grid" aria-label="Podsumowanie statystyk graczy"><article><span>Łącznie graczy</span><strong>{stats.playerCount}</strong></article><article><span>Administratorzy</span><strong>{stats.adminCount}</strong></article><article><span>Rozegrane gry</span><strong>{stats.gamesPlayed}</strong></article><article><span>Wygrane</span><strong>{stats.wins}</strong></article></section> }
function QuestionEditor({ categories, editor, onChange, onCancel, onSave }) { const setAnswer = (field, index, value) => { const values = [...editor[field]]; values[index] = value; onChange({ ...editor, [field]: values }) }; return <div className="editor-backdrop"><form className="question-editor" onSubmit={(event) => { event.preventDefault(); onSave() }}><h2>{editor.isNew ? 'Dodaj pytanie' : 'Edytuj pytanie'}</h2><label>Kategoria<select value={editor.categoryId || ''} onChange={(event) => onChange({ ...editor, categoryId: event.target.value })}><option value="">Bez przypisanej kategorii</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Pytanie dla pozostałych<textarea value={editor.q} onChange={(event) => onChange({ ...editor, q: event.target.value })} /></label><label>Pytanie dla osoby odpowiadającej<textarea value={editor.qs} onChange={(event) => onChange({ ...editor, qs: event.target.value })} /></label>{editor.a.map((answer, index) => <label key={index}>Odpowiedź {index + 1}<input value={answer} onChange={(event) => setAnswer('a', index, event.target.value)} /></label>)}<div className="editor-actions"><button type="button" onClick={onCancel}>Anuluj</button><button className="primary-action" type="submit">Zapisz zmiany</button></div></form></div> }
function List({ title, items, render }) { return <section className="data-section"><h2>{title}</h2><div className="data-list">{items.map((item) => <article className="data-row" key={item.id}>{render(item)}</article>)}{!items.length && <p className="empty-copy">Brak danych.</p>}</div></section> }
export default App
