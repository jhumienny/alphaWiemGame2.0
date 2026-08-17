// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'

const { getMock, updateMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  updateMock: vi.fn().mockResolvedValue(undefined),
}))
const snapshot = (value) => ({ val: () => value })

vi.mock('./firebase', () => ({ auth: {}, database: {} }))
vi.mock('firebase/auth', () => ({
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
      approved1: { q: 'Pytanie zaakceptowane', a: ['C', 'D'], status: 'approved', source: 'user' },
      rejected1: { q: 'Pytanie odrzucone', status: 'rejected' },
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
beforeEach(() => { updateMock.mockClear(); vi.spyOn(window, 'confirm').mockReturnValue(true) })

describe('Admin workspace', () => {
  it('shows data only after the authenticated account has the exact admin role', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Baza pytań' })).toBeInTheDocument()
    expect(screen.getByText('Pytanie z biblioteki')).toBeInTheDocument()
    expect(screen.getByText('Pytanie zaakceptowane')).toBeInTheDocument()
    expect(screen.getByText('Kuba')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
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
    fireEvent.click(screen.getByRole('button', { name: /Propozycje pytań/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Zaakceptuj' }))
    expect(updateMock).toHaveBeenCalled()
  })

  it('shows real pending-question and report counts in navigation', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })
    expect(screen.getByRole('button', { name: /Propozycje pytań\s*1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zgłoszone pytania\s*1/ })).toBeInTheDocument()
  })

  it('organizes navigation into question and player cards, loads player reports, and opens player statistics', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Baza pytań' })

    expect(screen.getByRole('navigation', { name: 'Panel administracyjny' })).toHaveTextContent('Pytania')
    expect(screen.getByRole('navigation', { name: 'Panel administracyjny' })).toHaveTextContent('Gracze')
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
