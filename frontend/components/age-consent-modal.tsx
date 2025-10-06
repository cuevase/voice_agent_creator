'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/language-context'

interface AgeConsentModalProps {
  isOpen: boolean
  onConsent: () => void
  onCancel?: () => void
  isPostLogin?: boolean
  onConsentSuccess?: () => void
}

export function AgeConsentModal({ isOpen, onConsent, onCancel, isPostLogin = false, onConsentSuccess }: AgeConsentModalProps) {
  const [hasConsented, setHasConsented] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConsent = async () => {
    if (!hasConsented) {
      setError('You must confirm that you are 16 years or older to continue.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // Get the current user ID from the session
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Call your endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
      console.log('POST age consent - API URL:', apiUrl)
      console.log('POST age consent - Full URL:', `${apiUrl}/age/${user.id}`)
      
      const response = await fetch(`${apiUrl}/age/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      })

      console.log('POST age consent - Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('POST age consent - Error response:', errorText)
        throw new Error(`Failed to save age consent: ${response.status} ${response.statusText}`)
      }
      
      const responseData = await response.json()
      console.log('POST age consent - Success response:', responseData)

      // Trigger a re-check of consent status
      onConsentSuccess?.()
      onConsent()
    } catch (error) {
      console.error('Error saving age consent:', error)
      setError('Failed to save your consent. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setHasConsented(false)
    setError(null)
    onCancel?.()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isPostLogin && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {isPostLogin ? 'Welcome! Age Verification Required' : 'Age Verification Required'}
          </DialogTitle>
          <DialogDescription>
            {isPostLogin 
              ? 'Welcome to our platform! To continue using our services, you must be at least 16 years old.'
              : 'To use our services, you must be at least 16 years old.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Our services are designed for users 16 years and older. By proceeding, 
              you confirm that you meet this age requirement.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="age-consent" 
                checked={hasConsented}
                onCheckedChange={(checked) => setHasConsented(checked as boolean)}
              />
              <Label htmlFor="age-consent" className="text-sm font-medium">
                I confirm that I am 16 years of age or older
              </Label>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleConsent}
              disabled={!hasConsented || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Confirming...' : (isPostLogin ? 'Confirm & Continue' : 'Confirm & Continue')}
            </Button>
            {!isPostLogin && (
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center">
            By confirming, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
} 