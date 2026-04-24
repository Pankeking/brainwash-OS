import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, GithubIcon, Sparkles, Timer, Dumbbell } from 'lucide-react'
import { lazy, type MouseEvent, Suspense, useState } from 'react'
import { useAuth } from '~/contexts/auth'
import { currentUserQueryOptions } from '~/features/auth/currentUserQuery'
import { clearWorkoutUserQueries } from '~/features/workout/workout.cache'
import { logoutFn } from '~/server/auth'
import Hero from '~/components/Hero'
import Button, { getButtonClassName } from '~/components/Button'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/')({
  component: Home,
})

const Chat = lazy(() => import('~/components/Chat'))

const GITHUB_LOGIN_HREF = `/auth/github?${new URLSearchParams({ redirect: '/workout' })}`

function Home() {
  const { user, error, isLoading, refetch } = useAuth()
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)

  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logoutFn,
    onSuccess: async () => {
      clearWorkoutUserQueries(queryClient, user?.id)
      queryClient.setQueryData(currentUserQueryOptions.queryKey, null)
      await refetch()
    },
  })
  const handleLogout = async () => {
    logoutMutation.mutate(undefined)
  }

  const isLoginDisabled = isRedirectingToLogin || logoutMutation.isPending

  const handleGitHubLogin = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isLoginDisabled) {
      event.preventDefault()
      return
    }
    setIsRedirectingToLogin(true)
  }

  return (
    <div className="min-h-screen bg-[#1A1F26] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#2A333E] via-[#1A1F26] to-[#0F1216] px-5 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.15fr)_24rem] lg:gap-12">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/8 bg-white/6 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 backdrop-blur-xl">
              <Sparkles size={12} className="text-orange-400" />
              Workout focus system
            </div>
            <Hero title="Brainwash">
              Build a cleaner training flow with fast set logging, timer-first workouts, and body
              tracking that stays out of your way.
            </Hero>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4 backdrop-blur-xl">
                <Timer size={16} className="text-orange-400" />
                <div className="mt-3 text-sm font-black text-slate-100">Timer-first flow</div>
                <p className="mt-1 text-sm text-slate-400">
                  Log a set and keep the clock moving without resetting context.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4 backdrop-blur-xl">
                <Dumbbell size={16} className="text-orange-400" />
                <div className="mt-3 text-sm font-black text-slate-100">Exercise bank</div>
                <p className="mt-1 text-sm text-slate-400">
                  Keep categories, targets, and weekly rhythm attached to each lift.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4 backdrop-blur-xl">
                <Sparkles size={16} className="text-orange-400" />
                <div className="mt-3 text-sm font-black text-slate-100">Body tracking</div>
                <p className="mt-1 text-sm text-slate-400">
                  Track weight and measurements without abusing exercises as fake metrics.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5 shadow-[0_28px_80px_rgba(2,8,23,0.34)] backdrop-blur-2xl">
              <div className="mb-5">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {isLoading ? 'Checking session' : user ? 'Ready to train' : 'Sign in'}
                </div>
                <div className="mt-2 text-2xl font-black tracking-tight text-slate-50">
                  {isLoading
                    ? 'Checking your workspace access.'
                    : user
                      ? 'Open your workout space.'
                      : 'Use GitHub to enter your workspace.'}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {error
                    ? 'Authentication check failed. You can still try signing in again.'
                    : isLoading
                      ? 'The app is verifying your current session. You can still continue manually.'
                      : user
                        ? 'Jump straight back into exercises, timers, and tracking.'
                        : 'Authentication is required before workout, chat, and body data become available.'}
                </p>
              </div>

              <div className="space-y-3">
                {user ? (
                  <>
                    <Link to="/workout" preload="render" className="block">
                      <Button variant="accent" className="h-12 w-full justify-between px-4">
                        Open exercises
                        <ArrowRight size={16} />
                      </Button>
                    </Link>
                    <Button
                      onClick={handleLogout}
                      variant="secondary"
                      className="h-12 w-full"
                      disabled={logoutMutation.isPending}
                    >
                      {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                    </Button>
                  </>
                ) : (
                  <a
                    href={GITHUB_LOGIN_HREF}
                    onClick={handleGitHubLogin}
                    aria-disabled={isLoginDisabled}
                    className={getButtonClassName(
                      'accent',
                      `h-12 w-full justify-between px-4 ${
                        isLoginDisabled ? 'pointer-events-none opacity-70' : ''
                      }`,
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <GithubIcon size={18} className="text-white" />
                      {isRedirectingToLogin ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
                    </span>
                    <ArrowRight size={16} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {user ? (
        <div className="fixed bottom-8 right-8">
          <Suspense fallback={null}>
            <Chat />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}
