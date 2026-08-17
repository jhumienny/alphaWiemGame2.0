// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'

const { updateMock } = vi.hoisted(() => ({ updateMock: vi.fn().mockResolvedValue(undefined) }))
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
  get: async (path) => snapshot({
    'users/admin-uid/role': 'admin',
    questions: {
      base1: { q: 'Pytanie z biblioteki', a: ['A', 'B'], source: 'seed' },
      approved1: { q: 'Pytanie zaakceptowane', a: ['C', 'D'], status: 'approved', source: 'user' },
      rejected1: { q: 'Pytanie odrzucone', status: 'rejected' },
    },
    games: { game1: { phase: 'lobby', createdAt: 10 } },
    permanentRooms: { room1: { name: 'Piątkowa ekipa', created: 20 } },
    reports: { report1: { questionText: 'Zgłoszone pytanie', status: 'open', reportedAt: 30 } },
    userQuestions: { user1: { question1: { q: 'Pytanie od gracza', a: ['A', 'B'], status: 'pending', createdAt: 40 } } },
    users: { 'admin-uid': { username: 'kuba', role: 'admin', createdAt: 50 } },
  }[path] || null),
  update: updateMock,
}))

import App from './App'

afterEach(cleanup)

describe('Admin workspace', () => {
  it('shows data only after the authenticated account has the exact admin role', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Pytania' })).toBeInTheDocument()
    expect(screen.getByText('Pytanie z biblioteki')).toBeInTheDocument()
    expect(screen.getByText('Pytanie zaakceptowane')).toBeInTheDocument()
    expect(screen.queryByText('Pytanie odrzucone')).not.toBeInTheDocument()
  })

  it('moves an accepted submission into the approved question library', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Pytania' })
    fireEvent.click(screen.getByRole('button', { name: /Do zatwierdzenia/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Zaakceptuj' }))
    expect(updateMock).toHaveBeenCalled()
  })

  it('shows real pending-question and report counts in navigation', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Pytania' })
    expect(screen.getByRole('button', { name: /Do zatwierdzenia\s*1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zgłoszenia\s*1/ })).toBeInTheDocument()
  })
})
