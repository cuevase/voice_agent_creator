import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get cookie consent for the user
    const { data: consent, error } = await supabase
      .from('cookie_consent')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 })
    }

    if (!consent) {
      // Return default preferences if no consent record exists
      return NextResponse.json({
        user_id: user.id,
        essential_cookies: true,
        analytics_cookies: false,
        marketing_cookies: false,
        third_party_cookies: false,
        consent_date: null
      })
    }

    return NextResponse.json(consent)
  } catch (error) {
    console.error('Error fetching cookie consent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { essential_cookies, analytics_cookies, marketing_cookies, third_party_cookies } = body

    // Validate required fields
    if (typeof essential_cookies !== 'boolean') {
      return NextResponse.json({ error: 'essential_cookies is required' }, { status: 400 })
    }

    const consentData = {
      user_id: user.id,
      essential_cookies,
      analytics_cookies: analytics_cookies || false,
      marketing_cookies: marketing_cookies || false,
      third_party_cookies: third_party_cookies || false,
      consent_date: new Date().toISOString()
    }

    // Upsert consent data
    const { data, error } = await supabase
      .from('cookie_consent')
      .upsert(consentData, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Error saving cookie consent:', error)
      return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error saving cookie consent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get user from session
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete consent record
    const { error } = await supabase
      .from('cookie_consent')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error revoking cookie consent:', error)
      return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Cookie consent revoked successfully' })
  } catch (error) {
    console.error('Error revoking cookie consent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 