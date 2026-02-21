import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Trash2, History, PlusCircle, X, Check, Tag } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { WeeklyCalendar, ExerciseActionCard, Chat } from '~/components/components'
import {
  addWorkoutCategoryFn,
  addWorkoutExerciseFn,
  addWorkoutSetFn,
  getWorkoutDayFn,
  getWorkoutWeeklyCategoryStatsFn,
  removeWorkoutCategoryFn,
  removeWorkoutExerciseFn,
  removeWorkoutSetFn,
  renameWorkoutExerciseFn,
  toggleWorkoutExerciseCategoryFn,
  updateWorkoutCategoryColorFn,
} from '~/server/workout'
import { SetType } from '~/enums/enums'

export interface Category {
  id: string
  name: string
  color: string
}

export interface Exercise {
  id: string
  name: string
  categoryIds: string[]
  stats: {
    week: { best: number | null; avg: number | null; worst: number | null }
    month: { best: number | null; avg: number | null; worst: number | null }
  }
}

export interface Log {
  id: string
  exerciseId: string
  exerciseName: string
  type: SetType
  value: number
  date: string
  timestamp: string
}

type CategoryColorOption = {
  name: string
  hex: string
}

const CATEGORY_COLORS: CategoryColorOption[] = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#8B5CF6' },
]

export const Route = createFileRoute('/_authed/workout')({
  component: WorkoutView,
})

