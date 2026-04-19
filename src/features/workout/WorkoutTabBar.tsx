import { Clock3, Dumbbell, History, Tag } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

import type { WorkoutTab } from './workout.types'

type WorkoutTabOption = {
  icon: LucideIcon
  label: string
  value: WorkoutTab
}

const WORKOUT_TABS: WorkoutTabOption[] = [
  { icon: Clock3, label: 'Time', value: 'time' },
  { icon: Tag, label: 'Categories', value: 'categories' },
  { icon: Dumbbell, label: 'Exercises', value: 'exercises' },
  { icon: History, label: 'History', value: 'history' },
]

interface WorkoutTabBarProps {
  activeTab: WorkoutTab
  onChange: (tab: WorkoutTab) => void
}

export function WorkoutTabBar({ activeTab, onChange }: WorkoutTabBarProps) {
  return (
    <div className="mb-6 px-1">
      <div className="flex items-center gap-2 bg-[#2A333E] rounded-2xl p-1.5 border border-slate-700 shadow-[0_12px_30px_rgba(0,0,0,0.2)] overflow-hidden">
        {WORKOUT_TABS.map((tab) => {
          const Icon = tab.icon

          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={`h-11 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center transition-all duration-300 ${
                activeTab === tab.value
                  ? 'bg-orange-500 text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)] flex-[2.2] px-3 gap-1.5'
                  : 'text-slate-400 hover:bg-[#364252] hover:text-slate-200 w-11 flex-none px-0'
              }`}
            >
              <Icon size={12} />
              <span
                className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  activeTab === tab.value ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
