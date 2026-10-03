'use server'

import { createClient } from '@/lib/supabase/server'
import { LUNGHEZZA_MINIMA_PASSWORD } from '@/lib/profilo'

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RisultatoCambioEmail =
  | { successo: true }
  | { errore: 'emailNonValida' | 'emailUguale' | 'emailGiaUsata' | 'troppeRichieste' | 'generico' }

export type RisultatoCambioPassword =
  | { successo: true }
  | { errore: 'passwordCorta' | 'passwordAttualeErrata' | 'passwordUguale' | 'passwordDebole' | 'generico' }

// Supabase non cambia l'email subito: manda un link di conferma (al nuovo
// indirizzo, e anche al vecchio se "Secure email change" è attivo) e applica il
// cambio solo dopo il clic.
export async function cambiaEmail(nuovaEmail: string): Promise<RisultatoCambioEmail> {
  const email = nuovaEmail.trim().toLowerCase()
  if (!FORMATO_EMAIL.test(email)) return { errore: 'emailNonValida' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { errore: 'generico' }
  if (user.email?.toLowerCase() === email) return { errore: 'emailUguale' }

  const { error } = await supabase.auth.updateUser({ email })
  if (error) {
    if (error.code === 'email_exists') return { errore: 'emailGiaUsata' }
    if (error.code === 'over_email_send_rate_limit') return { errore: 'troppeRichieste' }
    return { errore: 'generico' }
  }
  return { successo: true }
}

// La password attuale si verifica con un nuovo accesso: chi ha una sessione
// aperta su un computer lasciato incustodito non può cambiarla senza saperla.
export async function cambiaPassword(passwordAttuale: string, nuovaPassword: string): Promise<RisultatoCambioPassword> {
  if (nuovaPassword.length < LUNGHEZZA_MINIMA_PASSWORD) return { errore: 'passwordCorta' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { errore: 'generico' }

  const { error: erroreVerifica } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: passwordAttuale,
  })
  if (erroreVerifica) {
    return { errore: erroreVerifica.code === 'invalid_credentials' ? 'passwordAttualeErrata' : 'generico' }
  }

  const { error } = await supabase.auth.updateUser({ password: nuovaPassword })
  if (error) {
    if (error.code === 'same_password') return { errore: 'passwordUguale' }
    if (error.code === 'weak_password') return { errore: 'passwordDebole' }
    return { errore: 'generico' }
  }
  return { successo: true }
}
