import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, MapPin, Calendar, Search } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { STOPS } from '../../utils/constants'
import { today } from '../../utils/helpers'
import Button from '../ui/Button'
import toast from 'react-hot-toast'

export default function SearchPanel({ compact = false }) {
  const navigate = useNavigate()
  const { origin, setOrigin, dest, setDest, travelDate, setTravelDate } = useApp()
  const [loading, setLoading] = useState(false)

  const swap = () => {
    const tmp = origin
    setOrigin(dest)
    setDest(tmp)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (!origin || !dest) return toast.error('Please select origin and destination')
    if (origin === dest) return toast.error('Origin and destination cannot be same')
    navigate(`/search?source=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&date=${travelDate}`)
  }

  const base = compact
    ? 'bg-white rounded-2xl shadow-card border border-slate-100 p-4'
    : 'bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-glass'

  const labelClass = compact ? 'text-[10px] font-bold uppercase tracking-widest text-slate-400' : 'text-[10px] font-bold uppercase tracking-widest text-white/60'
  const valueClass = compact ? 'text-sm font-bold text-slate-800 mt-0.5 truncate' : 'text-sm font-bold text-white mt-0.5 truncate'
  const selectClass = compact
    ? 'block w-full text-sm font-bold text-slate-800 bg-transparent border-0 focus:ring-0 p-0 appearance-none cursor-pointer'
    : 'block w-full text-sm font-bold text-white bg-transparent border-0 focus:ring-0 p-0 appearance-none cursor-pointer [&>option]:text-slate-800 [&>option]:bg-white'
  const inputClass = compact
    ? 'block w-full text-sm font-bold text-slate-800 bg-transparent border-0 focus:ring-0 p-0 cursor-pointer'
    : 'block w-full text-sm font-bold text-white bg-transparent border-0 focus:ring-0 p-0 cursor-pointer'

  const divider = compact ? 'w-px h-10 bg-slate-200' : 'w-px h-10 bg-white/20'
  const fieldHover = compact ? 'hover:bg-slate-50 rounded-xl' : 'hover:bg-white/10 rounded-xl'

  return (
    <form onSubmit={handleSearch} className={base}>
      <div className="flex flex-col sm:flex-row items-stretch gap-0">
        {/* From */}
        <div className={`flex-1 flex items-center gap-3 px-4 py-3 ${fieldHover} transition-colors cursor-pointer`}>
          <MapPin className={`w-5 h-5 flex-shrink-0 ${compact ? 'text-primary-400' : 'text-white/60'}`} />
          <div className="flex-1 min-w-0">
            <p className={labelClass}>From</p>
            <select value={origin} onChange={e => setOrigin(e.target.value)} className={selectClass} required>
              {STOPS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Swap */}
        <div className={`hidden sm:flex items-center ${divider}`} />
        <button type="button" onClick={swap}
          className={`hidden sm:flex items-center justify-center w-10 h-10 m-auto rounded-full border transition-all duration-200 ${
            compact ? 'border-slate-200 text-slate-500 hover:border-primary-400 hover:text-primary-600 hover:rotate-180'
                    : 'border-white/30 text-white/70 hover:border-white hover:text-white hover:rotate-180'
          }`}>
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <div className={`hidden sm:flex items-center ${divider}`} />

        {/* To */}
        <div className={`flex-1 flex items-center gap-3 px-4 py-3 ${fieldHover} transition-colors cursor-pointer`}>
          <MapPin className={`w-5 h-5 flex-shrink-0 ${compact ? 'text-accent-500' : 'text-white/60'}`} />
          <div className="flex-1 min-w-0">
            <p className={labelClass}>To</p>
            <select value={dest} onChange={e => setDest(e.target.value)} className={selectClass} required>
              {STOPS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className={`hidden sm:flex items-center ${divider}`} />

        {/* Date */}
        <div className={`flex items-center gap-3 px-4 py-3 ${fieldHover} transition-colors cursor-pointer min-w-[160px]`}>
          <Calendar className={`w-5 h-5 flex-shrink-0 ${compact ? 'text-primary-400' : 'text-white/60'}`} />
          <div className="flex-1 min-w-0">
            <p className={labelClass}>Date</p>
            <input type="date" value={travelDate} onChange={e => setTravelDate(e.target.value)}
              min={today()} className={inputClass} required />
          </div>
        </div>

        {/* Search button */}
        <div className="px-3 py-3 flex items-center">
          <Button type="submit" variant="primary" size="lg" loading={loading}
            className="w-full sm:w-auto rounded-xl gap-2 font-bold">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
            <span className="sm:hidden">Search Buses</span>
          </Button>
        </div>
      </div>

      {/* Quick picks */}
      <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${compact ? 'border-slate-100' : 'border-white/10'} flex-wrap`}>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${compact ? 'text-slate-400' : 'text-white/50'}`}>Quick:</span>
        {[
          ['Civil Lines', 'Airport'],
          ['Sangam', 'Civil Lines'],
          ['Chowk', 'Naini'],
          ['Phaphamau', 'Allahabad University'],
        ].map(([f, t]) => (
          <button key={`${f}-${t}`} type="button"
            onClick={() => { setOrigin(f); setDest(t) }}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              compact ? 'bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}>
            {f} → {t}
          </button>
        ))}
      </div>
    </form>
  )
}
