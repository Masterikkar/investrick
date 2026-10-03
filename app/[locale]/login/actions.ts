'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect({ href: '/login?errore=1', locale })
  }

  redirect({ href: '/', locale })
}

export async function logout() {
  const supabase = await createClient()
  const locale = await getLocale()
  await supabase.auth.signOut()
  redirect({ href: '/login', locale })
}