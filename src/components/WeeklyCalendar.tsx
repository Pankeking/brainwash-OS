import { useMemo } from 'react'

interface WeeklyCalendarProps {
  selectedDay: string
  onSelectDay: (date: string) => void
}

const TIME_ZONE = 'Europe/Berlin'
const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

function toDayKey(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

function parseDayKey(dayKey: string) {
  if (!DAY_KEY_REGEX.test(dayKey)) {
    return null
  }
  const [yearRaw, monthRaw, dayRaw] = dayKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const control = new Date(Date.UTC(year, month - 1, day))
  if (
    control.getUTCFullYear() !== year ||
    control.getUTCMonth() + 1 !== month ||
    control.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

function addDays(dayKey: string, days: number) {
  const parsed = parseDayKey(dayKey)
  if (!parsed) {
    return dayKey
  }
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export default function WeeklyCalendar({ selectedDay, onSelectDay }: WeeklyCalendarProps) {
  const today = toDayKey(new Date())

  const weekDays = useMemo(() => {
    const parsedSelected = parseDayKey(selectedDay)
    const referenceDay = parsedSelected ? selectedDay : today
    const selectedDate = parseDayKey(referenceDay)
    if (!selectedDate) {
      return []
    }
    const day = new Date(
      Date.UTC(selectedDate.year, selectedDate.month - 1, selectedDate.day),
    ).getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = addDays(referenceDay, diff)

    return Array.from({ length: 7 }).map((_, i) => {
      const fullDate = addDays(monday, i)
      const displayDate = new Date(`${fullDate}T12:00:00.000Z`)
      return {
        label: displayDate
          .toLocaleDateString('en-US', { weekday: 'short', timeZone: TIME_ZONE })
          .toUpperCase(),
        dayNum: Number(
          displayDate.toLocaleDateString('en-US', { day: 'numeric', timeZone: TIME_ZONE }),
        ),
        fullDate,
      }
    })
  }, [selectedDay, today])

  return (
    <div className="mb-8 px-1">
      <div className="grid grid-cols-7 gap-1 w-full">
        {weekDays.map((day) => {
          const isActive = selectedDay === day.fullDate
          const isToday = day.fullDate === today

          return (
            <button
              key={day.fullDate}
              onClick={() => onSelectDay(day.fullDate)}
              className="flex flex-col items-center transition-all group"
            >
              <span
                className={`text-[9px] font-black mb-2 transition-colors tracking-tighter ${
                  isActive ? 'text-orange-500' : 'text-slate-500'
                }`}
              >
                {day.label[0]}
              </span>

              <div
                className={`
                w-full aspect-square max-w-[40px] rounded-xl flex items-center justify-center font-black text-xs
                transition-all duration-300 relative border
                ${
                  isActive
                    ? 'bg-orange-500 text-white border-orange-400 shadow-[0_4px_10px_rgba(249,115,22,0.4)] -translate-y-1'
                    : 'bg-[#2A333E] text-slate-400 border-white/5 shadow-[0_2px_0_0_#14181d] active:translate-y-0.5 active:shadow-none'
                }
                ${isToday && !isActive ? 'ring-1 ring-orange-500/50' : ''}
              `}
              >
                {day.dayNum}

                {isToday && (
                  <div
                    className={`absolute -bottom-1 w-1 h-1 rounded-full ${
                      isActive ? 'bg-white' : 'bg-orange-500'
                    }`}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
