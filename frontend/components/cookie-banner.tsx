'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

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

const CookieBanner = () => {
  const { user } = useAuth()
  const [showBanner, setShowBanner] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential_cookies: true,
    analytics_cookies: false,
    marketing_cookies: false,
    third_party_cookies: false
  })

  useEffect(() => {
    // Only show banner for authenticated users who haven't made a choice
    const cookieChoice = localStorage.getItem('cookieConsent')
    const isLandingPage = window.location.pathname === '/'
    
    if (user && !cookieChoice && !isLandingPage) {
      setShowBanner(true)
    }
  }, [user])

  const acceptAll = async () => {
    const allPreferences: CookiePreferences = {
      essential_cookies: true,
      analytics_cookies: true,
      marketing_cookies: true,
      third_party_cookies: true
    }
    await saveCookiePreferences(allPreferences)
    setShowBanner(false)
  }

  const acceptEssential = async () => {
    const essentialOnly: CookiePreferences = {
      essential_cookies: true,
      analytics_cookies: false,
      marketing_cookies: false,
      third_party_cookies: false
    }
    await saveCookiePreferences(essentialOnly)
    setShowBanner(false)
  }

  const saveCookiePreferences = async (prefs: CookiePreferences) => {
    try {
      localStorage.setItem('cookieConsent', JSON.stringify(prefs))
      localStorage.setItem('cookieConsentDate', new Date().toISOString())
      
      // Send to backend
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      })
      
      // Initialize services based on consent
      initializeServices(prefs)
    } catch (error) {
      console.error('Failed to save cookie preferences:', error)
    }
  }

  const initializeServices = (prefs: CookiePreferences) => {
    if (prefs.analytics_cookies) {
      // Initialize Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': 'granted'
        })
      }
    }
    
    if (prefs.marketing_cookies) {
      // Initialize marketing pixels
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('consent', 'update', {
          'ad_storage': 'granted'
        })
      }
    }
    
    if (prefs.third_party_cookies) {
      // Initialize third-party services
      // ElevenLabs, OpenAI, etc.
    }
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🍪</span>
                <CardTitle>We Use Cookies</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBanner(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              We use cookies to improve your experience, analyze site traffic, 
              and personalize content. By clicking "Accept All", you consent to 
              all cookies. You can customize your preferences below.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="essential" 
                  checked={preferences.essential_cookies} 
                  disabled 
                />
                <label htmlFor="essential" className="text-sm font-medium">
                  Essential Cookies (Required)
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="analytics" 
                  checked={preferences.analytics_cookies}
                  onCheckedChange={(checked) => setPreferences({
                    ...preferences,
                    analytics_cookies: checked as boolean
                  })}
                />
                <label htmlFor="analytics" className="text-sm font-medium">
                  Analytics Cookies
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="marketing" 
                  checked={preferences.marketing_cookies}
                  onCheckedChange={(checked) => setPreferences({
                    ...preferences,
                    marketing_cookies: checked as boolean
                  })}
                />
                <label htmlFor="marketing" className="text-sm font-medium">
                  Marketing Cookies
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="third-party" 
                  checked={preferences.third_party_cookies}
                  onCheckedChange={(checked) => setPreferences({
                    ...preferences,
                    third_party_cookies: checked as boolean
                  })}
                />
                <label htmlFor="third-party" className="text-sm font-medium">
                  Third-party Cookies
                </label>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={acceptEssential}
                className="flex-1"
              >
                Essential Only
              </Button>
              <Button 
                variant="outline" 
                onClick={() => saveCookiePreferences(preferences)}
                className="flex-1"
              >
                Save Preferences
              </Button>
              <Button 
                onClick={acceptAll}
                className="flex-1"
              >
                Accept All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CookieBanner 