import { isAdminRole } from './adminData'

export async function resolveAdminAccess(user, readRole) {
  if (!user) return false
  return isAdminRole(await readRole(user.uid))
}
