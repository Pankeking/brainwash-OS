import { createFileRoute, redirect } from '@tanstack/react-router'
import { githubAuthCallbackFn } from '~/server/auth'

export const Route = createFileRoute('/auth/github_/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : '',
    state: typeof search.state === 'string' ? search.state : '',
  }),
  loaderDeps: ({ search: { code, state } }) => ({ code, state }),
  loader: async ({ deps }) => {
    const result = await githubAuthCallbackFn({ data: deps })
    throw redirect({ to: result.redirectTo || '/workout' })
  },
})
