import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { currentUserQueryOptions } from '~/features/auth/currentUserQuery'
import { getCurrentUserFn } from '~/server/auth'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const user = await getCurrentUserFn()
    context.queryClient.setQueryData(currentUserQueryOptions.queryKey, user)
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