function WorkoutView() {
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState(new Date().toDateString())
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [weeksToShow, setWeeksToShow] = useState(4)

  const invalidateWorkoutDay = () =>
    queryClient.invalidateQueries({
      queryKey: ['workout-day', selectedDay],
    })

  const invalidateWeeklyStats = () =>
    queryClient.invalidateQueries({
      queryKey: ['workout-weekly-category-stats', weeksToShow],
    })

  const { data, isLoading } = useQuery({
    queryKey: ['workout-day', selectedDay],
    queryFn: () => getWorkoutDayFn({ data: { selectedDay } }),
  })

  const { data: weeklyStatsData, isLoading: isWeeklyStatsLoading } = useQuery({
    queryKey: ['workout-weekly-category-stats', weeksToShow],
    queryFn: () => getWorkoutWeeklyCategoryStatsFn({ data: { weeks: weeksToShow } }),
  })

  const categories: Category[] = data?.categories || []
  const myExercises: Exercise[] = data?.exercises || []
  const logs: Log[] = data?.logs || []

  const addCategoryMutation = useMutation({
    mutationFn: (input: { data: { name: string; color: string } }) => addWorkoutCategoryFn(input),
    onSuccess: () => {
      setNewCategoryName('')
      setIsAddingCategory(false)
      invalidateWorkoutDay()
    },
  })

  const removeCategoryMutation = useMutation({
    mutationFn: (input: { data: { categoryId: string } }) => removeWorkoutCategoryFn(input),
    onSuccess: () => {
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const updateCategoryColorMutation = useMutation({
    mutationFn: (input: { data: { categoryId: string; color: string } }) =>
      updateWorkoutCategoryColorFn(input),
    onSuccess: () => {
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const addExerciseMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; name: string } }) =>
      addWorkoutExerciseFn(input),
    onSuccess: () => {
      setNewExerciseName('')
      setIsAddingExercise(false)
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const removeExerciseMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; exerciseId: string } }) =>
      removeWorkoutExerciseFn(input),
    onSuccess: () => {
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const renameExerciseMutation = useMutation({
    mutationFn: (input: { data: { exerciseId: string; nextName: string } }) =>
      renameWorkoutExerciseFn(input),
    onSuccess: () => {
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const toggleExerciseCategoryMutation = useMutation({
    mutationFn: (input: { data: { exerciseId: string; categoryId: string } }) =>
      toggleWorkoutExerciseCategoryFn(input),
    onSuccess: () => {
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const addSetMutation = useMutation({
    mutationFn: (input: {
      data: {
        selectedDay: string
        exerciseId: string
        type: SetType
        reps?: number
        duration?: number
      }
    }) => addWorkoutSetFn(input),
    onSuccess: () => {
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const removeSetMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; logId: string } }) =>
      removeWorkoutSetFn(input),
    onSuccess: () => {
      setConfirmDeleteSetId(null)
      invalidateWorkoutDay()
      invalidateWeeklyStats()
    },
  })

  const handleAddExercise = () => {
    const trimmedName = newExerciseName.trim()
    if (!trimmedName) {
      return
    }
    addExerciseMutation.mutate({
      data: {
        selectedDay,
        name: trimmedName,
      },
    })
  }

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) {
      return
    }
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length].hex
    addCategoryMutation.mutate({
      data: {
        name: trimmedName,
        color,
      },
    })
  }

  const addSet = (exercise: Exercise, payload: { type: SetType; value: number }) => {
    addSetMutation.mutate({
      data: {
        selectedDay,
        exerciseId: exercise.id,
        type: payload.type,
        reps: payload.type === SetType.REPS ? payload.value : undefined,
        duration: payload.type === SetType.TIMED ? payload.value : undefined,
      },
    })
  }

  const removeExercise = (exerciseId: string) => {
    removeExerciseMutation.mutate({
      data: {
        selectedDay,
        exerciseId,
      },
    })
  }

  const cycleCategoryColor = (category: Category) => {
    const currentIndex = CATEGORY_COLORS.findIndex((value) => value.hex === category.color)
    const nextColor = CATEGORY_COLORS[(currentIndex + 1) % CATEGORY_COLORS.length]
    updateCategoryColorMutation.mutate({
      data: {
        categoryId: category.id,
        color: nextColor.hex,
      },
    })
  }

  const filteredLogs: Log[] = logs

  return (
    <div className="min-h-screen bg-[#1A1F26] text-slate-100 p-5 font-sans pb-32">
      <header className="flex justify-between items-center mb-6 pt-2">
        <Link to="/" className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <div className="bg-[#2A333E] px-3 py-1 rounded-md text-[10px] font-black tracking-widest border border-slate-700 uppercase text-slate-400">
          {new Date(selectedDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </header>

      <WeeklyCalendar selectedDay={selectedDay} onSelectDay={setSelectedDay} />

      {isLoading ? (
        <div className="text-slate-400 text-center py-10 text-sm">Loading workout data...</div>
      ) : (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase flex items-center gap-2">
                <Tag size={12} className="text-orange-500" /> Categories
              </h2>
              <button
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="text-orange-500 text-[9px] font-black uppercase tracking-widest"
              >
                {isAddingCategory ? 'Cancel' : '+ New Category'}
              </button>
            </div>

            {isAddingCategory && (
              <div className="mb-4 animate-in zoom-in-95 duration-200">
                <div className="bg-[#2A333E] p-2 rounded-xl border border-orange-500/30 flex items-center gap-2">
                  <input
                    autoFocus
                    placeholder="e.g. Upper Body"
                    className="bg-transparent border-none focus:ring-0 text-[16px] md:text-xs font-bold text-white flex-1"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button onClick={handleAddCategory} className="p-1.5 bg-orange-500 rounded-lg">
                    <Check size={14} />
                  </button>
                </div>
              </div>
            )}

            {categories.length === 0 ? (
              <div className="px-1 py-4 border border-dashed border-slate-800 rounded-xl text-center">
                <p className="text-[8px] font-black uppercase text-slate-600 tracking-tighter">
                  No categories created yet
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 px-1">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-1.5 bg-[#2A333E] px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                    onClick={() => cycleCategoryColor(cat)}
                    title={`Color: ${CATEGORY_COLORS.find((value) => value.hex === cat.color)?.name || 'Custom'}`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-[10px] font-bold text-slate-300">{cat.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCategoryMutation.mutate({
                          data: {
                            categoryId: cat.id,
                          },
                        })
                      }}
                      className="ml-1 text-slate-600 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> Exercises
            </h2>
            <button
              onClick={() => setIsAddingExercise(true)}
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
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExercise()}
                />
                <button onClick={() => setIsAddingExercise(false)}>
                  <X size={18} className="text-slate-500" />
                </button>
                <button onClick={handleAddExercise} className="p-1.5 bg-orange-500 rounded-lg">
                  <Check size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {myExercises.length === 0 && !isAddingExercise && (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">
                  Your exercise bank is empty
                </p>
              </div>
            )}
            {myExercises.map((ex) => (
              <ExerciseActionCard
                key={ex.id}
                id={ex.id}
                name={ex.name}
                categoryIds={ex.categoryIds}
                allCategories={categories}
                onAdd={(payload) => addSet(ex, payload)}
                onRemove={() => removeExercise(ex.id)}
                onRename={(newName) =>
                  renameExerciseMutation.mutate({
                    data: {
                      exerciseId: ex.id,
                      nextName: newName,
                    },
                  })
                }
                onToggleCategory={(catId) =>
                  toggleExerciseCategoryMutation.mutate({
                    data: {
                      exerciseId: ex.id,
                      categoryId: catId,
                    },
                  })
                }
                onToggleExpand={(id) => setExpandedExerciseId((prev) => (prev === id ? null : id))}
                isExpanded={expandedExerciseId === ex.id}
                count={filteredLogs.filter((l) => l.exerciseId === ex.id).length}
                stats={ex.stats}
              />
            ))}
          </div>

          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4 text-slate-600">
              <History size={12} />
              <h3 className="text-[10px] font-black uppercase tracking-widest">History</h3>
            </div>
            {filteredLogs.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center text-[10px] text-slate-500 uppercase font-black tracking-widest">
                No logs for selected day
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div
                      key={log.id}
                      className="bg-[#232a33]/40 p-3 rounded-xl flex justify-between items-center border border-slate-700/20"
                    >
                      {confirmDeleteSetId === log.id ? (
                        <div className="flex-1 flex items-center justify-between px-2">
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                            Delete?
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDeleteSetId(null)}
                              className="text-[9px] font-black text-slate-500 uppercase"
                            >
                              No
                            </button>
                            <button
                              onClick={() => {
                                removeSetMutation.mutate({
                                  data: {
                                    selectedDay,
                                    logId: log.id,
                                  },
                                })
                              }}
                              className="text-[9px] font-black text-red-500 uppercase underline"
                            >
                              Yes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-300 text-sm">
                              {log.exerciseName}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                              {new Date(log.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="bg-[#1A1F26] px-3 py-1 rounded-lg border border-slate-800 text-orange-400 font-mono text-xs font-black">
                              {log.value}{' '}
                              <span className="text-[8px] text-slate-600 ml-0.5">
                                {log.type === SetType.REPS ? 'REPS' : 'SEC'}
                              </span>
                            </div>
                            <button
                              onClick={() => setConfirmDeleteSetId(log.id)}
                              className="p-1.5 text-slate-700 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Tag size={12} />
                <h3 className="text-[10px] font-black uppercase tracking-widest">
                  Weekly Category Sets
                </h3>
              </div>
              <button
                onClick={() => setWeeksToShow((prev) => prev + 4)}
                className="text-[9px] font-black uppercase tracking-widest text-orange-400"
              >
                Load More Weeks
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              {isWeeklyStatsLoading ? (
                <div className="p-4 text-[10px] text-slate-400">
                  Loading weekly category stats...
                </div>
              ) : (
                <table className="min-w-full text-[10px]">
                  <thead>
                    <tr className="bg-[#232a33]">
                      <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-widest">
                        Category
                      </th>
                      {(weeklyStatsData?.weeks || []).map((week) => (
                        <th
                          key={week}
                          className="px-3 py-2 text-slate-400 uppercase tracking-widest whitespace-nowrap"
                        >
                          {week}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(weeklyStatsData?.rows || []).map((row) => (
                      <tr key={row.categoryId} className="border-t border-slate-800">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            <span className="text-slate-200 font-bold">{row.name}</span>
                          </div>
                        </td>
                        {row.counts.map((count, index) => (
                          <td
                            key={`${row.categoryId}-${index}`}
                            className="px-3 py-2 text-center text-slate-300"
                          >
                            {count}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      )}

      <Chat />
    </div>
  )
}
