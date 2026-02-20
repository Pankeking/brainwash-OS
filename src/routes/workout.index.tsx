import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/workout/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h1>Workout</h1>
      <Outlet />
    </div>
  )
}
