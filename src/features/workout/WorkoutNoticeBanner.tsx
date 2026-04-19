interface WorkoutNoticeBannerProps {
  message: string
  tone: 'error' | 'info'
}

export function WorkoutNoticeBanner({ message, tone }: WorkoutNoticeBannerProps) {
  return (
    <div
      className={`mb-4 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
        tone === 'error'
          ? 'border-red-500/40 bg-red-500/10 text-red-200'
          : 'border-slate-700 bg-[#2A333E] text-slate-300'
      }`}
    >
      {message}
    </div>
  )
}
