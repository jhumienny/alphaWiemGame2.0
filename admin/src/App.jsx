import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { get, ref } from 'firebase/database'
import { auth, database } from './firebase'
import { flattenUserQuestions, isAdminRole } from './adminData'
import './App.css'

const tabs = [
  { id: 'questions', label: 'Pytania' },
  { id: 'pending', label: 'Do zatwierdzenia' },
  { id: 'reports', label: 'Zgłoszenia' },
  { id: 'games', label: 'Gry' },
  { id: 'users', label: 'Użytkownicy' },
]

const copy = {
  questions: { title: 'Pytania', description: 'Własne pytania przesłane do biblioteki.' },
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

function toEntries(value = {}) {
  return Object.entries(value || {}).map(([id, item]) => ({ id, ...(item || {}) }))
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('pl-PL') : '—'
}

function redirectToGame() {
  window.location.replace('../')
}

function App() {
  const [tab, setTab] = useState('questions')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState({ games: {}, permanentRooms: {}, reports: {}, userQuestions: {}, users: {} })

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return redirectToGame()
      try {
        const roleSnapshot = await get(ref(database, `users/${user.uid}/role`))
        if (!isAdminRole(roleSnapshot.val())) return redirectToGame()
        const paths = ['games', 'permanentRooms', 'reports', 'userQuestions', 'users']
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

  const submissions = useMemo(() => flattenUserQuestions(data.userQuestions), [data.userQuestions])
  const pending = useMemo(() => submissions.filter((item) => item.status === 'pending'), [submissions])
  const reports = useMemo(() => toEntries(data.reports).sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0)), [data.reports])
  const games = useMemo(() => toEntries(data.games).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)), [data.games])
  const rooms = useMemo(() => toEntries(data.permanentRooms), [data.permanentRooms])
  const users = useMemo(() => toEntries(data.users).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [data.users])
  const filteredSubmissions = useMemo(() => submissions.filter((item) => item.text.toLowerCase().includes(query.toLowerCase())), [submissions, query])
  const screen = copy[tab]
  const counts = { pending: pending.length, reports: reports.filter((item) => !item.resolved).length }

  if (status === 'loading') return <main className="access-state">Sprawdzanie dostępu administratora…</main>
  if (status === 'error') return <main className="access-state"><strong>{error}</strong><button type="button" onClick={redirectToGame}>Wróć do gry</button></main>

  return (
    <div className="admin-app">
      <header className="topbar">
        <a className="brand" href="../">Wiem!</a>
        <span className="topbar-separator" />
        <span className="topbar-title">Panel zarządzania</span>
        <span className="profile" aria-label="Administrator">A</span>
      </header>
      <div className="app-shell">
        <aside className="sidebar">
          <button className="back-button" type="button" onClick={redirectToGame}><Icon name="back" /> Wróć do gry</button>
          <nav aria-label="Panel administracyjny">
            <p className="nav-label">Zarządzanie</p>
            {tabs.map((item) => <button className={`nav-item ${tab === item.id ? 'is-active' : ''}`} key={item.id} type="button" onClick={() => setTab(item.id)}><span>{item.label}</span>{counts[item.id] ? <span className="nav-count">{counts[item.id]}</span> : null}</button>)}
          </nav>
          <p className="sidebar-foot">Wiem! · administracja</p>
        </aside>
        <main className="workspace">
          <div className="workspace-heading"><div><h1>{screen.title}</h1><p>{screen.description}</p></div></div>
          {tab === 'questions' && <section aria-label="Lista pytań"><label className="search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj pytania…" /></label><div className="list-summary"><span>{filteredSubmissions.length} przesłanych pytań</span></div><div className="question-list">{filteredSubmissions.map((item) => <article className="question-row" key={`${item.uid}/${item.id}`}><div className="question-main"><div className="question-meta"><span>{item.status || 'bez statusu'}</span><span>{formatDate(item.createdAt)}</span></div><h2>{item.text}</h2><div className="answers">{item.answers.map((answer, index) => <span key={`${item.id}-${index}`}>{answer}</span>)}</div></div></article>)}{!filteredSubmissions.length && <p className="empty-copy">Brak pytań w tej sekcji.</p>}</div></section>}
          {tab === 'pending' && <List title="Oczekujące pytania" items={pending} render={(item) => <><strong>{item.text}</strong><small>{item.uid} · {formatDate(item.createdAt)}</small></>} />}
          {tab === 'reports' && <List title="Zgłoszenia" items={reports} render={(item) => <><strong>{item.questionText || item.qText || 'Zgłoszenie bez treści pytania'}</strong><small>{item.status || (item.resolved ? 'rozwiązane' : 'otwarte')} · {formatDate(item.reportedAt)}</small></>} />}
          {tab === 'games' && <><List title="Rozgrywki" items={games} render={(item) => <><strong>{item.id}</strong><small>{item.phase || item.archiveStatus || 'brak statusu'} · {formatDate(item.updatedAt || item.createdAt)}</small></>} /><List title="Stałe pokoje" items={rooms} render={(item) => <><strong>{item.name || item.id}</strong><small>utworzono: {formatDate(item.created)}</small></>} /></>}
          {tab === 'users' && <List title="Użytkownicy" items={users} render={(item) => <><strong>{item.displayName || item.username || item.id}</strong><small>{item.role || 'user'} · utworzono: {formatDate(item.createdAt)}</small></>} />}
        </main>
      </div>
    </div>
  )
}

function List({ title, items, render }) {
  return <section className="data-section"><h2>{title}</h2><div className="data-list">{items.map((item) => <article className="data-row" key={item.id}>{render(item)}</article>)}{!items.length && <p className="empty-copy">Brak danych.</p>}</div></section>
}

export default App
