interface WorkoutNoticeBannerProps {
  message: string
  tone: 'error' | 'info'
}

export function WorkoutNoticeBanner({ message, tone }: WorkoutNoticeBannerProps) {
  return (
    <div
      className={`mb-4 rounded-[1.2rem] border px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] shadow-[0_16px_32px_rgba(2,8,23,0.18)] ${
        tone === 'error'
          ? 'border-red-500/35 bg-red-500/10 text-red-100'
          : 'border-white/8 bg-white/5 text-slate-200 backdrop-blur-xl'
      }`}
    >
      {message}
    </div>
  )
}
