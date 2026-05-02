import { useState, useEffect } from 'react'
import { Download, X, ArrowRight, Search, Filter } from 'lucide-react'
import { bookingService } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function BookingsPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => {
    if (!user) return
    bookingService.getByUser(user.id)
      .then(data => setBookings(Array.isArray(data) ? data : []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [user])

  const handleCancel = async (bk) => {
    const id = bk?.bookingId
    if (!id) {
    toast.error('Invalid booking ID')
    return
  }
    if (!window.confirm(`Cancel booking #${id}? Refund will be processed within 3-5 business days.`)) return
    setCancelling(id)
    try {
      await bookingService.cancel(id, user.id)
      setBookings(prev => prev.map(b => b?.bookingId === id ? { ...b, status: 'CANCELLED' } : b))
      toast.success('Booking cancelled. Refund initiated.')
    } catch (e) {
      toast.error(e.message || 'Cancellation failed')
    } finally { setCancelling(null) }
  }

  const filtered = bookings.filter(b => {
    const id = b?.bookingId
    const matchFilter = filter === 'all' || b.status?.toLowerCase() === filter
    const matchSearch = !search || b.passenger_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(b.bus_id).includes(search) || String(id).includes(search)
    return matchFilter && matchSearch
  })

  const statusVariant = { CONFIRMED: 'confirmed', CANCELLED: 'cancelled', PENDING: 'warning' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Bookings</h1>
          <p className="text-slate-500 text-sm mt-1">{bookings.length} total bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, bus ID…" className="form-input pl-9 py-2 text-sm" />
          </div>
          <div className="flex gap-1">
            {[
              { val: 'all', label: 'All' },
              { val: 'confirmed', label: 'Confirmed' },
              { val: 'cancelled', label: 'Cancelled' },
            ].map(f => (
              <button key={f.val} onClick={() => setFilter(f.val)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  filter === f.val ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🎟️" title="No bookings yet"
          description="You haven't booked any tickets yet. Start by searching for buses."
          action={<Link to="/"><Button variant="primary">Search Buses</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(bk => {
            const bkId = bk?.bookingId
            return (
            <div key={bkId} className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-extrabold text-slate-900 text-sm">Booking #{bkId}</span>
                      <Badge variant={statusVariant[bk.status] || 'default'}>{bk.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">Bus #{bk.bus_id} • Seat {bk.seat_number}</p>
                  </div>
                  <span className="text-xl font-extrabold text-primary-600">₹{bk.fare || 25}</span>
                </div>

                <div className="flex items-center gap-3 py-3 border-y border-slate-100 mb-4">
                  <div className="text-center">
                    <p className="font-extrabold text-slate-900 text-sm">{bk.source || 'Civil Lines'}</p>
                    <p className="text-xs text-slate-400">From</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="text-center">
                    <p className="font-extrabold text-slate-900 text-sm">{bk.destination || 'Naini'}</p>
                    <p className="text-xs text-slate-400">To</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-bold text-slate-700 text-sm">{formatDate(bk.travel_date)}</p>
                    <p className="text-xs text-slate-400">{bk.passenger_name}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => toast.success('Ticket download coming soon!')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Download Ticket
                  </button>
                  {bk.status === 'CONFIRMED' && (
                    <Button onClick={() => handleCancel(bk)} variant="danger" size="sm"
                      loading={cancelling === bkId}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
