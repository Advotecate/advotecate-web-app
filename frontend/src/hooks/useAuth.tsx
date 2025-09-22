import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User, AuthResponse, LoginRequest, RegisterRequest } from '../types/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')

    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch (error) {
        // Clear invalid data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }

    setIsLoading(false)
  }, [])

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      const mockResponse: AuthResponse = {
        token: 'mock_jwt_token_' + Date.now(),
        user: {
          id: 'user_' + Date.now(),
          email: credentials.email,
          firstName: 'John',
          lastName: 'Doe',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }

      setToken(mockResponse.token)
      setUser(mockResponse.user)

      // Save to localStorage
      localStorage.setItem('auth_token', mockResponse.token)
      localStorage.setItem('auth_user', JSON.stringify(mockResponse.user))
    } catch (error) {
      throw new Error('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: RegisterRequest) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      const mockResponse: AuthResponse = {
        token: 'mock_jwt_token_' + Date.now(),
        user: {
          id: 'user_' + Date.now(),
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          isVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }

      setToken(mockResponse.token)
      setUser(mockResponse.user)

      // Save to localStorage
      localStorage.setItem('auth_token', mockResponse.token)
      localStorage.setItem('auth_user', JSON.stringify(mockResponse.user))
    } catch (error) {
      throw new Error('Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}