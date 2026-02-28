import { useSession } from '@tanstack/react-start/server'
import { getEnvValue, isProductionEnvironment } from '~/server/env'

type SessionData = {
  userId?: string
  email?: string
  role?: string
  oauthState?: string
  oauthRedirectUri?: string
}

export function useAppSession() {
  return useSession<SessionData>({
    name: 'app-session',
    password: getEnvValue('SESSION_SECRET'),
    cookie: {
      secure: isProductionEnvironment(),
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
    },
  })
}
