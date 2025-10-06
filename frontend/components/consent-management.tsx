"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Shield, Download, Trash2, Mic, FileText, Brain, CreditCard, AlertTriangle, Cookie, BarChart3, ShoppingCart, ExternalLink, Settings } from 'lucide-react'
import { useLanguage } from '../lib/language-context'
import { getUserConsents, updateConsent, exportUserData, deleteUserData } from '../lib/consent-api'
import { useAuth } from '../lib/auth-context'
import cookieService from '../lib/cookie-service'
import Link from 'next/link'

interface ConsentSettings {
  voice_recording: boolean
  file_processing: boolean
  ai_training: boolean
}

interface CookiePreferences {
  essential_cookies: boolean
  analytics_cookies: boolean
  marketing_cookies: boolean
  third_party_cookies: boolean
}

export function ConsentManagement() {
  const { t } = useLanguage()
  const { signOut } = useAuth()
  const [consents, setConsents] = useState<ConsentSettings>({
    voice_recording: false,
    file_processing: false,
    ai_training: false
  })
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    essential_cookies: true,
    analytics_cookies: false,
    marketing_cookies: false,
    third_party_cookies: false
  })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingCookie, setUpdatingCookie] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadConsents()
    loadCookiePreferences()
  }, [])

  const loadConsents = async () => {
    try {
      setLoading(true)
      console.log('Loading user consents...')
      const userConsents = await getUserConsents()
      console.log('Loaded consents:', userConsents)
      setConsents(userConsents)
    } catch (error) {
      console.error('Error loading consents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCookiePreferences = async () => {
    try {
      const preferences = await cookieService.loadUserPreferences()
      setCookiePreferences(preferences)
    } catch (error) {
      console.error('Error loading cookie preferences:', error)
    }
  }

  const handleConsentChange = async (consentType: keyof ConsentSettings, granted: boolean) => {
    try {
      setUpdating(consentType)
      await updateConsent(consentType, granted)
      setConsents(prev => ({ ...prev, [consentType]: granted }))
    } catch (error) {
      console.error(`Error updating ${consentType} consent:`, error)
      // Revert the UI change on error
      setConsents(prev => ({ ...prev, [consentType]: !granted }))
    } finally {
      setUpdating(null)
    }
  }

  const handleCookieChange = async (cookieType: keyof CookiePreferences, enabled: boolean) => {
    try {
      setUpdatingCookie(cookieType)
      const newPreferences = { ...cookiePreferences, [cookieType]: enabled }
      await cookieService.savePreferences(newPreferences)
      setCookiePreferences(newPreferences)
    } catch (error) {
      console.error(`Error updating ${cookieType} cookie preference:`, error)
      // Revert the UI change on error
      setCookiePreferences(prev => ({ ...prev, [cookieType]: !enabled }))
    } finally {
      setUpdatingCookie(null)
    }
  }

  const handleExportData = async () => {
    try {
      setExporting(true)
      await exportUserData()
    } catch (error) {
      console.error('Error exporting data:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteData = async () => {
    try {
      setDeleting(true)
      await deleteUserData()
      // Sign out after data deletion
      await signOut()
    } catch (error) {
      console.error('Error deleting data:', error)
    } finally {
      setDeleting(false)
    }
  }

  const consentItems = [
    {
      key: 'voice_recording' as const,
      title: 'Voice Recording',
      description: 'Allow processing of voice recordings for AI responses',
      icon: Mic,
      color: 'text-blue-600'
    },
    {
      key: 'file_processing' as const,
      title: 'File Processing',
      description: 'Allow processing of uploaded documents for AI training',
      icon: FileText,
      color: 'text-green-600'
    },
    {
      key: 'ai_training' as const,
      title: 'AI Training',
      description: 'Allow use of conversations for AI improvement',
      icon: Brain,
      color: 'text-purple-600'
    },

  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-600" />
            Privacy & Consent Settings
          </CardTitle>
          <CardDescription>
            Manage your data processing preferences and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consentItems.map((item) => {
            const IconComponent = item.icon
            return (
              <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-5 h-5 ${item.color}`} />
                  <div>
                    <Label className="text-sm font-medium">{item.title}</Label>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={consents[item.key]}
                  onCheckedChange={(checked) => handleConsentChange(item.key, checked)}
                  disabled={updating === item.key}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-gray-600" />
            Cookie Settings
          </CardTitle>
          <CardDescription>
            Manage how we use cookies to improve your experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <Label className="text-sm font-medium">Essential Cookies</Label>
                <p className="text-xs text-gray-500">Required for website functionality</p>
              </div>
            </div>
            <Switch
              checked={cookiePreferences.essential_cookies}
              disabled={true}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <div>
                <Label className="text-sm font-medium">Analytics Cookies</Label>
                <p className="text-xs text-gray-500">Help us understand website usage</p>
              </div>
            </div>
            <Switch
              checked={cookiePreferences.analytics_cookies}
              onCheckedChange={(checked) => handleCookieChange('analytics_cookies', checked)}
              disabled={updatingCookie === 'analytics_cookies'}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              <div>
                <Label className="text-sm font-medium">Marketing Cookies</Label>
                <p className="text-xs text-gray-500">Deliver personalized advertisements</p>
              </div>
            </div>
            <Switch
              checked={cookiePreferences.marketing_cookies}
              onCheckedChange={(checked) => handleCookieChange('marketing_cookies', checked)}
              disabled={updatingCookie === 'marketing_cookies'}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <ExternalLink className="w-5 h-5 text-gray-600" />
              <div>
                <Label className="text-sm font-medium">Third-party Cookies</Label>
                <p className="text-xs text-gray-500">External service integrations</p>
              </div>
            </div>
            <Switch
              checked={cookiePreferences.third_party_cookies}
              onCheckedChange={(checked) => handleCookieChange('third_party_cookies', checked)}
              disabled={updatingCookie === 'third_party_cookies'}
            />
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <Link href="/cookie-preferences">
              <Button variant="outline" size="sm" className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Advanced Cookie Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-gray-600" />
            Data Export
          </CardTitle>
          <CardDescription>
            Download all your data in JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportData}
            disabled={exporting}
            variant="outline"
            className="w-full"
          >
            {exporting ? 'Exporting...' : 'Export My Data'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            Delete All Data
          </CardTitle>
          <CardDescription className="text-red-600">
            This action cannot be undone. All your data will be permanently deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                Delete All My Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Companies and their data</li>
                    <li>Conversation history</li>
                    <li>Uploaded files</li>
                    <li>Account information</li>
                  </ul>
                  You will be logged out immediately after deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteData}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
} 