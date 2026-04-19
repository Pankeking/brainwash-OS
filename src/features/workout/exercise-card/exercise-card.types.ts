import type { SetType } from '~/enums/enums'

export interface ExerciseCardCategory {
  id: string
  name: string
  color: string
}

export interface ExerciseActionCardProps {
  id: string
  name: string
  categoryIds: string[]
  allCategories: ExerciseCardCategory[]
  onAdd: (payload: { type: SetType; value: number }) => void
  onRemove: () => void
  onRename: (newName: string) => void
  onToggleCategory: (categoryId: string) => void
  onUpdateWeeklyGoal: (
    weeklySetGoal: number | null,
    weeklyVolumeGoal: number | null,
    preferredSetType: SetType,
  ) => void
  onToggleExpand: (id: string) => void
  isExpanded: boolean
  count: number
  preferredSetType: SetType
  weeklySetGoal: number | null
  weeklyVolumeGoal: number | null
  weekSetsDone: number
  weekVolumeDone: number
  stats: {
    week: { best: number | null; avg: number | null; worst: number | null }
    month: { best: number | null; avg: number | null; worst: number | null }
  }
}
