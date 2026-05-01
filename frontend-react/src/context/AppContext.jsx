import React, { createContext, useContext, useState, useRef, useMemo } from 'react';
import { API_BASE, OPS, STOPS } from '../constants';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'tickets'
  const [showResults, setShowResults] = useState(false);
  const [buses, setBuses] = useState([]);
  const [travelDate, setTravelDate] = useState(new Date().toISOString().split('T')[0]);
  const [origin, setOrigin] = useState('Civil Lines');
  const [dest, setDest] = useState('Jhunsi');

  // Filters
  const [activeTypes, setActiveTypes] = useState(['ac', 'seater']);
  const [activeTimes, setActiveTimes] = useState([]);
  const [maxPrice, setMaxPrice] = useState(300);
  const [sortKey, setSortKey] = useState('price');

  // Modals
  const [seatModalBus, setSeatModalBus] = useState(null);
  const [trackBusId, setTrackBusId] = useState(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState({ visible: false, ico: '', h: '', p: '' });
  const toastTimer = useRef(null);

  const showToast = (ico, h, p) => {
    clearTimeout(toastTimer.current);
    setToast({ visible: true, ico, h, p });
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4200);
  };

  const filteredAndSortedBuses = useMemo(() => {
    let result = buses.filter(b => {
      if (b.fare > maxPrice) return false;
      if (activeTypes.length > 0) {
        const isAc = b.tp.includes('AC') && !b.tp.includes('Non');
        const isNonAc = b.tp.includes('Non AC');
        const isSeater = b.tp.includes('Seater');
        const isSleeper = b.tp.includes('Sleeper');
        let typeMatch = false;
        if (activeTypes.includes('ac') && isAc) typeMatch = true;
        if (activeTypes.includes('nonac') && isNonAc) typeMatch = true;
        if (activeTypes.includes('seater') && isSeater) typeMatch = true;
        if (activeTypes.includes('sleeper') && isSleeper) typeMatch = true;
        if (!typeMatch) return false;
      }
      if (activeTimes.length > 0) {
        const hr = parseInt(b.dep.split(':')[0]);
        let timeMatch = false;
        if (activeTimes.includes('morning') && hr < 10) timeMatch = true;
        if (activeTimes.includes('afternoon') && hr >= 10 && hr < 17) timeMatch = true;
        if (!timeMatch) return false;
      }
      return true;
    });
    const sorted = [...result];
    if (sortKey === 'price') sorted.sort((a, b) => a.fare - b.fare);
    else if (sortKey === 'seats') sorted.sort((a, b) => b.capacity - a.capacity);
    else if (sortKey === 'rating') sorted.sort((a, b) => b.op.rt - a.op.rt);
    return sorted;
  }, [buses, maxPrice, activeTypes, activeTimes, sortKey]);

  const openSeatModal = (bus) => {
    setSeatModalBus(bus);
    document.body.style.overflow = 'hidden';
  };
  const closeSeatModal = () => {
    setSeatModalBus(null);
    document.body.style.overflow = '';
  };
  const openTrackModal = (busId) => {
    setTrackBusId(busId);
    document.body.style.overflow = 'hidden';
  };
  const closeTrackModal = () => {
    setTrackBusId(null);
    document.body.style.overflow = '';
  };

  const showHome = () => {
    setView('home');
    setShowResults(false);
  };

  const showTickets = () => {
    if (!userId) {
      showToast('⚠️', 'Login Required', 'Please login to view your tickets.');
      setLoginModalOpen(true);
      return;
    }
    setView('tickets');
  };

  const loginSuccess = (uid) => {
    setUserId(uid);
    setLoginModalOpen(false);
    showToast('✅', 'Login Successful', 'Welcome to Prayagraj Travels!');
  };

  const doLogout = () => {
    setUserId(null);
    showHome();
    showToast('ℹ️', 'Logged Out', 'You have been safely logged out.');
  };

  const doSearch = async (srcOverride, dstOverride) => {
    const source = srcOverride || origin;
    const destination = dstOverride || dest;
    if (!source || !destination) { showToast('⚠️', 'Missing Fields', 'Select origin and destination.'); return; }
    setShowResults(true);
    setBuses([]);
    try {
      const response = await fetch(`${API_BASE}/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`);
      const data = await response.json();
      if (!response.ok) throw new Error('Search failed');
      let dataBuses = data.buses || [];
      if (dataBuses.length === 0) {
        const fallbackRes = await fetch(`${API_BASE}/buses`);
        const allBuses = await fallbackRes.json();
        dataBuses = allBuses.slice(0, 4).map(b => ({ ...b, source, destination, fare: 25 + Math.floor(Math.random() * 40) }));
      }
      const enriched = dataBuses.map((b, i) => {
        const op = OPS[i % OPS.length];
        return { ...b, op, tp: i % 3 === 0 ? 'AC Sleeper' : (i % 2 === 0 ? 'AC Seater' : 'Non AC Seater'), dep: `${(8 + (i % 5)).toString().padStart(2, '0')}:30 AM`, arr: `${(9 + (i % 5)).toString().padStart(2, '0')}:45 AM`, dur: '1h 15m', ageMo: 1 + Math.floor(Math.random() * 12) };
      });
      setBuses(enriched);
    } catch (err) {
      showToast('❌', 'Error', 'Failed to fetch buses');
    }
  };

  const quickRoute = (o, d) => {
    setOrigin(o);
    setDest(d);
    doSearch(o, d);
  };

  return (
    <AppContext.Provider value={{
      userId, view, showResults, buses, travelDate, setTravelDate,
      origin, setOrigin, dest, setDest,
      activeTypes, setActiveTypes, activeTimes, setActiveTimes,
      maxPrice, setMaxPrice, sortKey, setSortKey,
      seatModalBus, openSeatModal, closeSeatModal,
      trackBusId, openTrackModal, closeTrackModal,
      loginModalOpen, setLoginModalOpen,
      toast, showToast,
      filteredAndSortedBuses,
      showHome, showTickets, loginSuccess, doLogout, doSearch, quickRoute,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
