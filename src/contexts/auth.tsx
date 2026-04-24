import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { currentUserQueryOptions } from '~/features/auth/currentUserQuery'

type User = {
  id: string
  email: string
  role?: string
}

type AuthContextType = {
  user: User | null | undefined
  error: Error | null
  isLoading: boolean
  refetch: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, error, isLoading, refetch } = useQuery<User | null>(currentUserQueryOptions)

  return (
    <AuthContext.Provider value={{ user, error, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
