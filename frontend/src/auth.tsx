import { createContext, useContext, useState, ReactNode } from 'react'
import { api, tokens, Role, TokenResponse } from './api'

interface AuthState {
  id: string
  role: Role
  displayName: string
}

interface AuthContextValue {
  user: AuthState | null
  login: (usernameOrEmail: string, password: string) => Promise<Role>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function decodeUser(): AuthState | null {
  const access = tokens.access
  if (!access) return null
  try {
    const payload = JSON.parse(atob(access.split('.')[1]))
    return { id: payload.sub, role: payload.role, displayName: payload.name }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(decodeUser())

  const login = async (usernameOrEmail: string, password: string): Promise<Role> => {
    const res: TokenResponse = await api.login(usernameOrEmail, password)
    tokens.save(res)
    setUser({ id: res.id, role: res.role, displayName: res.displayName })
    return res.role
  }

  const logout = () => {
    tokens.clear()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
