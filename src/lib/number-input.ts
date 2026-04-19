export function normalizeDecimalInput(rawValue: string | number) {
  if (typeof rawValue === 'number') {
    return String(rawValue)
  }

  return rawValue.trim().replace(/\s+/g, '').replace(',', '.')
}

export function parseLocaleNumberInput(rawValue: string | number) {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null
  }

  const normalized = normalizeDecimalInput(rawValue)
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}
