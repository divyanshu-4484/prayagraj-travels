import React from 'react'
import { AppProvider } from './context/AppContext'
import Nav from './components/Nav'
import SearchBar from './components/SearchBar'
import FilterPanel from './components/FilterPanel'
import BusResults from './components/BusResults'
import LandingHero from './components/LandingHero'
import LandingFeatures from './components/LandingFeatures'
import LandingRoutes from './components/LandingRoutes'
import MyTickets from './components/MyTickets'
import SeatModal from './components/SeatModal'
import TrackingModal from './components/TrackingModal'
import LoginModal from './components/LoginModal'
import Toast from './components/Toast'
import { useApp } from './context/AppContext'

function AppInner() {
  const { view, showResults } = useApp()
  return (
    <>
      <Nav />
      {view === 'home' && (
        <div id="homeSection">
          {!showResults && <LandingHero />}
          <SearchBar />
          {showResults ? (
            <div className="main" id="mainResults">
              <FilterPanel />
              <div className="content">
                <BusResults />
              </div>
            </div>
          ) : (
            <div id="landingBottom">
              <LandingFeatures />
              <LandingRoutes />
              <footer className="footer">
                <p>© 2026 Prayagraj Travels. All rights reserved.</p>
              </footer>
            </div>
          )}
        </div>
      )}
      {view === 'tickets' && <MyTickets />}
      <SeatModal />
      <TrackingModal />
      <LoginModal />
      <Toast />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
