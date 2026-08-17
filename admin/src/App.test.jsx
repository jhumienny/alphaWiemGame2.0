// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('Admin workspace', () => {
  it('renders the question library by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Pytania' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Szukaj pytania…')).toBeInTheDocument()
  })

  it('changes the workspace content without moving the sidebar', () => {
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Panel administracyjny' })
    const before = sidebar.getBoundingClientRect()

    fireEvent.click(screen.getByRole('button', { name: /Zgłoszenia/ }))

    expect(screen.getByRole('heading', { name: 'Zgłoszenia', level: 1 })).toBeInTheDocument()
    const after = sidebar.getBoundingClientRect()
    expect(after.left).toBe(before.left)
    expect(after.top).toBe(before.top)
  })
})
