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

class CookieService {
  private preferences: CookiePreferences

  constructor() {
    this.preferences = this.loadPreferences()
  }

  loadPreferences(): CookiePreferences {
    if (typeof window === 'undefined') {
      return {
        essential_cookies: true,
        analytics_cookies: false,
        marketing_cookies: false,
        third_party_cookies: false
      }
    }

    const saved = localStorage.getItem('cookieConsent')
    return saved ? JSON.parse(saved) : {
      essential_cookies: true,
      analytics_cookies: false,
      marketing_cookies: false,
      third_party_cookies: false
    }
  }

  async loadUserPreferences(): Promise<CookiePreferences> {
    try {
      const response = await fetch('/api/cookie-consent')
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.error('Failed to load user cookie preferences:', error)
    }
    
    // Fallback to localStorage
    return this.loadPreferences()
  }

  async savePreferences(preferences: CookiePreferences): Promise<void> {
    this.preferences = preferences
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('cookieConsent', JSON.stringify(preferences))
      localStorage.setItem('cookieConsentDate', new Date().toISOString())
    }
    
    try {
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })
    } catch (error) {
      console.error('Failed to save cookie preferences:', error)
    }
  }

  canUseAnalytics(): boolean {
    return this.preferences.analytics_cookies
  }

  canUseMarketing(): boolean {
    return this.preferences.marketing_cookies
  }

  canUseThirdParty(): boolean {
    return this.preferences.third_party_cookies
  }

  initializeAnalytics(): void {
    if (typeof window === 'undefined') return

    if (this.canUseAnalytics()) {
      if (window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': 'granted'
        })
      }
    } else {
      if (window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': 'denied'
        })
      }
    }
  }

  initializeMarketing(): void {
    if (typeof window === 'undefined') return

    if (this.canUseMarketing()) {
      if (window.gtag) {
        window.gtag('consent', 'update', {
          'ad_storage': 'granted'
        })
      }
    } else {
      if (window.gtag) {
        window.gtag('consent', 'update', {
          'ad_storage': 'denied'
        })
      }
    }
  }

  initializeThirdPartyServices(): void {
    if (typeof window === 'undefined') return

    if (this.canUseThirdParty()) {
      // Initialize third-party services like ElevenLabs, OpenAI, etc.
      // This can be extended based on your specific third-party integrations
    }
  }

  async revokeConsent(): Promise<void> {
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
      
      this.preferences = revokedPrefs
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('cookieConsent', JSON.stringify(revokedPrefs))
      }
      
      // Disable all services
      this.initializeAnalytics()
      this.initializeMarketing()
      this.initializeThirdPartyServices()
    } catch (error) {
      console.error('Failed to revoke consent:', error)
    }
  }

  getPreferences(): CookiePreferences {
    return { ...this.preferences }
  }

  updatePreferences(preferences: CookiePreferences): void {
    this.preferences = preferences
  }

  hasUserConsented(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('cookieConsent') !== null
  }

  getConsentDate(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('cookieConsentDate')
  }

  // Initialize all services based on current preferences
  initializeAllServices(): void {
    this.initializeAnalytics()
    this.initializeMarketing()
    this.initializeThirdPartyServices()
  }
}

// Export a singleton instance
const cookieService = new CookieService()
export default cookieService 