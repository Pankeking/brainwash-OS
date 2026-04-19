import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

import { Chat, WeeklyCalendar, WorkoutTimers } from '~/components/components'
import { WorkoutBodyTab } from '~/features/workout/WorkoutBodyTab'
import { WorkoutCategoriesTab } from '~/features/workout/WorkoutCategoriesTab'
import { WORKOUT_TIME_ZONE } from '~/features/workout/workout.constants'
import { WorkoutExercisesTab } from '~/features/workout/WorkoutExercisesTab'
import { formatWorkoutDayLabel } from '~/features/workout/workout.format'
import { WorkoutHistoryTab } from '~/features/workout/WorkoutHistoryTab'
import { WorkoutNoticeBanner } from '~/features/workout/WorkoutNoticeBanner'
import { useWorkoutPageController } from '~/features/workout/useWorkoutPageController'
import { WorkoutTabBar } from '~/features/workout/WorkoutTabBar'
import { dayKeyFromDateInTimeZone } from '~/server/dayKey'
import {
  getBodyMetricsDayFn,
  getWorkoutDayFn,
  getWorkoutWeeklyCategoryStatsFn,
} from '~/server/workout'

export const Route = createFileRoute('/_authed/workout')({
  loader: async () => {
    const selectedDay = dayKeyFromDateInTimeZone(new Date(), WORKOUT_TIME_ZONE)
    const [workoutDayData, weeklyStatsData, bodyMetricsData] = await Promise.all([
      getWorkoutDayFn({ data: { selectedDay } }),
      getWorkoutWeeklyCategoryStatsFn({ data: { weeks: 4 } }),
      getBodyMetricsDayFn({ data: { selectedDay } }),
    ])

    return {
      bodyMetricsData,
      selectedDay,
      weeklyStatsData,
      workoutDayData,
    }
  },
  component: WorkoutView,
})

function WorkoutView() {
  const controller = useWorkoutPageController(Route.useLoaderData())

  return (
    <div className="min-h-screen bg-[#1A1F26] p-5 pb-32 font-sans text-slate-100">
      <header className="mb-6 flex items-center justify-between pt-2">
        <Link to="/" className="p-2 -ml-2 text-slate-400 transition-colors hover:text-white">
          <ChevronLeft size={24} />
        </Link>
        <div className="rounded-md border border-slate-700 bg-[#2A333E] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {formatWorkoutDayLabel(controller.selectedDay)}
        </div>
      </header>

      <WeeklyCalendar
        selectedDay={controller.selectedDay}
        onSelectDay={controller.setSelectedDay}
      />
      <WorkoutTabBar activeTab={controller.activeTab} onChange={controller.setActiveTab} />
      {controller.notice && (
        <WorkoutNoticeBanner message={controller.notice.message} tone={controller.notice.tone} />
      )}

      {controller.isLoading ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading workout data...</div>
      ) : (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={controller.activeTab === 'time' ? 'block' : 'hidden'}>
            <WorkoutTimers autoStartStopwatchToken={controller.timerAutoStartToken} />
          </div>

          {controller.activeTab === 'categories' && (
            <WorkoutCategoriesTab
              categories={controller.categories}
              isAddingCategory={controller.isAddingCategory}
              isWeeklyStatsLoading={controller.isWeeklyStatsLoading}
              newCategoryName={controller.newCategoryName}
              onAddCategory={controller.handleAddCategory}
              onCycleCategoryColor={controller.cycleCategoryColor}
              onRemoveCategory={(categoryId) =>
                controller.removeCategoryMutation.mutate({
                  data: { categoryId },
                })
              }
              onSetIsAddingCategory={controller.setIsAddingCategory}
              onSetNewCategoryName={controller.setNewCategoryName}
              onShowMoreWeeks={() => controller.setWeeksToShow((current) => current + 4)}
              weeklyStatsData={controller.weeklyStatsData}
            />
          )}

          {controller.activeTab === 'exercises' && (
            <WorkoutExercisesTab
              categories={controller.categories}
              expandedExerciseId={controller.expandedExerciseId}
              isAddingExercise={controller.isAddingExercise}
              logCountByExercise={controller.logCountByExercise}
              newExerciseName={controller.newExerciseName}
              onAddExercise={controller.handleAddExercise}
              onAddSet={controller.handleAddSet}
              onRemoveExercise={(exerciseId) =>
                controller.removeExerciseMutation.mutate({
                  data: { selectedDay: controller.selectedDay, exerciseId },
                })
              }
              onRenameExercise={(exerciseId, nextName) =>
                controller.renameExerciseMutation.mutate({
                  data: { exerciseId, nextName },
                })
              }
              onSetExpandedExerciseId={controller.setExpandedExerciseId}
              onSetIsAddingExercise={controller.setIsAddingExercise}
              onSetNewExerciseName={controller.setNewExerciseName}
              onToggleExerciseCategory={(exerciseId, categoryId) =>
                controller.toggleExerciseCategoryMutation.mutate({
                  data: { exerciseId, categoryId },
                })
              }
              onUpdateExerciseWeeklyGoal={controller.handleUpdateExerciseWeeklyGoal}
              sortedExercises={controller.sortedExercises}
            />
          )}

          {controller.activeTab === 'body' && (
            <WorkoutBodyTab
              definitions={controller.bodyMetricsData?.definitions || []}
              draftValues={controller.metricDrafts}
              entries={controller.bodyMetricsData?.entries || []}
              latest={controller.bodyMetricsData?.latest || []}
              newMetricKind={controller.newBodyMetricKind}
              newMetricLabel={controller.newBodyMetricLabel}
              onChangeDraft={(metricKey, value) =>
                controller.setMetricDrafts((current) => ({
                  ...current,
                  [metricKey]: value,
                }))
              }
              onCreateDefinition={controller.handleCreateBodyMetricDefinition}
              onRemoveDefinition={(metricKey) =>
                controller.removeMetricDefinitionMutation.mutate({
                  data: { metricKey },
                })
              }
              onRemoveEntry={(entryId) =>
                controller.removeMetricMutation.mutate({
                  data: { selectedDay: controller.selectedDay, entryId },
                })
              }
              onSaveMetric={controller.handleSaveMetric}
              onSetNewMetricKind={controller.setNewBodyMetricKind}
              onSetNewMetricLabel={controller.setNewBodyMetricLabel}
            />
          )}

          {controller.activeTab === 'history' && (
            <WorkoutHistoryTab
              confirmDeleteSetId={controller.confirmDeleteSetId}
              logs={controller.filteredLogs}
              onConfirmDeleteSetId={controller.setConfirmDeleteSetId}
              onRemoveSet={(logId) =>
                controller.removeSetMutation.mutate({
                  data: { selectedDay: controller.selectedDay, logId },
                })
              }
            />
          )}
        </section>
      )}

      <Chat
        context={{
          selectedDay: controller.selectedDay,
          activeTab: controller.activeTab,
        }}
        onWorkoutDataChanged={controller.onAssistantWorkoutChanged}
      />
    </div>
  )
}
