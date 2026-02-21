import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: false },
    passwordHash: { type: String, required: false },
    avatarUrl: { type: String, required: false },
    provider: { type: String, required: true },
    providerUserId: { type: String, required: true },
    providerAccessToken: { type: String, required: true },
    providerRefreshToken: { type: String, required: true },
    providerExpiresAt: { type: Date, required: true },
    providerTokenType: { type: String, required: true },
    providerScope: { type: String, required: true },
    providerIdToken: { type: String, required: true },
    providerAccessTokenExpiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema)
