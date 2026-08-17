import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { get, ref, update } from 'firebase/database'
import { auth, database } from './firebase'
import { flattenUserQuestions, isAdminRole, questionLibrary } from './adminData'
import './App.css'

const tabs = [
  { id: 'questions', label: 'Pytania' },
  { id: 'pending', label: 'Do zatwierdzenia' },
  { id: 'reports', label: 'Zgłoszenia' },
  { id: 'games', label: 'Gry' },
  { id: 'users', label: 'Użytkownicy' },
]

const copy = {
  questions: { title: 'Pytania', description: 'Biblioteka pytań używana w grze.' },
  pending: { title: 'Do zatwierdzenia', description: 'Pytania oczekujące na decyzję.' },
  reports: { title: 'Zgłoszenia', description: 'Treści zgłoszone podczas rozgrywek.' },
  games: { title: 'Gry', description: 'Rozgrywki i stałe pokoje z bazy.' },
  users: { title: 'Użytkownicy', description: 'Konta, role i statystyki.' },
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    back: <><path d="m14 6-6 6 6 6" /><path d="M8 12h12" /></>,
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

function App() {
  const [tab, setTab] = useState('questions')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [decisionId, setDecisionId] = useState('')
  const [editor, setEditor] = useState(null)
  const [focusedUserId, setFocusedUserId] = useState(null)
  const [data, setData] = useState({ questions: {}, games: {}, permanentRooms: {}, reports: {}, userQuestions: {}, users: {} })

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return redirectToGame()
      try {
        const roleSnapshot = await get(ref(database, `users/${user.uid}/role`))
        if (!isAdminRole(roleSnapshot.val())) return redirectToGame()
        const paths = ['questions', 'games', 'permanentRooms', 'reports', 'userQuestions', 'users']
        const snapshots = await Promise.all(paths.map((path) => get(ref(database, path))))
        if (!active) return
        setData(Object.fromEntries(paths.map((path, index) => [path, snapshots[index].val() || {}])))
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
    await update(ref(database), { [`questions/${editor.id}`]: payload })
    setData((current) => ({ ...current, questions: { ...current.questions, [editor.id]: payload } }))
    setEditor(null)
  }

  async function deleteQuestion(item) {
    if (!window.confirm(`Usunąć pytanie „${item.text}”?`)) return
    await update(ref(database), { [`questions/${item.id}`]: null })
    setData((current) => {
      const questions = { ...current.questions }
      delete questions[item.id]
      return { ...current, questions }
    })
  }

  const submissions = useMemo(() => flattenUserQuestions(data.userQuestions), [data.userQuestions])
  const library = useMemo(() => questionLibrary(data.questions), [data.questions])
  const pending = useMemo(() => submissions.filter((item) => item.status === 'pending'), [submissions])
  const reports = useMemo(() => toEntries(data.reports).sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0)), [data.reports])
  const games = useMemo(() => toEntries(data.games).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)), [data.games])
  const rooms = useMemo(() => toEntries(data.permanentRooms), [data.permanentRooms])
  const users = useMemo(() => toEntries(data.users).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [data.users])
  const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users])
  const visibleUsers = useMemo(() => focusedUserId ? users.filter((user) => user.id === focusedUserId) : users, [users, focusedUserId])
  const filteredLibrary = useMemo(() => library.filter((item) => item.text.toLowerCase().includes(query.toLowerCase())), [library, query])
  const screen = copy[tab]
  const counts = { pending: pending.length, reports: reports.filter((item) => !item.resolved).length }
  const openProfile = (uid) => { if (uid) { setFocusedUserId(uid); setTab('users') } }

  if (status === 'loading') return <main className="access-state">Sprawdzanie dostępu administratora…</main>
  if (status === 'error') return <main className="access-state"><strong>{error}</strong><button type="button" onClick={redirectToGame}>Wróć do gry</button></main>

  return <div className="admin-app">
    <header className="topbar"><a className="brand" href="../">Wiem!</a><span className="topbar-separator" /><span className="topbar-title">Panel zarządzania</span><span className="profile" aria-label="Administrator">A</span></header>
    <div className="app-shell">
      <aside className="sidebar"><button className="back-button" type="button" onClick={redirectToGame}><Icon name="back" /> Wróć do gry</button><nav aria-label="Panel administracyjny"><p className="nav-label">Zarządzanie</p>{tabs.map((item) => <button className={`nav-item ${tab === item.id ? 'is-active' : ''}`} key={item.id} type="button" onClick={() => { setTab(item.id); if (item.id !== 'users') setFocusedUserId(null) }}><span>{item.label}</span>{counts[item.id] ? <span className="nav-count">{counts[item.id]}</span> : null}</button>)}</nav><p className="sidebar-foot">Wiem! · administracja</p></aside>
      <main className="workspace">
        <div className="workspace-heading"><div><h1>{screen.title}</h1><p>{screen.description}</p></div></div>
        {tab === 'questions' && <section aria-label="Lista pytań"><div className="toolbar"><label className="search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj pytania…" /></label><div className="question-toolbar-right"><div className="list-summary"><span>{filteredLibrary.length} pytań w bibliotece</span></div><button className="primary-action" type="button" onClick={startManualQuestion}>Dodaj pytanie</button></div></div><div className="question-list">{filteredLibrary.map((item) => { const author = authorFor(item, usersById); return <article className="question-row" key={item.id}><div className="question-content"><h2>{item.text}</h2><div className="answers">{item.answers.map((answer, index) => <span key={`${item.id}-${index}`}>{answer}</span>)}</div></div><div className="question-details"><span>Dodano: {formatDate(item.approvedAt || item.createdAt)}</span><span>przez <button className="author-link" type="button" onClick={() => openProfile(author.uid)} disabled={!author.uid}>{author.label}</button></span></div><div className="question-actions"><button type="button" onClick={() => setEditor({ ...item, a: [...item.answers], as: [...(item.as || [])], qs: item.qs || '' })}>Edytuj</button><button className="danger-action" type="button" onClick={() => deleteQuestion(item)}>Usuń</button></div></article>})}{!filteredLibrary.length && <p className="empty-copy">Brak pytań w bibliotece.</p>}</div></section>}
        {tab === 'pending' && <List title="Oczekujące pytania" items={pending} render={(item) => <><strong>{item.text}</strong><small>{item.uid} · {formatDate(item.createdAt)}</small><div className="decision-actions"><button type="button" disabled={decisionId === `user-${item.uid}-${item.id}`} onClick={() => decideSubmission(item, 'approved')}>Zaakceptuj</button><button type="button" disabled={decisionId === `user-${item.uid}-${item.id}`} onClick={() => decideSubmission(item, 'rejected')}>Odrzuć</button></div></>} />}
        {tab === 'reports' && <List title="Zgłoszenia" items={reports} render={(item) => <><strong>{item.questionText || item.qText || 'Zgłoszenie bez treści pytania'}</strong><small>{item.status || (item.resolved ? 'rozwiązane' : 'otwarte')} · {formatDate(item.reportedAt)}</small></>} />}
        {tab === 'games' && <><List title="Rozgrywki" items={games} render={(item) => <><strong>{item.id}</strong><small>{item.phase || item.archiveStatus || 'brak statusu'} · {formatDate(item.updatedAt || item.createdAt)}</small></>} /><List title="Stałe pokoje" items={rooms} render={(item) => <><strong>{item.name || item.id}</strong><small>utworzono: {formatDate(item.created)}</small></>} /></>}
        {tab === 'users' && <><div className="user-list-tools">{focusedUserId && <button type="button" onClick={() => setFocusedUserId(null)}>← Wszyscy użytkownicy</button>}</div><List title={focusedUserId ? 'Profil użytkownika' : 'Użytkownicy'} items={visibleUsers} render={(item) => <><strong>{item.displayName || item.username || item.id}</strong><small>{item.role || 'user'} · utworzono: {formatDate(item.createdAt)}</small></>} /></>}
      </main>
    </div>
    {editor && <QuestionEditor editor={editor} onChange={setEditor} onCancel={() => setEditor(null)} onSave={saveQuestion} />}
  </div>
}

