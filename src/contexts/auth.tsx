import { createContext, useContext, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUserFn } from '~/server/auth'

type User = {
  id: string
  email: string
  role?: string
}

type AuthContextType = {
  user: User | null | undefined
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery<User | null>({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserFn,
    staleTime: Infinity,
  })

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
