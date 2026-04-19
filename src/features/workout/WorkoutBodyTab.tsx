import { Check, Ruler, Trash2, Weight } from 'lucide-react'

import type { BodyMetricDefinition, BodyMetricEntry, BodyMetricLatestValue } from './workout.types'

interface WorkoutBodyTabProps {
  definitions: BodyMetricDefinition[]
  draftValues: Record<string, string>
  entries: BodyMetricEntry[]
  latest: BodyMetricLatestValue[]
  onChangeDraft: (metricKey: string, value: string) => void
  onRemoveEntry: (entryId: string) => void
  onSaveMetric: (metricKey: string) => void
}

export function WorkoutBodyTab({
  definitions,
  draftValues,
  entries,
  latest,
  onChangeDraft,
  onRemoveEntry,
  onSaveMetric,
}: WorkoutBodyTabProps) {
  const latestByMetric = new Map(latest.map((item) => [item.metricKey, item]))
  const groupedDefinitions = {
    weight: definitions.filter((metric) => metric.kind === 'weight'),
    size: definitions.filter((metric) => metric.kind === 'size'),
  }

  const renderMetricCard = (definition: BodyMetricDefinition) => {
    const latestValue = latestByMetric.get(definition.key)

    return (
      <div key={definition.key} className="rounded-2xl border border-slate-700 bg-[#2A333E] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black text-slate-100">{definition.label}</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {definition.unit}
            </div>
          </div>
          {latestValue && (
            <div className="text-right">
              <div className="text-sm font-black text-orange-300">
                {latestValue.value} {latestValue.unit}
              </div>
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                Latest
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={draftValues[definition.key] || ''}
            onChange={(event) => onChangeDraft(definition.key, event.target.value)}
            placeholder={`Enter ${definition.unit}`}
            inputMode="decimal"
            className="flex-1 rounded-xl border border-slate-700 bg-[#1A1F26] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          <button
            onClick={() => onSaveMetric(definition.key)}
            className="flex h-10 items-center gap-1 rounded-xl bg-orange-600 px-3 text-[9px] font-black uppercase tracking-widest text-white"
          >
            <Check size={12} />
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <Weight size={12} className="text-orange-500" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Weight</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {groupedDefinitions.weight.map(renderMetricCard)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <Ruler size={12} className="text-orange-500" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Measurements</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groupedDefinitions.size.map(renderMetricCard)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <Ruler size={12} />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Logged Today</h3>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
            No body metrics logged for this day
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-[#232a33]/40 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-black text-slate-100">{entry.label}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {new Date(entry.loggedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-slate-800 bg-[#1A1F26] px-3 py-1 text-sm font-black text-orange-300">
                    {entry.value} {entry.unit}
                  </div>
                  <button
                    onClick={() => onRemoveEntry(entry.id)}
                    className="p-1.5 text-slate-600 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
