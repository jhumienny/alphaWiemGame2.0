// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'

const { getMock, updateMock, signOutMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  updateMock: vi.fn().mockResolvedValue(undefined),
  signOutMock: vi.fn().mockResolvedValue(undefined),
}))
const snapshot = (value) => ({ val: () => value })

vi.mock('./firebase', () => ({ auth: {}, database: {} }))
vi.mock('firebase/auth', () => ({
  signOut: signOutMock,
  onAuthStateChanged: (_auth, callback) => {
    callback({ uid: 'admin-uid' })
    return () => {}
  },
}))
vi.mock('firebase/database', () => ({
  ref: (_database, path) => path,
  get: getMock.mockImplementation(async (path) => snapshot({
    'users/admin-uid/role': 'admin',
    questions: {
      base1: { q: 'Pytanie z biblioteki', a: ['A', 'B'], source: 'seed' },
      approved1: { q: 'Pytanie zaakceptowane', a: ['C', 'D'], categoryId: 'cat_impreza', status: 'approved', source: 'user' },
      rejected1: { q: 'Pytanie odrzucone', status: 'rejected' },
    },
    questionCategories: {
      cat_players: { name: 'Kto z graczy' },
      cat_impreza: { name: 'Impreza' },
      cat_zyciowka: { name: 'Życiówka' },
      cat_ambicje: { name: 'Ambicje i cele' },
    },
    games: { game1: { phase: 'lobby', createdAt: 10 } },
    permanentRooms: { room1: { name: 'Piątkowa ekipa', created: 20 } },
    reports: { report1: { questionText: 'Zgłoszone pytanie', status: 'open', reportedAt: 30 } },
    playerReports: { playerReport1: { reportedName: 'Gracz testowy', reporterName: 'Zgłaszający', reason: 'trolling', context: 'game', createdAt: 35 } },
    userQuestions: { user1: { question1: { q: 'Pytanie od gracza', a: ['A', 'B'], status: 'pending', createdAt: 40 } } },
    users: { 'admin-uid': { username: 'kuba', role: 'admin', createdAt: 50 } },
  }[path] || null)),
  update: updateMock,
}))

import App from './App'

afterEach(cleanup)
function installDefaultGetMock() {
  getMock.mockImplementation(async (path) => snapshot({
    'users/admin-uid/role': 'admin',
    questions: {
      base1: { q: 'Pytanie z biblioteki', a: ['A', 'B'], source: 'seed' },
      approved1: { q: 'Pytanie zaakceptowane', a: ['C', 'D'], categoryId: 'cat_impreza', status: 'approved', source: 'user' },
      rejected1: { q: 'Pytanie odrzucone', status: 'rejected' },
    },
    questionCategories: {
      cat_players: { name: 'Kto z graczy' }, cat_impreza: { name: 'Impreza' },
      cat_zyciowka: { name: 'Życiówka' }, cat_ambicje: { name: 'Ambicje i cele' },
    },
    games: { game1: { phase: 'lobby', createdAt: 10 } }, permanentRooms: { room1: { name: 'Piątkowa ekipa', created: 20 } },
    reports: { report1: { questionText: 'Zgłoszone pytanie', status: 'open', reportedAt: 30 } },
    playerReports: { playerReport1: { reportedName: 'Gracz testowy', reporterName: 'Zgłaszający', reason: 'trolling', context: 'game', createdAt: 35 } },
    userQuestions: { user1: { question1: { q: 'Pytanie od gracza', a: ['A', 'B'], status: 'pending', createdAt: 40 } } },
    users: { 'admin-uid': { username: 'kuba', role: 'admin', createdAt: 50 } },
  }[path] || null))
}
beforeEach(() => { getMock.mockClear(); installDefaultGetMock(); updateMock.mockClear(); signOutMock.mockClear(); window.localStorage.clear(); delete document.documentElement.dataset.theme; vi.spyOn(window, 'confirm').mockReturnValue(true) })

