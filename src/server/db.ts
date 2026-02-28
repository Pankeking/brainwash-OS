import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { getEnvValue } from './env'

dotenv.config()

export default async function connectDB() {
  try {
    if (mongoose.connection.readyState) return
    const mongoURI = getEnvValue('MONGO_URI')
    await mongoose.connect(mongoURI)
    console.log('MongoDB Connected...')
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message)
    } else {
      console.error('Unknown MongoDB connection error')
    }
    process.exit(1)
  }
}
