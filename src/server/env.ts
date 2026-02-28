type AppEnvironment = 'dev' | 'prod'

function getAppEnvironment(): AppEnvironment {
  const rawValue = (process.env.APP_ENV || 'dev').toLowerCase()
  return rawValue === 'prod' ? 'prod' : 'dev'
}

function getEnvironmentSuffix() {
  return getAppEnvironment() === 'prod' ? 'PROD' : 'DEV'
}

export function getEnvValue(key: string): string {
  const scopedValue = process.env[`${key}_${getEnvironmentSuffix()}`]
  if (scopedValue) {
    return scopedValue
  }

  const fallbackValue = process.env[key]
  if (fallbackValue) {
    return fallbackValue
  }

  throw new Error(`${key} is not set`)
}

export function isProductionEnvironment() {
  return getAppEnvironment() === 'prod'
}
