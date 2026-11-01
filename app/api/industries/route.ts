import { NextResponse } from 'next/server'
import { createClientServer } from '@/lib/supabase/server'

/**
 * GET /api/industries — public reference data.
 *
 * Industries are shared, read-only reference rows seeded by the active
 * non-order dependency migration. No merchant or anonymous caller writes here.
 */
export async function GET() {
  try {
    const supabase = await createClientServer()
    const { data: industries, error } = await supabase
      .from('industries')
      .select('id, name, slug, description, created_at')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ industries: industries ?? [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/industries — denied.
 *
 * Reference data is managed by migrations. An admin write API would need
 * its own authorization before being enabled.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Industry creation is not supported in this Demo' },
    { status: 403 }
  )
}
