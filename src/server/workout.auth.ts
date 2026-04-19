import mongoose from 'mongoose'

import { useAppSession } from '~/utils/session'

export async function getAuthenticatedUserObjectId() {
  const session = await useAppSession()
  const userId = session.data.userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Unauthorized')
  }
  return new mongoose.Types.ObjectId(userId)
}
