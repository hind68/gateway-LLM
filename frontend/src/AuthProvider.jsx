import { createContext, useEffect, useState, useRef } from 'react'
import keycloak from './keycloak'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const isRun = useRef(false)

  useEffect(() => {
    if (isRun.current) return
    isRun.current = true

    keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false
    }).then((authenticated) => {
      setIsAuthenticated(authenticated)
    }).catch(() => {
      setIsAuthenticated(false)
    })
  }, [])

  if (!isAuthenticated) {
    return null
  }

  return (
    <AuthContext.Provider value={keycloak}>
      {children}
    </AuthContext.Provider>
  )
}