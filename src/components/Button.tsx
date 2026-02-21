import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  children,
  className,
  ...props
}: ButtonProps) {
  const baseStyles =
    'bg-[#2A333E]/50 backdrop-blur-md px-8 py-4 rounded-full border border-slate-700/50 px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 active:scale-95 shadow-lg flex items-center gap-2'

  const variants = {
    // Dark slate with a subtle top highlight
    primary: 'bg-[#2A333E] text-white shadow-[0_4px_0_0_#1a1f26] hover:bg-[#343e4a]',
    // The "Goal" orange from the design
    accent: 'bg-[#D97706] text-white shadow-[0_4px_0_0_#92400E] hover:bg-[#F59E0B]',
    // The "Task" green
    secondary: 'bg-[#4D6B53] text-white shadow-[0_4px_0_0_#364d3b] hover:bg-[#5f8266]',
    // For the MCP Chat bubble
    ghost: 'bg-transparent text-slate-300 hover:text-white',
  }

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
