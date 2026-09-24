import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function ImpostazioniPage() {
  const locale = await getLocale()
  redirect({ href: '/account/impostazioni-v2/app', locale })
}
