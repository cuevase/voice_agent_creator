"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Shield, Mic, FileText, Brain, CreditCard } from 'lucide-react'
import { useLanguage } from '../lib/language-context'

interface ConsentModalProps {
  isOpen: boolean
  onClose: () => void
  consentType: 'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing'
  onConsent: (consentType: string, granted: boolean) => void
}

const consentMessages = {
  voice_recording: {
    title: "Voice Recording Consent",
    message: "We need your consent to process voice recordings for transcription and AI responses. Your voice data will be used only for providing AI assistance and will be processed securely.",
    icon: Mic,
    color: "text-blue-600"
  },
  file_processing: {
    title: "File Processing Consent", 
    message: "We need your consent to process uploaded documents for AI training and analysis. Your files will be used to improve AI responses and will be handled securely.",
    icon: FileText,
    color: "text-green-600"
  },
  ai_training: {
    title: "AI Training Consent",
    message: "We need your consent to use your conversations for AI improvement. This helps us provide better responses while maintaining your privacy.",
    icon: Brain,
    color: "text-purple-600"
  },
  payment_processing: {
    title: "Payment Processing Consent",
    message: "We need your consent to process payment information for credit purchases and service billing. Your payment data will be handled securely and only used for transactions you authorize.",
    icon: CreditCard,
    color: "text-orange-600"
  },
}

export function ConsentModal({ isOpen, onClose, consentType, onConsent }: ConsentModalProps) {
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  
  const consentInfo = consentMessages[consentType]
  const IconComponent = consentInfo.icon

  const handleConsent = async (granted: boolean) => {
    setIsLoading(true)
    try {
      await onConsent(consentType, granted)
      onClose()
    } catch (error) {
      console.error('Error updating consent:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-600" />
            {consentInfo.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <IconComponent className={`w-6 h-6 mt-1 ${consentInfo.color}`} />
            <p className="text-sm text-gray-600 leading-relaxed">
              {consentInfo.message}
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>Privacy Note:</strong> You can change these settings anytime in your privacy settings. 
              We never share your personal data with third parties without your explicit consent.
            </p>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleConsent(true)}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Updating...' : 'I Consent'}
            </Button>
            <Button
              onClick={() => handleConsent(false)}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? 'Updating...' : 'Decline'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 