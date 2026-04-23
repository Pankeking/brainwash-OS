import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { useAppSession } from '~/utils/session'
import connectDB from './db'
import { UserModel } from '~/models/User.model'
import { getEnvValue } from './env'

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
    const GITHUB_CLIENT_ID = getEnvValue('GITHUB_CLIENT_ID')
    const APP_URL = getEnvValue('APP_URL')
    const REDIRECT_URI = `${APP_URL}/auth/github/callback`

    const state = generateRandomState()

    const session = await useAppSession()
    await session.update({
      oauthState: state,
      postLoginRedirect: sanitizePostLoginRedirect(data.redirectTo),
    })

    const authUrl = generateGitHubOAuthUrl(GITHUB_CLIENT_ID, REDIRECT_URI, state)

    return { url: authUrl }
  })

async function authenticateGitHubUser(githubProfile: GitHubProfile) {
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
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ data }) => {
    const session = await useAppSession()
    const oauthRedirectUri = `${getEnvValue('APP_URL')}/auth/github/callback`
    const postLoginRedirect = sanitizePostLoginRedirect(session.data.postLoginRedirect)

    if (data.state !== session.data.oauthState) {
      throw new Error('Invalid state')
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: getEnvValue('GITHUB_CLIENT_ID'),
        client_secret: getEnvValue('GITHUB_CLIENT_SECRET'),
        code: data.code,
        redirect_uri: oauthRedirectUri,
      }),
    }).then((res) => res.json())

    if (!tokenResponse.access_token) {
      throw new Error('GitHub token exchange failed')
    }

    const githubUser = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    }).then((res) => res.json())

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
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useAppSession()
  await session.clear()
  //   throw redirect({ to: '/' })
  return { success: true }
})

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await useAppSession()
  const userId = session.data.userId

  if (!userId) {
    return null
  }

  return {
    id: userId,
    email: session.data.email || '',
  }
})
