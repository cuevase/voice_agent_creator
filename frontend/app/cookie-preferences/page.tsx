'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

interface CookiePreferences {
  essential_cookies: boolean
  analytics_cookies: boolean
  marketing_cookies: boolean
  third_party_cookies: boolean
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

const CookiePreferencesPage = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential_cookies: true,
    analytics_cookies: false,
    marketing_cookies: false,
    third_party_cookies: false
  })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }
    loadPreferences()
  }, [user, router])

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/cookie-consent')
      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
      } else {
        // Fallback to localStorage if API fails
        const saved = localStorage.getItem('cookieConsent')
        if (saved) {
          setPreferences(JSON.parse(saved))
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      // Fallback to localStorage
      const saved = localStorage.getItem('cookieConsent')
      if (saved) {
        setPreferences(JSON.parse(saved))
      }
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async (newPrefs: CookiePreferences) => {
    try {
      setPreferences(newPrefs)
      localStorage.setItem('cookieConsent', JSON.stringify(newPrefs))
      
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs)
      })
      
      // Reinitialize services
      initializeServices(newPrefs)
      setMessage({ type: 'success', text: 'Cookie preferences updated successfully!' })
    } catch (error) {
      console.error('Failed to update preferences:', error)
      setMessage({ type: 'error', text: 'Failed to update preferences. Please try again.' })
    }
  }

  const revokeConsent = async () => {
    try {
      await fetch('/api/cookie-consent', {
        method: 'DELETE'
      })
      
      const revokedPrefs: CookiePreferences = {
        essential_cookies: true,
        analytics_cookies: false,
        marketing_cookies: false,
        third_party_cookies: false
      }
      
      setPreferences(revokedPrefs)
      localStorage.setItem('cookieConsent', JSON.stringify(revokedPrefs))
      
      // Disable all services except essential
      initializeServices(revokedPrefs)
      setMessage({ type: 'success', text: 'Cookie consent revoked successfully!' })
    } catch (error) {
      console.error('Failed to revoke consent:', error)
      setMessage({ type: 'error', text: 'Failed to revoke consent. Please try again.' })
    }
  }

  const initializeServices = (prefs: CookiePreferences) => {
    if (prefs.analytics_cookies) {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': 'granted'
        })
      }
    } else {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': 'denied'
        })
      }
    }
    
    if (prefs.marketing_cookies) {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'ad_storage': 'granted'
        })
      }
    } else {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'ad_storage': 'denied'
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading preferences...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Cookie Preferences</h1>
          <p className="text-muted-foreground mt-2">
            Manage your cookie preferences and control how we use your data
          </p>
        </div>

        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <Info className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🍪</span>
              <span>Essential Cookies</span>
            </CardTitle>
            <CardDescription>
              Required for the website to function properly. These cookies cannot be disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="essential" 
                checked={preferences.essential_cookies} 
                disabled 
              />
              <label htmlFor="essential" className="text-sm font-medium">
                Always Active
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics Cookies</CardTitle>
            <CardDescription>
              Help us understand how visitors use our website to improve your experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="analytics" 
                checked={preferences.analytics_cookies}
                onCheckedChange={(checked) => updatePreferences({
                  ...preferences,
                  analytics_cookies: checked as boolean
                })}
              />
              <label htmlFor="analytics" className="text-sm font-medium">
                Allow Analytics Cookies
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marketing Cookies</CardTitle>
            <CardDescription>
              Used to deliver personalized advertisements and track marketing campaign performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="marketing" 
                checked={preferences.marketing_cookies}
                onCheckedChange={(checked) => updatePreferences({
                  ...preferences,
                  marketing_cookies: checked as boolean
                })}
              />
              <label htmlFor="marketing" className="text-sm font-medium">
                Allow Marketing Cookies
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Third-party Cookies</CardTitle>
            <CardDescription>
              Used by external services like payment processors, AI providers, and other integrations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="third-party" 
                checked={preferences.third_party_cookies}
                onCheckedChange={(checked) => updatePreferences({
                  ...preferences,
                  third_party_cookies: checked as boolean
                })}
              />
              <label htmlFor="third-party" className="text-sm font-medium">
                Allow Third-party Cookies
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Revoke All Consent</span>
            </CardTitle>
            <CardDescription>
              This will disable all optional cookies and reset your preferences to essential only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={revokeConsent}
              className="w-full"
            >
              Revoke All Consent
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CookiePreferencesPage 