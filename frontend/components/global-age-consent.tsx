'use client'

import { useAgeConsent } from '@/hooks/use-age-consent'
import { AgeConsentModal } from './age-consent-modal'

export function GlobalAgeConsent() {
  const { showModal, setShowModal, setHasConsented, triggerCheck } = useAgeConsent()

  const handleConsent = () => {
    setShowModal(false)
    setHasConsented(true)
    // The modal will handle the POST request and trigger a re-check
    // We close the modal immediately for better UX
  }

  const handleCancel = () => {
    setShowModal(false)
    // Sign out the user if they don't provide consent
    // This ensures they can't use the app without age consent
    window.location.href = '/'
  }

  return (
    <AgeConsentModal
      isOpen={showModal}
      onConsent={handleConsent}
      onCancel={handleCancel}
      isPostLogin={true}
      onConsentSuccess={triggerCheck}
    />
  )
} 