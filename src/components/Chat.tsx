import { MessageSquare } from 'lucide-react'

export default function Chat() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button className="bg-orange-600 p-3.5 rounded-2xl shadow-2xl text-white active:scale-95 transition-transform">
        <MessageSquare size={22} fill="currentColor" />
      </button>
    </div>
  )
}
