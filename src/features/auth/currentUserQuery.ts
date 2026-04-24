import { getCurrentUserFn } from '~/server/auth'

export const currentUserQueryOptions = {
  queryKey: ['currentUser'] as const,
  queryFn: getCurrentUserFn,
  staleTime: Infinity,
}
