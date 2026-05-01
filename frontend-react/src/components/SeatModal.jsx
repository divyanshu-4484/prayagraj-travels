import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { API_BASE } from '../constants'

export default function SeatModal() {
  const { seatModalBus, closeSeatModal, userId, travelDate, showToast, setLoginModalOpen, openSeatModal } = useApp()

  const [seatMapData, setSeatMapData] = useState(null)
  const [seatMapLoading, setSeatMapLoading] = useState(false)
  const [seatMapError, setSeatMapError] = useState(false)
  const [selectedSeat, setSelectedSeat] = useState(null) // { number, isWindow }
  const [isHolding, setIsHolding] = useState(false)
  const [timeLeft, setTimeLeft] = useState(120)
  const [showPassengerForm, setShowPassengerForm] = useState(false)
  const [passengerName, setPassengerName] = useState('')
  const [passengerPhone, setPassengerPhone] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [holdLoading, setHoldLoading] = useState(false)

  const timerRef = useRef(null)
  const isOpen = !!seatModalBus

  // Load seat map when modal opens
  useEffect(() => {
    if (!seatModalBus) {
      // Reset all state on close
      setSeatMapData(null)
      setSeatMapLoading(false)
      setSeatMapError(false)
      setSelectedSeat(null)
      setIsHolding(false)
      setShowPassengerForm(false)
      setPassengerName('')
      setPassengerPhone('')
      clearInterval(timerRef.current)
      return
    }

    const loadSeats = async () => {
      setSeatMapLoading(true)
      setSeatMapError(false)
      setSeatMapData(null)
      setSelectedSeat(null)
      setIsHolding(false)
      setShowPassengerForm(false)
      setPassengerName('')
      setPassengerPhone('')
      clearInterval(timerRef.current)
      try {
        const res = await fetch(`${API_BASE}/seats?busId=${seatModalBus.id}&travelDate=${travelDate}`)
        const data = await res.json()
        setSeatMapData(data)
      } catch (err) {
        setSeatMapError(true)
      } finally {
        setSeatMapLoading(false)
      }
    }

    loadSeats()
  }, [seatModalBus, travelDate])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const startHoldTimer = (seconds) => {
    clearInterval(timerRef.current)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          showToast('⏳', 'Timeout', 'Seat hold expired')
          // Reload seat map
          if (seatModalBus) {
            fetch(`${API_BASE}/seats?busId=${seatModalBus.id}&travelDate=${travelDate}`)
              .then(r => r.json())
              .then(data => {
                setSeatMapData(data)
                setIsHolding(false)
                setShowPassengerForm(false)
                setSelectedSeat(null)
              })
              .catch(() => {})
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const pickSeat = (seatObj, colIdx) => {
    if (isHolding) return
    const isWindow = colIdx === 0 || colIdx === 3
    setSelectedSeat({ number: seatObj.seatNumber, isWindow })
  }

  const handleClose = async () => {
    if (isHolding && seatModalBus && selectedSeat) {
      try {
        await fetch(`${API_BASE}/seats/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            busId: seatModalBus.id,
            seatNumber: selectedSeat.number,
            travelDate,
            userId
          })
        })
      } catch (e) {}
    }
    clearInterval(timerRef.current)
    closeSeatModal()
  }

  const holdSeat = async () => {
    if (!userId) {
      showToast('⚠️', 'Login Required', 'Please login to hold seats.')
      setLoginModalOpen(true)
      return
    }
    if (!selectedSeat) return
    setHoldLoading(true)
    try {
      const res = await fetch(`${API_BASE}/seats/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: seatModalBus.id,
          seatNumber: selectedSeat.number,
          travelDate,
          userId
        })
      })
      const data = await res.json()
      if (!res.ok) {
        showToast('⚠️', 'Seat Unavailable', data.message)
        // Reload
        const r2 = await fetch(`${API_BASE}/seats?busId=${seatModalBus.id}&travelDate=${travelDate}`)
        setSeatMapData(await r2.json())
        setSelectedSeat(null)
        return
      }
      setIsHolding(true)
      setShowPassengerForm(true)
      startHoldTimer(data.holdExpiresInSeconds || 120)
    } catch (err) {
      showToast('❌', 'Error', 'Failed to hold seat')
    } finally {
      setHoldLoading(false)
    }
  }

  const confirmBooking = async () => {
    const nm = passengerName.trim()
    const ph = passengerPhone.trim()
    if (!nm) { showToast('⚠️', 'Missing Name', 'Enter passenger name.'); return }
    if (!/^\d{10}$/.test(ph)) { showToast('⚠️', 'Invalid Phone', 'Enter a valid 10-digit number.'); return }
    setConfirmLoading(true)
    try {
      const res = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: seatModalBus.id,
          seatNumber: selectedSeat.number,
          travelDate,
          userId,
          passengerName: nm,
          passengerPhone: ph
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Booking failed')
      clearInterval(timerRef.current)
      setIsHolding(false)
      closeSeatModal()
      showToast('🎉', 'Booking Confirmed!', `Seat ${selectedSeat.number} booked for ₹${seatModalBus.fare}`)
    } catch (err) {
      showToast('❌', 'Booking Failed', err.message)
    } finally {
      setConfirmLoading(false)
    }
  }

  // Build seat grid rows
  const buildRows = (seats) => {
    const rows = []
    for (let i = 0; i < seats.length; i += 4) {
      rows.push(seats.slice(i, i + 4))
    }
    return rows
  }

  return (
    <div className={`ov${isOpen ? ' open' : ''}`} id="ov">
      <div className="sm">
        <div className="sm-hdr">
          <div className="sm-hdr-txt">
            <h2>{seatModalBus ? `${seatModalBus.source} → ${seatModalBus.destination}` : 'Select Your Seat'}</h2>
            <p>{seatModalBus ? `${seatModalBus.name} · Dep: ${seatModalBus.dep}` : ''}</p>
          </div>
          <button className="sm-x" onClick={handleClose}>✕</button>
        </div>

        <div className="sm-bod">
          {/* Legend */}
          <div className="sleg">
            <div className="sl"><div className="slb s-av"></div>Available</div>
            <div className="sl"><div className="slb s-wn"></div>Window</div>
            <div className="sl"><div className="slb s-sl"></div>Selected</div>
            <div className="sl"><div className="slb s-bk"></div>Booked/Held</div>
          </div>

          {/* Bus Layout */}
          <div className="bus-layout">
            <div className="drv-row">
              <div className="drv-box">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
                </svg>
                Driver
              </div>
            </div>
            <div className="seat-grid">
              {seatMapLoading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--txt2)' }}>Loading seats...</div>}
              {seatMapError && <div style={{ color: 'red', textAlign: 'center', padding: '10px' }}>Failed to load seats</div>}
              {seatMapData && buildRows(seatMapData.seats).map((row, rowIdx) => (
                <div className="s-row" key={rowIdx}>
                  {[0, 1, 'aisle', 2, 3].map((colKey, i) => {
                    if (colKey === 'aisle') return <div key="aisle" className="s-aisle"></div>
                    const seatObj = row[colKey]
                    if (!seatObj) return <div key={colKey}></div>
                    const isWindow = colKey === 0 || colKey === 3
                    const isBooked = seatObj.status === 'BOOKED' || seatObj.status === 'HELD'
                    const isHeld = seatObj.status === 'HELD'
                    const isSelected = selectedSeat && selectedSeat.number === seatObj.seatNumber
                    let cls = 'seat'
                    if (isWindow) cls += ' wn'
                    if (isBooked) cls += isHeld ? ' hld' : ' bk'
                    if (isSelected) cls += ' sel'
                    return (
                      <div
                        key={seatObj.seatNumber}
                        className={cls}
                        onClick={() => !isBooked && pickSeat(seatObj, colKey)}
                      >
                        {seatObj.seatNumber}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Booking Panel */}
          <div className="bp">
            <div className="bp-ttl">Booking Details</div>

            <div className="bp-grid" style={{ marginBottom: '15px' }}>
              <div className="bp-grp" style={{ gridColumn: '1/-1' }}>
                <div className="bp-lbl">Selected Seat</div>
                {selectedSeat ? (
                  <div className="sel-box">
                    🪑 Seat <strong style={{ marginLeft: '4px' }}>{selectedSeat.number}</strong>
                    <span style={{ marginLeft: '4px' }}>· {selectedSeat.isWindow ? 'Window' : 'Aisle'}</span>
                  </div>
                ) : (
                  <div className="sel-box emp">👆 Tap a seat to select</div>
                )}
                {isHolding && (
                  <div className="hold-timer">
                    Seat held for <span>{formatTime(timeLeft)}</span>. Please complete payment.
                  </div>
                )}
              </div>
            </div>

            {showPassengerForm && (
              <div className="bp-grid" style={{ marginBottom: '0' }}>
                <div className="bp-grp">
                  <div className="bp-lbl">Full Name</div>
                  <input
                    className="bp-inp"
                    type="text"
                    placeholder="Passenger name"
                    value={passengerName}
                    onChange={e => setPassengerName(e.target.value)}
                  />
                </div>
                <div className="bp-grp">
                  <div className="bp-lbl">Mobile No.</div>
                  <input
                    className="bp-inp"
                    type="tel"
                    maxLength="10"
                    placeholder="10-digit number"
                    value={passengerPhone}
                    onChange={e => setPassengerPhone(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="fare-sum">
              <span className="fs-lbl">💳 Amount Payable</span>
              <span className="fs-amt">
                {selectedSeat && seatModalBus ? `₹${seatModalBus.fare}` : '₹—'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {!isHolding && (
                <button
                  className="cfm-btn"
                  disabled={!selectedSeat || holdLoading}
                  onClick={holdSeat}
                  style={{ background: 'var(--orange)' }}
                >
                  {holdLoading ? 'Holding...' : '🔒 Hold Seat'}
                </button>
              )}
              {isHolding && (
                <button
                  className="cfm-btn"
                  disabled={confirmLoading}
                  onClick={confirmBooking}
                >
                  {confirmLoading ? '⏳ Processing…' : '🎟 Pay & Book'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
