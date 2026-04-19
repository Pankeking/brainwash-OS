import { Check, PlusCircle, Ruler, Trash2, Weight } from 'lucide-react'

import { formatMetricValue } from '~/lib/number-input'

import type { BodyMetricDefinition, BodyMetricEntry, BodyMetricLatestValue } from './workout.types'

interface WorkoutBodyTabProps {
  definitions: BodyMetricDefinition[]
  draftValues: Record<string, string>
  entries: BodyMetricEntry[]
  latest: BodyMetricLatestValue[]
  newMetricKind: 'weight' | 'size'
  newMetricLabel: string
  onChangeDraft: (metricKey: string, value: string) => void
  onCreateDefinition: () => void
  onRemoveDefinition: (metricKey: string) => void
  onRemoveEntry: (entryId: string) => void
  onSaveMetric: (metricKey: string) => void
  onSetNewMetricKind: (kind: 'weight' | 'size') => void
  onSetNewMetricLabel: (label: string) => void
}

export function WorkoutBodyTab({
  definitions,
  draftValues,
  entries,
  latest,
  newMetricKind,
  newMetricLabel,
  onChangeDraft,
  onCreateDefinition,
  onRemoveDefinition,
  onRemoveEntry,
  onSaveMetric,
  onSetNewMetricKind,
  onSetNewMetricLabel,
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
                {formatMetricValue(latestValue.value)} {latestValue.unit}
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
        {definition.isCustom ? (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => onRemoveDefinition(definition.key)}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-300"
            >
              Remove Metric
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-700 bg-[#2A333E] p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <PlusCircle size={12} className="text-orange-500" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Custom Metrics</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={newMetricLabel}
            onChange={(event) => onSetNewMetricLabel(event.target.value)}
            placeholder="Forearm, shoulder, body fat..."
            className="rounded-xl border border-slate-700 bg-[#1A1F26] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          <div className="flex overflow-hidden rounded-xl border border-slate-700">
            <button
              onClick={() => onSetNewMetricKind('size')}
              className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest ${
                newMetricKind === 'size'
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#1A1F26] text-slate-400'
              }`}
            >
              Size (cm)
            </button>
            <button
              onClick={() => onSetNewMetricKind('weight')}
              className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest ${
                newMetricKind === 'weight'
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#1A1F26] text-slate-400'
              }`}
            >
              Weight (kg)
            </button>
          </div>
          <button
            onClick={onCreateDefinition}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white"
          >
            <PlusCircle size={12} />
            Add Metric
          </button>
        </div>
      </section>

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
                    {formatMetricValue(entry.value)} {entry.unit}
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
