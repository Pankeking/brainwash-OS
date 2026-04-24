import type { Types } from 'mongoose'

export async function getAuthenticatedUserObjectId(): Promise<Types.ObjectId> {
  const [{ default: mongoose }, { useAppSession }] = await Promise.all([
    import('mongoose'),
    import('~/utils/session'),
  ])
  const session = await useAppSession()
  const userId = session.data.userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Unauthorized')
  }
  return new mongoose.Types.ObjectId(userId)
}
