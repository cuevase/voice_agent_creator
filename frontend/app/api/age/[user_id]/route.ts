import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { user_id: string } }
) {
  try {
    const { user_id } = params

    // Insert age consent record using your exact logic
    const { data, error } = await supabase
      .from('age_consent')
      .insert({
        user_id: user_id,
        consent: true
      })

    if (error) {
      console.error('Error saving age consent:', error)
      return NextResponse.json({ error: 'Failed to save age consent' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Age posted successfully' })
  } catch (error) {
    console.error('Error posting age consent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 