import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export function useAgeConsent() {
  const { user } = useAuth()
  const [hasConsented, setHasConsented] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [checkTrigger, setCheckTrigger] = useState(0)

  useEffect(() => {
    const checkAgeConsent = async () => {
      if (!user) {
        setHasConsented(null)
        setLoading(false)
        setShowModal(false)
        return
      }

      try {
        // Check if user has age consent using your endpoint
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          console.log('here')
          console.log('user.id', user.id)
          console.log('process.env.NEXT_PUBLIC_API_BASE_URL', process.env.NEXT_PUBLIC_API_BASE_URL)
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/age/${user.id}`, {
            headers: {
              'ngrok-skip-browser-warning': 'true'
            }
          }) 
          console.log('GET age consent - Response status:', response.status)
          
          if (response.ok) {
            try {
              const data = await response.json()
              console.log('GET age consent - Response data:', data)
              
              if (data.message === 'User is 16 years or older') {
                console.log('GET age consent - User has consent, hiding modal')
                setHasConsented(true)
                setShowModal(false)
              } else {
                console.log('GET age consent - User does not have consent, showing modal')
                setHasConsented(false)
                setShowModal(true)
              }
            } catch (jsonError) {
              console.error('GET age consent - JSON parse error:', jsonError)
              const responseText = await response.text()
              console.error('GET age consent - Raw response:', responseText)
              setHasConsented(false)
              setShowModal(true)
            }
          } else {
            const errorText = await response.text()
            console.error('GET age consent - Error response:', errorText)
            console.log('GET age consent - Response not ok, showing modal')
            setHasConsented(false)
            setShowModal(true)
          }
        } else {
          setHasConsented(false)
          setShowModal(false)
        }
      } catch (error) {
        console.error('Error checking age consent:', error)
        setHasConsented(false)
        setShowModal(true)
      } finally {
        setLoading(false)
      }
    }

    checkAgeConsent()
  }, [user, checkTrigger])

  return {
    hasConsented,
    loading,
    setHasConsented,
    showModal,
    setShowModal,
    triggerCheck: () => setCheckTrigger(prev => prev + 1)
  }
} 