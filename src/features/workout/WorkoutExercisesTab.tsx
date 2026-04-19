import { Check, PlusCircle, X } from 'lucide-react'

import { ExerciseActionCard } from '~/components/components'
import type { SetType } from '~/enums/enums'

import type { WorkoutCategory, WorkoutExercise } from './workout.types'

interface WorkoutExercisesTabProps {
  categories: WorkoutCategory[]
  expandedExerciseId: string | null
  isAddingExercise: boolean
  newExerciseName: string
  sortedExercises: WorkoutExercise[]
  logCountByExercise: Map<string, number>
  onAddExercise: () => void
  onAddSet: (exercise: WorkoutExercise, payload: { type: SetType; value: number }) => void
  onRemoveExercise: (exerciseId: string) => void
  onRenameExercise: (exerciseId: string, nextName: string) => void
  onSetExpandedExerciseId: (
    value: string | null | ((current: string | null) => string | null),
  ) => void
  onSetIsAddingExercise: (value: boolean) => void
  onSetNewExerciseName: (value: string) => void
  onToggleExerciseCategory: (exerciseId: string, categoryId: string) => void
  onUpdateExerciseWeeklyGoal: (exerciseId: string, weeklySetGoal: number | null) => void
}

export function WorkoutExercisesTab({
  categories,
  expandedExerciseId,
  isAddingExercise,
  logCountByExercise,
  newExerciseName,
  onAddExercise,
  onAddSet,
  onRemoveExercise,
  onRenameExercise,
  onSetExpandedExerciseId,
  onSetIsAddingExercise,
  onSetNewExerciseName,
  onToggleExerciseCategory,
  onUpdateExerciseWeeklyGoal,
  sortedExercises,
}: WorkoutExercisesTabProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> Exercises
        </h2>
        <button
          onClick={() => onSetIsAddingExercise(true)}
          className="flex items-center gap-1.5 bg-[#2A333E] px-2.5 py-1 rounded-lg border border-slate-700 text-orange-500"
        >
          <PlusCircle size={12} />
          <span className="text-[9px] font-black uppercase tracking-widest">Add New</span>
        </button>
      </div>

      {isAddingExercise && (
        <div className="mb-4 animate-in zoom-in-95 duration-200">
          <div className="bg-[#2A333E] p-3 rounded-2xl border border-orange-500/30 flex items-center gap-2">
            <input
              autoFocus
              placeholder="Exercise name..."
              className="bg-transparent border-none focus:ring-0 text-[16px] md:text-sm font-bold text-white flex-1"
              value={newExerciseName}
              onChange={(event) => onSetNewExerciseName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onAddExercise()}
            />
            <button onClick={() => onSetIsAddingExercise(false)}>
              <X size={18} className="text-slate-500" />
            </button>
            <button onClick={onAddExercise} className="p-1.5 bg-orange-500 rounded-lg">
              <Check size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {sortedExercises.length === 0 && !isAddingExercise && (
          <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
            <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">
              Your exercise bank is empty
            </p>
          </div>
        )}
        {sortedExercises.map((exercise) => (
          <ExerciseActionCard
            key={exercise.id}
            id={exercise.id}
            name={exercise.name}
            categoryIds={exercise.categoryIds}
            allCategories={categories}
            onAdd={(payload) => onAddSet(exercise, payload)}
            onRemove={() => onRemoveExercise(exercise.id)}
            onRename={(nextName) => onRenameExercise(exercise.id, nextName)}
            onToggleCategory={(categoryId) => onToggleExerciseCategory(exercise.id, categoryId)}
            onUpdateWeeklyGoal={(weeklySetGoal) =>
              onUpdateExerciseWeeklyGoal(exercise.id, weeklySetGoal)
            }
            onToggleExpand={(id) =>
              onSetExpandedExerciseId((current) => (current === id ? null : id))
            }
            isExpanded={expandedExerciseId === exercise.id}
            count={logCountByExercise.get(exercise.id) || 0}
            weeklySetGoal={exercise.weeklySetGoal}
            weekSetsDone={exercise.weekSetsDone}
            stats={exercise.stats}
          />
        ))}
      </div>
    </>
  )
}
