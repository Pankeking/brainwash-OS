import { useMemo } from 'react'

interface WeeklyCalendarProps {
  selectedDay: string
  onSelectDay: (date: string) => void
}

export default function WeeklyCalendar({ selectedDay, onSelectDay }: WeeklyCalendarProps) {
  const today = new Date().toDateString()

  const weekDays = useMemo(() => {
    const start = new Date()
    const day = start.getDay()
    // Find Monday of the current week
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(start)
    monday.setDate(diff)

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return {
        label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNum: d.getDate(),
        fullDate: d.toDateString(),
      }
    })
  }, [])

  return (
    <div className="mb-8 px-1">
      {/* Grid-cols-7 ensures 7 equal columns.
          Gap-1 or gap-2 is used to prevent the days from touching.
      */}
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
                {day.label[0]} {/* Showing only the first letter (M, T, W...) for max space */}
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
