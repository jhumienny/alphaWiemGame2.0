import { useMemo, useState } from 'react'
import './App.css'

const tabs = [
  { id: 'questions', label: 'Pytania' },
  { id: 'pending', label: 'Do zatwierdzenia', count: 3 },
  { id: 'reports', label: 'Zgłoszenia', count: 2 },
  { id: 'games', label: 'Gry' },
  { id: 'users', label: 'Użytkownicy' },
]

const questions = [
  { id: 1, category: 'Demo', text: 'Co [imię] robi, gdy jest mu/jej nudno na imprezie?', answers: ['Scrolluje telefon w kącie', 'Udaje, że dobrze się bawi', 'Szczerze mówi, że jedzie do domu'] },
  { id: 2, category: 'Impreza', text: 'Jaki utwór [imię] włącza, kiedy przejmuje muzykę?', answers: ['Klasyk sprzed lat', 'Coś, co zna tylko on/ona', 'Największy hit wieczoru'] },
  { id: 3, category: 'Życiówka', text: 'Z czego [imię] jest najbardziej dumny/a?', answers: ['Z małych rzeczy', 'Z pracy, którą wykonał/a', 'Z tego, że dotarł/a na czas'] },
  { id: 4, category: 'Kto z graczy', text: 'Kto pierwszy zaproponuje wspólne zdjęcie?', answers: ['[imię]', 'Osoba z najnowszym telefonem', 'Nikt — wszyscy zapomną'] },
  { id: 5, category: 'Ambicje i cele', text: 'Jaki cel [imię] zapisuje na nowy rok?', answers: ['Mniej odkładać na później', 'Nauczyć się czegoś nowego', 'Wreszcie odpocząć'] },
]

const copy = {
  questions: { title: 'Pytania', description: 'Biblioteka pytań dostępna podczas gry.' },
  pending: { title: 'Do zatwierdzenia', description: 'Pytania przesłane przez społeczność.' },
  reports: { title: 'Zgłoszenia', description: 'Treści, które wymagają sprawdzenia.' },
  games: { title: 'Gry', description: 'Archiwum zakończonych rozgrywek.' },
  users: { title: 'Użytkownicy', description: 'Konta korzystające z własnych pytań i statystyk.' },
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    back: <><path d="m14 6-6 6 6 6" /><path d="M8 12h12" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [tab, setTab] = useState('questions')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Wszystkie')
  const [selected, setSelected] = useState(new Set())
  const categories = ['Wszystkie', ...new Set(questions.map((question) => question.category))]
  const visibleQuestions = useMemo(() => questions.filter((question) => {
    const matchesCategory = category === 'Wszystkie' || question.category === category
    const matchesSearch = question.text.toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesSearch
  }), [category, query])
  const screen = copy[tab]

  const toggleQuestion = (id) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="admin-app">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>Wiem!</a>
        <span className="topbar-separator" />
        <span className="topbar-title">Panel zarządzania</span>
        <button className="profile" type="button" aria-label="Ustawienia konta">A</button>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <button className="back-button" type="button"><Icon name="back" /> Wróć do gry</button>
          <nav aria-label="Panel administracyjny">
            <p className="nav-label">Zarządzanie</p>
            {tabs.map((item) => (
              <button
                className={`nav-item ${tab === item.id ? 'is-active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
              >
                <span>{item.label}</span>
                {item.count ? <span className="nav-count">{item.count}</span> : null}
              </button>
            ))}
          </nav>
          <p className="sidebar-foot">Wiem! · administracja</p>
        </aside>

        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <h1>{screen.title}</h1>
              <p>{screen.description}</p>
            </div>
            {tab === 'questions' ? <button className="primary-action" type="button">Dodaj pytanie</button> : null}
          </div>

          {tab === 'questions' ? (
            <section aria-label="Lista pytań">
              <div className="toolbar">
                <div className="filters" aria-label="Kategorie pytań">
                  {categories.map((item) => (
                    <button className={`filter ${category === item ? 'is-active' : ''}`} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>
                  ))}
                </div>
                <label className="search">
                  <Icon name="search" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj pytania…" />
                </label>
              </div>

              <div className="list-summary"><span>{visibleQuestions.length} pytań</span>{selected.size ? <span>{selected.size} zaznaczone</span> : null}</div>
              <div className="question-list">
                {visibleQuestions.map((question) => (
                  <article className="question-row" key={question.id}>
                    <input aria-label={`Wybierz pytanie ${question.id}`} checked={selected.has(question.id)} onChange={() => toggleQuestion(question.id)} type="checkbox" />
                    <div className="question-main">
                      <div className="question-meta"><span>#{question.id}</span><span className="category">{question.category}</span></div>
                      <h2>{question.text}</h2>
                      <div className="answers">{question.answers.map((answer) => <span key={answer}>{answer}</span>)}</div>
                    </div>
                    <button className="row-menu" aria-label={`Opcje pytania ${question.id}`} type="button"><Icon name="more" /></button>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="empty-state">
              <div className="empty-mark" aria-hidden="true" />
              <h2>{screen.title}</h2>
              <p>Ten widok jest gotowy na podłączenie danych z obecnego panelu.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
