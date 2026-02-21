import { createFileRoute, Link } from '@tanstack/react-router'
import { GithubIcon } from 'lucide-react'
import { useAuth } from '~/contexts/auth'
import { logoutFn, initiateOAuthFn } from '~/server/auth'
import { Hero, Chat, Button } from '~/components/components'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface InitiateOAuthInput {
  provider: 'github'
}

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { user, isLoading, refetch } = useAuth()

  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
    onError: (error) => {
      console.error('Logout failed:', error)
    },
  })
  const initiateOAuthMutation = useMutation({
    mutationFn: (input: InitiateOAuthInput) => initiateOAuthFn({ data: input }),
    onSuccess: (data) => {
      console.log('Initiated OAuth successfully')
      window.location.href = data.url
    },
    onError: (error) => {
      console.error('Failed to initiate OAuth:', error)
    },
  })

  const handleLogout = async () => {
    logoutMutation.mutate(undefined)
  }

  const handleGitHubLogin = () => {
    initiateOAuthMutation.mutate({ provider: 'github' })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1A1F26] text-slate-100 flex flex-col items-center justify-center p-6">
        Loading authentication status...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1F26] text-slate-100 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#2A333E] via-[#1A1F26] to-[#0F1216]">
      <Hero title="Brainwash">
        Gaslight your mind into a <br /> super human{' '}
        <span className="text-orange-500">reality.</span>
      </Hero>

      <div className="flex flex-wrap gap-4 justify-center mb-16">
        {user ? (
          <>
            <Link to="/workout">
              <Button variant="primary" className="min-w-[110px]">
                Exercise
              </Button>
            </Link>

            <Link to="/todos">
              <Button variant="secondary" className="min-w-[110px]">
                Tasks
              </Button>
            </Link>

            <Button variant="accent" className="min-w-[110px]">
              Goals
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="min-w-[110px]"
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={handleGitHubLogin}
            className="min-w-[110px]"
            disabled={initiateOAuthMutation.isPending}
          >
            <GithubIcon size={20} className="text-orange-400" />
            {initiateOAuthMutation.isPending ? 'Logging in...' : 'Login with GitHub'}
          </Button>
        )}
      </div>

      <div className="fixed bottom-10">
        <Chat />
      </div>
    </div>
  )
}
