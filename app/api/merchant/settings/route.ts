import { NextRequest, NextResponse } from 'next/server'
import { createClientServer } from '@/lib/supabase/server'
import { updateStoreBaseCurrency } from '@/lib/stores/service'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClientServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { base_currency } = body

    if (!base_currency || (base_currency !== 'CNY' && base_currency !== 'USD')) {
      return NextResponse.json(
        { error: 'Invalid currency. Supported values: CNY, USD' },
        { status: 400 }
      )
    }

    const updatedStore = await updateStoreBaseCurrency(user.id, base_currency)
    return NextResponse.json({ success: true, store: updatedStore })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update store settings'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
