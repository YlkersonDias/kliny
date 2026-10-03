import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
