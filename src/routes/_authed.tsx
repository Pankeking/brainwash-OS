import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getCurrentUserFn } from '~/server/auth'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn()
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
