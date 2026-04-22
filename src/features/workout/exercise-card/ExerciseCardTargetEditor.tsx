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
    <div className="rounded-xl border border-slate-700 bg-[#1A1F26] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          {inputLabel}
        </div>
        {previewLabel ? (
          <div className="text-[9px] font-black uppercase tracking-widest text-orange-400">
            {previewLabel}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          className="h-10 flex-1 rounded-xl border border-slate-700 bg-[#222a33] px-3 text-sm font-black text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        <button
          onClick={onSave}
          className="h-10 rounded-xl bg-orange-600 px-3 text-[9px] font-black uppercase tracking-widest text-white"
        >
          {saveLabel}
        </button>
        <button
          onClick={onClear}
          className="h-10 rounded-xl border border-slate-700 bg-[#222a33] px-3 text-[9px] font-black uppercase tracking-widest text-slate-300"
        >
          {clearLabel}
        </button>
      </div>
    </div>
  )
}
