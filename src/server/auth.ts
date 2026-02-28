import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
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

type GitHubEmailResponse = {
  email: string
  primary: boolean
  verified: boolean
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
    state: state,
    scope: 'user:email',
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export const initiateOAuthFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ provider: z.literal('github'), origin: z.string().url().optional() }))
  .handler(async ({ data }) => {
    const GITHUB_CLIENT_ID = getEnvValue('GITHUB_CLIENT_ID')
    const APP_URL = data.origin || getEnvValue('APP_URL')
    const REDIRECT_URI = `${APP_URL}/auth/github/callback`

    const state = generateRandomState()

    const session = await useAppSession()
    await session.update({ oauthState: state, oauthRedirectUri: REDIRECT_URI })

    const authUrl = generateGitHubOAuthUrl(GITHUB_CLIENT_ID, REDIRECT_URI, state)

    return { url: authUrl }
  })

async function authenticateGitHubUser(githubProfile: GitHubProfile) {
  await connectDB()

  const now = new Date()
  const accessTokenExpiresAt = githubProfile.expiresIn
    ? new Date(Date.now() + githubProfile.expiresIn * 1000)
    : now

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
      providerAccessToken: githubProfile.accessToken,
      providerRefreshToken: githubProfile.refreshToken || '',
      providerExpiresAt: accessTokenExpiresAt,
      providerTokenType: githubProfile.tokenType || 'bearer',
      providerScope: githubProfile.scope || '',
      providerIdToken: githubProfile.idToken || '',
      providerAccessTokenExpiresAt: accessTokenExpiresAt,
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      returnDocument: 'after',
    },
  )

  return user
}

async function getUserById(userId: string) {
  await connectDB()
  const user = await UserModel.findById(userId).lean()
  if (!user) {
    return null
  }

  return {
    id: String(user._id),
    email: user.email || '',
    username: user.username,
    avatarUrl: user.avatarUrl || undefined,
  }
}

export const githubAuthCallbackFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ data }) => {
    const session = await useAppSession()
    const oauthRedirectUri = session.data.oauthRedirectUri || `${getEnvValue('APP_URL')}/auth/github/callback`

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

    let email = githubUser.email as string | null
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      }).then((res) => res.json())

      if (Array.isArray(emailsResponse)) {
        const typedEmails = emailsResponse as GitHubEmailResponse[]
        const primaryEmail = typedEmails.find((entry) => entry.primary && entry.verified)
        email = primaryEmail?.email || typedEmails[0]?.email || null
      }
    }

    await session.update({
      userId: undefined,
      email: undefined,
      oauthState: undefined,
      oauthRedirectUri: undefined,
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
      oauthRedirectUri: undefined,
    })

    throw redirect({ to: '/' })
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

  return await getUserById(userId)
})
