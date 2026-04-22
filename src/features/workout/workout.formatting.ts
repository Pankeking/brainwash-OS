export function formatTimedValue(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}m:${String(seconds).padStart(2, '0')}s`
}

export function formatMetricStatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
