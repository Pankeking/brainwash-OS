import { Clock3, Dumbbell, History, Ruler, Tag } from 'lucide-react'
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
  { icon: Ruler, label: 'Body', value: 'body' },
  { icon: History, label: 'History', value: 'history' },
]

interface WorkoutTabBarProps {
  activeTab: WorkoutTab
  onChange: (tab: WorkoutTab) => void
}

export function WorkoutTabBar({ activeTab, onChange }: WorkoutTabBarProps) {
  return (
    <div className="mb-6 px-1">
      <div className="flex items-center gap-1.5 overflow-hidden rounded-[1.35rem] border border-white/8 bg-[#111821]/85 p-1.5 shadow-[0_18px_50px_rgba(3,8,20,0.3)] backdrop-blur-xl">
        {WORKOUT_TABS.map((tab) => {
          const Icon = tab.icon

          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={`flex h-11 items-center justify-center rounded-[1rem] text-[9px] font-black uppercase tracking-[0.22em] transition-all duration-300 ${
                activeTab === tab.value
                  ? 'flex-[2.2] gap-2 bg-linear-to-b from-orange-400 to-orange-500 px-3 text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)]'
                  : 'w-11 flex-none px-0 text-slate-500 hover:bg-white/5 hover:text-slate-200'
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
