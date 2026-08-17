import { describe, expect, it, vi } from 'vitest'
import { resolveAdminAccess } from './adminAccess'

describe('resolveAdminAccess', () => {
  it('denies an unauthenticated visitor without reading a role', async () => {
    const readRole = vi.fn()

    await expect(resolveAdminAccess(null, readRole)).resolves.toBe(false)
    expect(readRole).not.toHaveBeenCalled()
  })

  it('denies a moderator and permits an exact admin role', async () => {
    await expect(resolveAdminAccess({ uid: 'moderator-id' }, vi.fn().mockResolvedValue('moderator'))).resolves.toBe(false)
    await expect(resolveAdminAccess({ uid: 'admin-id' }, vi.fn().mockResolvedValue('admin'))).resolves.toBe(true)
  })
})
