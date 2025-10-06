'use client'

import { useEffect } from 'react'
import cookieService from '@/lib/cookie-service'
import { useAuth } from '@/lib/auth-context'

const CookieInitializer = () => {
  const { user } = useAuth()

  useEffect(() => {
    const initializeServices = async () => {
      if (user) {
        // Load user-specific preferences from API
        const userPreferences = await cookieService.loadUserPreferences()
        cookieService.updatePreferences(userPreferences)
      }
      
      // Initialize cookie services based on preferences
      cookieService.initializeAllServices()
    }

    initializeServices()
  }, [user])

  return null
}

export default CookieInitializer 