import { createContext, useContext, useState, useRef } from 'react'
import { today } from '../utils/helpers'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [origin, setOrigin] = useState('Civil Lines')
  const [dest, setDest] = useState('Jhunsi')
  const [travelDate, setTravelDate] = useState(today())
  const [buses, setBuses] = useState([])
  const [searching, setSearching] = useState(false)
  const [seatModalBus, setSeatModalBus] = useState(null)
  const [trackBusId, setTrackBusId] = useState(null)
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' })
  const toastTimer = useRef(null)

  const showToast = (message, type = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ visible: true, type, message })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000)
  }

  const openSeatModal = (bus) => {
    setSeatModalBus(bus)
    document.body.style.overflow = 'hidden'
  }
  const closeSeatModal = () => {
    setSeatModalBus(null)
    document.body.style.overflow = ''
  }

  return (
    <AppContext.Provider value={{
      origin, setOrigin, dest, setDest, travelDate, setTravelDate,
      buses, setBuses, searching, setSearching,
      seatModalBus, openSeatModal, closeSeatModal,
      trackBusId, setTrackBusId,
      toast, showToast,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
