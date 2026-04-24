interface ExerciseCardTargetEditorProps {
  clearLabel: string
  inputLabel: string
  inputValue: string
  onChange: (value: string) => void
  onClear: () => void
  onSave: () => void
  previewLabel: string | null
  saveLabel: string
}

export function ExerciseCardTargetEditor({
  clearLabel,
  inputLabel,
  inputValue,
  onChange,
  onClear,
  onSave,
  previewLabel,
  saveLabel,
}: ExerciseCardTargetEditorProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#202834]/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-2.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
          {inputLabel}
        </div>
        {previewLabel ? (
          <div className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-orange-300">
            {previewLabel}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#1A1F26] px-4 text-[16px] font-bold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 md:text-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
          <button
            onClick={onSave}
            className="h-12 rounded-xl bg-orange-500 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]"
          >
            {saveLabel}
          </button>
          <button
            onClick={onClear}
            className="h-12 rounded-xl border border-white/8 bg-[#1A1F26] px-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300"
          >
            {clearLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
