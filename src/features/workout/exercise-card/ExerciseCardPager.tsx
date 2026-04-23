import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react'

interface ExerciseCardPagerProps {
  pages: Array<{
    id: string
    label: string
    content: ReactNode
  }>
}

export function ExerciseCardPager({ pages }: ExerciseCardPagerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [activePage, setActivePage] = useState(0)

  const scrollToPage = (index: number) => {
    const container = scrollRef.current
    if (!container) {
      return
    }
    const safeIndex = Math.max(0, Math.min(index, pages.length - 1))
    container.scrollTo({
      left: safeIndex * container.clientWidth,
      behavior: 'smooth',
    })
    setActivePage(safeIndex)
  }

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget
    if (clientWidth <= 0) {
      return
    }
    const nextPage = Math.round(scrollLeft / clientWidth)
    if (nextPage !== activePage) {
      setActivePage(nextPage)
    }
  }

  useEffect(() => {
    const handleResize = () => scrollToPage(activePage)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activePage])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-full border border-white/8 bg-[#161d26]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
          {pages[activePage]?.label}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollToPage(activePage - 1)}
            disabled={activePage === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/6 text-slate-300 disabled:opacity-35"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            {pages.map((page, index) => (
              <button
                key={page.id}
                onClick={() => scrollToPage(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === activePage ? 'bg-orange-400' : 'bg-white/18'
                }`}
                aria-label={`Go to ${page.label}`}
              />
            ))}
          </div>
          <button
            onClick={() => scrollToPage(activePage + 1)}
            disabled={activePage === pages.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/6 text-slate-300 disabled:opacity-35"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {pages.map((page) => (
          <div key={page.id} className="min-w-full snap-center">
            {page.content}
          </div>
        ))}
      </div>
    </div>
  )
}