function QuestionEditor({ editor, onChange, onCancel, onSave }) {
  const setAnswer = (field, index, value) => { const values = [...editor[field]]; values[index] = value; onChange({ ...editor, [field]: values }) }
  return <div className="editor-backdrop"><form className="question-editor" onSubmit={(event) => { event.preventDefault(); onSave() }}><h2>{editor.isNew ? 'Dodaj pytanie' : 'Edytuj pytanie'}</h2><label>Pytanie dla pozostałych<textarea value={editor.q} onChange={(event) => onChange({ ...editor, q: event.target.value })} /></label><label>Pytanie dla osoby odpowiadającej<textarea value={editor.qs} onChange={(event) => onChange({ ...editor, qs: event.target.value })} /></label>{editor.a.map((answer, index) => <label key={index}>Odpowiedź {index + 1}<input value={answer} onChange={(event) => setAnswer('a', index, event.target.value)} /></label>)}<div className="editor-actions"><button type="button" onClick={onCancel}>Anuluj</button><button className="primary-action" type="submit">Zapisz zmiany</button></div></form></div>
}

function List({ title, items, render }) { return <section className="data-section"><h2>{title}</h2><div className="data-list">{items.map((item) => <article className="data-row" key={item.id}>{render(item)}</article>)}{!items.length && <p className="empty-copy">Brak danych.</p>}</div></section> }
export default App
