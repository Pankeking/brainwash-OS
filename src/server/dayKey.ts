const SELECTED_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return { year, month, day }
}

export function getTimePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  const second = Number(parts.find((part) => part.type === 'second')?.value)
  return { hour, minute, second }
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  const timeParts = getTimePartsInTimeZone(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    date.getUTCMilliseconds(),
  )
  return asUtc - date.getTime()
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let timestamp = utcGuess - firstOffset
  const secondOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone)
  if (secondOffset !== firstOffset) {
    timestamp = utcGuess - secondOffset
  }
  return new Date(timestamp)
}

export function formatDayKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function dayKeyFromDateInTimeZone(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  return formatDayKey(parts.year, parts.month, parts.day)
}

export function parseDayKey(value: string) {
  if (!SELECTED_DAY_KEY_REGEX.test(value)) {
    throw new Error('Invalid selected day')
  }
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const control = new Date(Date.UTC(year, month - 1, day))
  if (
    control.getUTCFullYear() !== year ||
    control.getUTCMonth() + 1 !== month ||
    control.getUTCDate() !== day
  ) {
    throw new Error('Invalid selected day')
  }
  return { year, month, day, key: formatDayKey(year, month, day) }
}

export function resolveSelectedDayKey(selectedDay: string | undefined, timeZone: string) {
  if (!selectedDay) {
    return dayKeyFromDateInTimeZone(new Date(), timeZone)
  }
  try {
    return parseDayKey(selectedDay).key
  } catch {
    return dayKeyFromDateInTimeZone(new Date(), timeZone)
  }
}

export function getUtcRangeForDayKey(dayKey: string, timeZone: string) {
  const parsed = parseDayKey(dayKey)
  const start = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 0, 0, 0, 0, timeZone)
  const end = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 23, 59, 59, 999, timeZone)
  return { start, end }
}

export function createLogTimestampForDayKey(
  dayKey: string,
  timeZone: string,
  now: Date = new Date(),
) {
  const selected = parseDayKey(dayKey)
  const timeParts = getTimePartsInTimeZone(now, timeZone)
  return zonedDateTimeToUtc(
    selected.year,
    selected.month,
    selected.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    now.getMilliseconds(),
    timeZone,
  )
}
