import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { API_BASE } from '../constants'

export default function MyTickets() {
  const { userId, openTrackModal, showToast } = useApp()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchTickets = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API_BASE}/bookings?userId=${userId}`)
      const data = await res.json()
      setTickets(data || [])
    } catch (err) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) fetchTickets()
  }, [userId])

  const cancelTicket = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this ticket?')) return
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}?userId=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('✅', 'Cancelled', 'Ticket cancelled successfully')
        fetchTickets()
      } else {
        showToast('❌', 'Error', 'Failed to cancel')
      }
    } catch (err) {
      showToast('❌', 'Error', 'Failed to cancel')
    }
  }

  return (
    <div id="myTicketsSection">
      <h2 style={{ marginBottom: '20px' }}>My Tickets</h2>

      {loading && (
        <div className="ldr show">
          <div className="spin"></div>
          <p>Loading tickets...</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ color: 'red' }}>Failed to load tickets.</div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="no-res">🎟 No tickets found.</div>
      )}

      {!loading && tickets.map(tkt => (
        <div className="tkt-card" key={tkt.booking_id}>
          <div className="tkt-hdr">
            <div>
              <strong>{tkt.bus_name}</strong><br />
              <span style={{ fontSize: '0.8rem', color: 'var(--txt3)' }}>
                {tkt.source} → {tkt.destination}
              </span>
            </div>
            <div>
              <span className={`tkt-status ${tkt.status}`}>{tkt.status}</span>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            fontSize: '0.85rem',
            marginBottom: '12px'
          }}>
            <div><b>Date:</b> {tkt.travel_date}</div>
            <div><b>Seat:</b> {tkt.seat_number}</div>
            <div><b>Passenger:</b> {tkt.passenger_name}</div>
            <div><b>Fare:</b> ₹{tkt.fare_paid}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {tkt.status === 'CONFIRMED' && (
              <button
                className="tkt-cancel-btn"
                style={{ background: 'var(--blue)', border: 'none', color: '#fff' }}
                onClick={() => openTrackModal(tkt.bus_id)}
              >
                Track Bus
              </button>
            )}
            {tkt.status === 'CONFIRMED' && (
              <button
                className="tkt-cancel-btn"
                onClick={() => cancelTicket(tkt.booking_id)}
              >
                Cancel Ticket
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
