import { AlertTriangle } from 'lucide-react'

interface ExerciseCardDeleteConfirmProps {
  name: string
  onCancel: () => void
  onConfirm: () => void
}

export function ExerciseCardDeleteConfirm({
  name,
  onCancel,
  onConfirm,
}: ExerciseCardDeleteConfirmProps) {
  return (
    <div className="animate-in fade-in zoom-in-95 py-2 duration-200">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500">
          <AlertTriangle size={14} />
          Delete {name}?
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg bg-slate-700 py-2 text-[9px] font-black uppercase tracking-widest text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 py-2 text-[9px] font-black uppercase tracking-widest text-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
