import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { getEnvValue } from './env'
import { appLogError, appLogInfo } from './logger'

dotenv.config()

export default async function connectDB() {
  try {
    if (mongoose.connection.readyState) return
    const mongoURI = getEnvValue('MONGO_URI')
    await mongoose.connect(mongoURI)
    appLogInfo('BW_DB_CONNECTED', 'MongoDB connected')
  } catch (err: unknown) {
    if (err instanceof Error) {
      appLogError('BW_DB_CONNECT_FAILED', 'MongoDB connection failed', {
        error: err.message,
      })
    } else {
      appLogError('BW_DB_CONNECT_FAILED', 'MongoDB connection failed', {
        error: 'Unknown MongoDB connection error',
      })
    }
    process.exit(1)
  }
}
