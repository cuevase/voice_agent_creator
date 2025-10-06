"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Client-side auth callback handling...')
        console.log('Current URL:', window.location.href)
        
        // For standard OAuth flow, we don't need to manually exchange the code
        // Supabase should handle this automatically with detectSessionInUrl: true
        
        // Just wait a moment for the session to be processed
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check if we have a session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          console.log('Session found:', session.user.email)
          router.push('/')
        } else {
          console.log('No session found, redirecting to error page')
          router.push('/?error=auth_failed')
        }
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        router.push('/?error=auth_failed')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completando autenticación...</p>
      </div>
    </div>
  )
} 