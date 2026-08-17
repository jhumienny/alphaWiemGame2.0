import { describe, expect, it } from 'vitest'
import { flattenUserQuestions, isAdminRole } from './adminData'

describe('isAdminRole', () => {
  it('allows only the exact admin role', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('moderator')).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
  })
})

describe('flattenUserQuestions', () => {
  it('aggregates nested submissions and returns only pending entries when requested', () => {
    const questions = flattenUserQuestions({
      userA: {
        question1: { q: 'Pierwsze pytanie', status: 'pending', createdAt: 10 },
        question2: { q: 'Zatwierdzone pytanie', status: 'approved', createdAt: 20 },
      },
      userB: {
        question3: { q: 'Drugie oczekujące', status: 'pending', createdAt: 30 },
      },
    })

    expect(questions.map(({ id, uid }) => `${uid}/${id}`)).toEqual([
      'userB/question3',
      'userA/question2',
      'userA/question1',
    ])
    expect(questions.filter(({ status }) => status === 'pending').map(({ text }) => text)).toEqual([
      'Drugie oczekujące',
      'Pierwsze pytanie',
    ])
  })
})
