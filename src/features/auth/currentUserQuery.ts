import { getCurrentUserFn } from '~/server/auth'

const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000

export const currentUserQueryOptions = {
  queryKey: ['currentUser'] as const,
  queryFn: getCurrentUserFn,
  staleTime: TEN_DAYS_IN_MS,
  gcTime: TEN_DAYS_IN_MS,
  retry: false,
}
