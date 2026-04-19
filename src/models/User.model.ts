import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: false },
    passwordHash: { type: String, required: false },
    avatarUrl: { type: String, required: false },
    provider: { type: String, required: true },
    providerUserId: { type: String, required: true },
    providerAccessToken: { type: String, required: false, select: false },
    providerRefreshToken: { type: String, required: false, select: false },
    providerExpiresAt: { type: Date, required: false, select: false },
    providerTokenType: { type: String, required: false, select: false },
    providerScope: { type: String, required: false, select: false },
    providerIdToken: { type: String, required: false, select: false },
    providerAccessTokenExpiresAt: { type: Date, required: false, select: false },
  },
  { timestamps: true },
)

userSchema.index({ provider: 1, providerUserId: 1 }, { unique: true })

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema)
