"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (provider: 'google') => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting initial session:', error)
        } else {
          console.log('Initial session:', session?.user?.email || 'no session')
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (provider: 'google') => {
    console.log('Signing in with:', provider)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Remove PKCE-specific parameters for now
          // queryParams: { 
          //   prompt: 'consent', 
          //   access_type: 'offline' 
          // }
        },
      })
      
      console.log('OAuth sign in result:', { data, error })
      
      if (error) {
        console.error('Error signing in:', error.message)
        console.error('Error details:', error)
      } else {
        console.log('OAuth URL generated:', data?.url)
      }
    } catch (error) {
      console.error('Unexpected error during sign in:', error)
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    console.log('Signing in with email:', email)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        console.error('Error signing in with email:', error.message)
        console.error('Error details:', error)
      } else {
        console.log('Email sign in result:', { data, error })
      }
    } catch (error) {
      console.error('Unexpected error during email sign in:', error)
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    console.log('Signing up with email:', email)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        console.error('Error signing up with email:', error.message)
        console.error('Error details:', error)
      } else {
        console.log('Email sign up result:', { data, error })
      }
    } catch (error) {
      console.error('Unexpected error during email sign up:', error)
    }
  }

  const resetPassword = async (email: string) => {
    console.log('Resetting password for:', email)
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        console.error('Error resetting password:', error.message)
        console.error('Error details:', error)
      } else {
        console.log('Password reset initiated:', { data, error })
      }
    } catch (error) {
      console.error('Unexpected error during password reset:', error)
    }
  }

  const signOut = async () => {
    console.log('Signing out...')
    try {
      // Clear local state immediately
      setUser(null)
      setSession(null)
      
      // Check if there's an active session first
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('No active session found, redirecting to landing page')
        // Redirect to landing page
        window.location.href = '/'
        return
      }

      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error.message)
        // Even if there's an error, redirect to landing page
        window.location.href = '/'
      } else {
        console.log('Successfully signed out')
        // Redirect to landing page
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Unexpected error during sign out:', error)
      // Redirect to landing page even on unexpected errors
      window.location.href = '/'
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 