export default function Hero({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start max-w-md w-full mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h1 className="text-6xl font-black tracking-tighter mb-2">
        {title}
        <span className="text-orange-500">.</span>
      </h1>
      <p className="text-slate-400 text-lg font-medium leading-tight">{children}</p>
    </div>
  )
}
