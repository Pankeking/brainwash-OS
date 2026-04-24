import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { currentUserQueryOptions } from '~/features/auth/currentUserQuery'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions)
    if (!user) {
      throw redirect({
        to: '/',
        search: { redirect: location.href },
      })
    }
    return { user }
  },
  component: () => <Outlet />,
})
