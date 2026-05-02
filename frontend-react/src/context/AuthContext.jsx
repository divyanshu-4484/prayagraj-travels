import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

const STORAGE_KEY = 'pt_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null }
    catch { return null }
  })

  const login = (userData) => {
    const u = { id: userData.id || `user_${Date.now()}`, name: userData.name, email: userData.email, phone: userData.phone || '' }
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const updateProfile = (updates) => {
    const u = { ...user, ...updates }
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
