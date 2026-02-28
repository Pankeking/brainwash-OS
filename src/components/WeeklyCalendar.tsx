import { useEffect, useMemo, useState } from 'react'

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

function getWeekStart(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  if (!parsed) {
    return dayKey
  }
  const day = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(dayKey, diff)
}

function getMonthStart(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  if (!parsed) {
    return dayKey
  }
  return `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-01`
}

function addMonths(dayKey: string, months: number) {
  const parsed = parseDayKey(dayKey)
  if (!parsed) {
    return dayKey
  }
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1 + months, 1))
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function compareDayKeys(left: string, right: string) {
  return left.localeCompare(right)
}

export default function WeeklyCalendar({ selectedDay, onSelectDay }: WeeklyCalendarProps) {
  const today = toDayKey(new Date())
  const [weekAnchor, setWeekAnchor] = useState(selectedDay)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(getMonthStart(selectedDay))

  useEffect(() => {
    const safeSelected = parseDayKey(selectedDay) ? selectedDay : today
    setWeekAnchor(safeSelected)
    setPickerMonth(getMonthStart(safeSelected))
  }, [selectedDay, today])

  const weekDays = useMemo(() => {
    const referenceDay = parseDayKey(weekAnchor) ? weekAnchor : today
    const monday = getWeekStart(referenceDay)
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
  }, [weekAnchor, today])

  const monthDays = useMemo(() => {
    const parsed = parseDayKey(pickerMonth)
    if (!parsed) {
      return []
    }
    const firstDay = `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-01`
    const firstWeekStart = getWeekStart(firstDay)
    return Array.from({ length: 42 }).map((_, index) => {
      const fullDate = addDays(firstWeekStart, index)
      const dayParsed = parseDayKey(fullDate)
      if (!dayParsed) {
        return null
      }
      return {
        fullDate,
        dayNum: dayParsed.day,
        isCurrentMonth: dayParsed.month === parsed.month && dayParsed.year === parsed.year,
        isFuture: compareDayKeys(fullDate, today) > 0,
      }
    })
  }, [pickerMonth, today])

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) {
      return ''
    }
    const start = new Date(`${weekDays[0].fullDate}T12:00:00.000Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: TIME_ZONE,
    })
    const end = new Date(`${weekDays[6].fullDate}T12:00:00.000Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: TIME_ZONE,
    })
    return `${start} - ${end}`
  }, [weekDays])

  const monthLabel = useMemo(() => {
    const parsed = parseDayKey(pickerMonth)
    if (!parsed) {
      return ''
    }
    return new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: TIME_ZONE,
    })
  }, [pickerMonth])

  const handleSelectDay = (dayKey: string) => {
    onSelectDay(dayKey)
    setWeekAnchor(dayKey)
    setPickerMonth(getMonthStart(dayKey))
    setIsPickerOpen(false)
  }

  return (
    <div className="mb-8 px-1">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekAnchor((current) => addDays(current, -7))}
          className="px-2 py-1 rounded-lg bg-[#2A333E] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
        >
          Prev Week
        </button>
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          {weekRangeLabel}
        </div>
        <button
          onClick={() => setWeekAnchor((current) => addDays(current, 7))}
          className="px-2 py-1 rounded-lg bg-[#2A333E] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
        >
          Next Week
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 w-full">
        {weekDays.map((day) => {
          const isActive = selectedDay === day.fullDate
          const isToday = day.fullDate === today

          return (
            <button
              key={day.fullDate}
              onClick={() => handleSelectDay(day.fullDate)}
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
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => handleSelectDay(today)}
          className="px-2 py-1 rounded-lg bg-[#2A333E] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
        >
          Today
        </button>
        <button
          onClick={() => setIsPickerOpen((current) => !current)}
          className="px-2 py-1 rounded-lg bg-[#2A333E] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-orange-400"
        >
          {isPickerOpen ? 'Close Calendar' : 'Open Calendar'}
        </button>
      </div>
      {isPickerOpen && (
        <div className="mt-3 rounded-2xl border border-slate-700 bg-[#2A333E] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setPickerMonth((current) => addMonths(current, -1))}
              className="px-2 py-1 rounded-lg bg-[#1A1F26] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
            >
              Prev
            </button>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {monthLabel}
            </div>
            <button
              onClick={() => setPickerMonth((current) => addMonths(current, 1))}
              className="px-2 py-1 rounded-lg bg-[#1A1F26] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
            >
              Next
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
              <div
                key={`${label}-${index}`}
                className="text-center text-[9px] font-black uppercase tracking-widest text-slate-500"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day, index) => {
              if (!day) {
                return <div key={index} className="h-8" />
              }
              const isActive = day.fullDate === selectedDay
              const isToday = day.fullDate === today
              return (
                <button
                  key={day.fullDate}
                  disabled={day.isFuture}
                  onClick={() => handleSelectDay(day.fullDate)}
                  className={`h-8 rounded-lg border text-[10px] font-black transition-all ${
                    isActive
                      ? 'bg-orange-500 border-orange-400 text-white'
                      : day.isCurrentMonth
                        ? 'bg-[#1A1F26] border-slate-700 text-slate-300'
                        : 'bg-[#1A1F26]/40 border-slate-800 text-slate-500'
                  } ${isToday && !isActive ? 'ring-1 ring-orange-500/50' : ''} ${day.isFuture ? 'opacity-35 cursor-not-allowed' : ''}`}
                >
                  {day.dayNum}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
