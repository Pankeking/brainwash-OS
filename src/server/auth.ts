import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getEnvValue, getOptionalEnvValue } from './env'

type GitHubProfile = {
  id: number | string
  login?: string
  name?: string
  email?: string | null
  avatar_url?: string
  accessToken: string
  refreshToken?: string
  tokenType?: string
  scope?: string
  idToken?: string
  expiresIn?: number
}

const DEFAULT_POST_LOGIN_REDIRECT = '/workout'

async function getAppSession() {
  const { useAppSession } = await import('~/utils/session')
  return useAppSession()
}

function generateRandomState(length: number = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function generateGitHubOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'user:email',
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

const getAppUrlFromRequest = createServerOnlyFn(async () => {
  const configuredAppUrl = getOptionalEnvValue('APP_URL')
  if (configuredAppUrl) {
    return configuredAppUrl.replace(/\/+$/, '')
  }

  const { getRequestUrl } = await import('@tanstack/react-start/server')
  const requestUrl = getRequestUrl({
    xForwardedHost: true,
    xForwardedProto: true,
  })
  return requestUrl.origin
})

function sanitizePostLoginRedirect(value?: string) {
  if (!value) {
    return DEFAULT_POST_LOGIN_REDIRECT
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_POST_LOGIN_REDIRECT
  }
  return value.slice(0, 500)
}

export const initiateOAuthFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      provider: z.literal('github'),
      redirectTo: z.string().min(1).max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    return startGitHubOAuth(data.redirectTo)
  })

async function startGitHubOAuth(redirectTo?: string) {
  const GITHUB_CLIENT_ID = getEnvValue('GITHUB_CLIENT_ID')
  const REDIRECT_URI = `${await getAppUrlFromRequest()}/auth/github/callback`

  const state = generateRandomState()

  const session = await getAppSession()
  await session.update({
    oauthState: state,
    postLoginRedirect: sanitizePostLoginRedirect(redirectTo),
  })

  const authUrl = generateGitHubOAuthUrl(GITHUB_CLIENT_ID, REDIRECT_URI, state)

  return { url: authUrl }
}

async function authenticateGitHubUser(githubProfile: GitHubProfile) {
  const [{ default: connectDB }, { UserModel }] = await Promise.all([
    import('./db'),
    import('~/models/User.model'),
  ])

  await connectDB()

  const user = await UserModel.findOneAndUpdate(
    {
      provider: 'github',
      providerUserId: String(githubProfile.id),
    },
    {
      username:
        githubProfile.login ||
        githubProfile.name ||
        githubProfile.email ||
        `github_${githubProfile.id}`,
      email: githubProfile.email || undefined,
      avatarUrl: githubProfile.avatar_url || undefined,
      provider: 'github',
      providerUserId: String(githubProfile.id),
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      returnDocument: 'after',
    },
  )

  return user
}

export const githubAuthCallbackFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    return completeGitHubOAuth(data)
  })

async function completeGitHubOAuth(data: { code: string; state: string }) {
  const session = await getAppSession()
  const oauthRedirectUri = `${await getAppUrlFromRequest()}/auth/github/callback`
  const postLoginRedirect = sanitizePostLoginRedirect(session.data.postLoginRedirect)

  if (!data.code || !data.state || data.state !== session.data.oauthState) {
    throw new Error('Invalid GitHub login state')
  }

  const tokenExchangeResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: getEnvValue('GITHUB_CLIENT_ID'),
      client_secret: getEnvValue('GITHUB_CLIENT_SECRET'),
      code: data.code,
      redirect_uri: oauthRedirectUri,
    }),
  })

  if (!tokenExchangeResponse.ok) {
    throw new Error('GitHub token exchange failed')
  }

  const tokenResponse = await tokenExchangeResponse.json()

  if (!tokenResponse.access_token) {
    throw new Error('GitHub token exchange failed')
  }

  const githubUserResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  })

  if (!githubUserResponse.ok) {
    throw new Error('GitHub profile fetch failed')
  }

  const githubUser = await githubUserResponse.json()

  const email = githubUser.email as string | null

  await session.update({
    userId: undefined,
    email: undefined,
    oauthState: undefined,
    postLoginRedirect: undefined,
  })

  const user = await authenticateGitHubUser({
    ...githubUser,
    email,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    idToken: tokenResponse.id_token,
    expiresIn: tokenResponse.expires_in,
  })

  await session.update({
    userId: String(user._id),
    email: user.email || '',
    oauthState: undefined,
    postLoginRedirect: undefined,
  })

  return { redirectTo: postLoginRedirect }
}

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getAppSession()
  await session.clear()
  //   throw redirect({ to: '/' })
  return { success: true }
})

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getAppSession()
  const userId = session.data.userId

  if (!userId) {
    return null
  }

  return {
    id: userId,
    email: session.data.email || '',
  }
})