describe('Admin workspace', () => {
  it('migrates legacy question labels and seeds only the four default categories', async () => {
    getMock.mockImplementation(async (path) => snapshot({
      'users/admin-uid/role': 'admin',
      questions: {
        players: { q: 'Kto zaczyna?', type: 'players' },
        party: { q: 'Kto tańczy?', cat: 'impreza' },
        unassigned: { q: 'Bez kategorii' },
      },
      questionCategories: {},
      games: {}, permanentRooms: {}, reports: {}, playerReports: {}, userQuestions: {}, users: {},
    }[path] || null))

    render(<App />)
    await screen.findByText('Kto zaczyna?')

    expect(updateMock).toHaveBeenCalledWith(undefined, expect.objectContaining({
      'questionCategories/cat_players': { name: 'Kto z graczy' },
      'questionCategories/cat_impreza': { name: 'Impreza' },
      'questionCategories/cat_zyciowka': { name: 'Życiówka' },
      'questionCategories/cat_ambicje': { name: 'Ambicje i cele' },
      'questions/players/categoryId': 'cat_players',
      'questions/party/categoryId': 'cat_impreza',
    }))
    expect(Object.keys(updateMock.mock.calls[0][1])).not.toContain('questionCategories/cat_demo')
  })

  it('filters questions by an assigned category and by missing category', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    fireEvent.click(screen.getByRole('button', { name: 'Filtruj według kategorii' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Impreza' }))
    expect(screen.getByText('Pytanie zaakceptowane')).toBeInTheDocument()
    expect(screen.queryByText('Pytanie z biblioteki')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Impreza' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bez przypisanej kategorii' }))
    expect(screen.getByText('Pytanie z biblioteki')).toBeInTheDocument()
  })

  it('adds a category and assigns it when creating a question', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    fireEvent.click(screen.getByRole('button', { name: 'Filtruj według kategorii' }))
    fireEvent.change(screen.getByLabelText('Nazwa nowej kategorii'), { target: { value: 'Muzyka' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj kategorię' }))
    expect(updateMock).toHaveBeenCalledWith(undefined, expect.objectContaining({ 'questionCategories/cat_muzyka': { name: 'Muzyka' } }))

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj pytanie' }))
    await screen.findByRole('option', { name: 'Muzyka' })
    fireEvent.change(screen.getByLabelText('Kategoria'), { target: { value: 'cat_muzyka' } })
    fireEvent.change(screen.getByLabelText('Pytanie dla pozostałych'), { target: { value: 'Muzyczne pytanie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    await waitFor(() => expect(Object.entries(updateMock.mock.calls.at(-1)[1]).some(([path, value]) => /^questions\/manual-/.test(path) && value.categoryId === 'cat_muzyka')).toBe(true))
  })

  it('shows data only after the authenticated account has the exact admin role', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Baza pytań' })).toBeInTheDocument()
    expect(screen.getByText('Pytanie z biblioteki')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kuba' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /Edytuj/ })).toHaveLength(2)
    expect(screen.queryByText('Pytanie odrzucone')).not.toBeInTheDocument()
  })

  it('selects questions with checkboxes and deletes the selected Firebase records in one action', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    const checkbox = screen.getByRole('checkbox', { name: 'Zaznacz Pytanie z biblioteki' })
    fireEvent.click(checkbox)
    const deleteSelected = screen.getByRole('button', { name: 'Usuń zaznaczone (1)' })
    expect(deleteSelected).toBeEnabled()
    fireEvent.click(deleteSelected)
    expect(Object.values(updateMock.mock.calls[0][1])[0]).toBeNull()
  })

  it('selects and deselects every visible library question with the toolbar checkbox', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    const selectAll = screen.getByRole('checkbox', { name: 'Zaznacz wszystkie widoczne pytania' })
    fireEvent.click(selectAll)
    expect(screen.getByRole('checkbox', { name: 'Zaznacz Pytanie zaakceptowane' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Zaznacz Pytanie z biblioteki' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Usuń zaznaczone (2)' })).toBeEnabled()
    fireEvent.click(selectAll)
    expect(screen.getByRole('checkbox', { name: 'Zaznacz Pytanie zaakceptowane' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Zaznacz Pytanie z biblioteki' })).not.toBeChecked()
  })

  it('opens manual creation and saves it through Firebase', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj pytanie' }))
    expect(screen.getByRole('heading', { name: 'Dodaj pytanie' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pytanie dla pozostałych'), { target: { value: 'Nowe pytanie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(Object.keys(updateMock.mock.calls[0][1])[0]).toMatch(/^questions\/manual-/)
  })

  it('moves an accepted submission into the approved question library', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    fireEvent.click(screen.getByRole('button', { name: 'Pytania' }))
    fireEvent.click(screen.getByRole('button', { name: /Propozycje pytań/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Zaakceptuj' }))
    expect(updateMock).toHaveBeenCalled()
  })

  it('shows real pending-question and report counts in navigation', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    fireEvent.click(screen.getByRole('button', { name: 'Pytania' }))
    expect(screen.getByRole('button', { name: /Propozycje pytań\s*1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zgłoszone pytania\s*1/ })).toBeInTheDocument()
  })

  it('defaults to dark mode and lets the administrator switch to a persisted light theme', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('menuitem', { name: 'Profil' })).toBeInTheDocument()
    expect(screen.getByText('Kuba', { selector: '.profile-name' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Wyloguj się' })).toBeInTheDocument()
    const themeToggle = screen.getByRole('menuitem', { name: 'Włącz jasny motyw' })
    fireEvent.click(themeToggle)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('wiem-admin-theme')).toBe('light')
    expect(screen.getByRole('menuitem', { name: 'Włącz ciemny motyw' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyloguj się' }))
    expect(signOutMock).toHaveBeenCalledWith({})
  })

  it('starts each grouped navigation card collapsed and expands it with an explicit arrow control', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    const questionsToggle = screen.getByRole('button', { name: 'Pytania' })
    expect(questionsToggle).toHaveAttribute('aria-expanded', 'false')
    const questionMenu = document.getElementById('nav-group-Pytania')
    expect(questionMenu).not.toBeNull()
    expect(questionMenu).toHaveClass('is-collapsed')
    fireEvent.click(questionsToggle)
    expect(questionsToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Baza pytań' })).toBeInTheDocument()
    fireEvent.click(questionsToggle)
    expect(questionMenu).toHaveClass('is-collapsed')
    expect(questionMenu).toHaveAttribute('aria-hidden', 'true')
  })

  it('organizes navigation into question and player cards, loads player reports, and opens player statistics', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })

    expect(screen.getByRole('navigation', { name: 'Panel administracyjny' })).toHaveTextContent('Pytania')
    expect(screen.getByRole('navigation', { name: 'Panel administracyjny' })).toHaveTextContent('Gracze')
    fireEvent.click(screen.getByRole('button', { name: 'Gracze' }))
    expect(screen.getByRole('button', { name: /Zgłoszeni gracze/ })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('playerReports')

    fireEvent.click(screen.getByRole('button', { name: /Zgłoszeni gracze\s*1/ }))
    expect(await screen.findByRole('heading', { name: 'Zgłoszeni gracze', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Gracz testowy')).toBeInTheDocument()
    expect(screen.getByText(/Zgłosił\/a: Zgłaszający/)).toBeInTheDocument()
    expect(screen.getByText(/trolling/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Statystyki graczy' }))
    expect(await screen.findByRole('heading', { name: 'Statystyki graczy' })).toBeInTheDocument()
    expect(screen.getByText('Łącznie graczy')).toBeInTheDocument()
  })
})
