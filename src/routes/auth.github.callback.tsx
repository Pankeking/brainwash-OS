import { createFileRoute, redirect } from '@tanstack/react-router'
import { githubAuthCallbackFn } from '~/server/auth'

export const Route = createFileRoute('/auth/github/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: search.code as string,
    state: search.state as string,
  }),
  loaderDeps: ({ search: { code, state } }) => ({ code, state }),
  loader: async ({ deps }) => {
    await githubAuthCallbackFn({ data: deps })
    throw redirect({ to: '/' })
  },
})
