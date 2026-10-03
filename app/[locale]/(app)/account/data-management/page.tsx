import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function DataManagementPage() {
  const locale = await getLocale()
  redirect({ href: '/account/data-management/asset', locale })
}
