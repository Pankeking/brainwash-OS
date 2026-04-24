import { createFileRoute, redirect } from '@tanstack/react-router'

import { initiateOAuthFn } from '~/server/auth'

export const Route = createFileRoute('/auth/github')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  loaderDeps: ({ search: { redirect } }) => ({ redirect }),
  loader: async ({ deps }) => {
    const result = await initiateOAuthFn({
      data: {
        provider: 'github',
        redirectTo: deps.redirect,
      },
    })

    throw redirect({
      href: result.url,
    })
  },
})
