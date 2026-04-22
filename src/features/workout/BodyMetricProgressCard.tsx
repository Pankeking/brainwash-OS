import { formatMetricValue } from '~/lib/number-input'

import type { BodyMetricStats } from './workout.types'
import { formatMetricStatDate } from './workout.formatting'

interface BodyMetricProgressCardProps {
  stats: BodyMetricStats
}

function renderValue(value: number, unit: 'kg' | 'cm') {
  return `${formatMetricValue(value)} ${unit}`
}

function renderExtremaRow(label: string, point: BodyMetricStats['overallHigh'], unit: 'kg' | 'cm') {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-[#1A1F26] px-3 py-2">
      <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      {point ? (
        <>
          <div className="mt-1 text-sm font-black text-slate-100">
            {renderValue(point.value, unit)}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            {formatMetricStatDate(point.loggedAt)}
          </div>
        </>
      ) : (
        <div className="mt-1 text-[9px] font-bold text-slate-500">No data yet</div>
      )}
    </div>
  )
}

export function BodyMetricProgressCard({ stats }: BodyMetricProgressCardProps) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-slate-700/60 bg-[#222a33] p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {renderExtremaRow('Overall High', stats.overallHigh, stats.unit)}
        {renderExtremaRow('Overall Low', stats.overallLow, stats.unit)}
        {renderExtremaRow('First Recorded', stats.firstRecorded, stats.unit)}
        {renderExtremaRow('Last Recorded', stats.lastRecorded, stats.unit)}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700/50 bg-[#1A1F26] p-3">
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-orange-400">
            Weekly Progression
          </div>
          <div className="space-y-2">
            {stats.weekly.length === 0 ? (
              <div className="text-[9px] font-bold text-slate-500">No weekly history yet</div>
            ) : (
              stats.weekly.map((bucket) => (
                <div
                  key={bucket.label}
                  className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))] items-center gap-2 text-[9px]"
                >
                  <div className="font-black uppercase tracking-widest text-slate-500">
                    {bucket.label}
                  </div>
                  <div className="rounded-lg bg-[#222a33] px-2 py-1 text-slate-300">
                    L {renderValue(bucket.low, stats.unit)}
                  </div>
                  <div className="rounded-lg bg-[#222a33] px-2 py-1 text-orange-300">
                    A {renderValue(bucket.avg, stats.unit)}
                  </div>
                  <div className="rounded-lg bg-[#222a33] px-2 py-1 text-slate-100">
                    H {renderValue(bucket.high, stats.unit)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/50 bg-[#1A1F26] p-3">
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-orange-400">
            Monthly Progression
          </div>
          <div className="space-y-2">
            {stats.monthly.length === 0 ? (
              <div className="text-[9px] font-bold text-slate-500">No monthly history yet</div>
            ) : (
              stats.monthly.map((bucket) => (
                <div
                  key={bucket.label}
                  className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] items-center gap-2 text-[9px]"
                >
                  <div className="font-black uppercase tracking-widest text-slate-500">
                    {bucket.label}
                  </div>
                  <div className="rounded-lg bg-[#222a33] px-2 py-1 text-slate-300">
                    L {renderValue(bucket.low, stats.unit)}
                  </div>
                  <div className="rounded-lg bg-[#222a33] px-2 py-1 text-orange-300">
                    A {renderValue(bucket.avg, stats.unit)}
                  </div>
                  <div className="rounded-lg bg-[#222a33] px-2 py-1 text-slate-100">
                    H {renderValue(bucket.high, stats.unit)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
