'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { MenuSelect, type OpzioneMenuSelect } from '@/components/menu-select'

export function SelettoreLingua() {
  const t = useTranslations('PaginaImpostazioni')
  const localeAttivo = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const opzioni: OpzioneMenuSelect[] = [
    { value: 'it', label: t('lingueDisponibili.it') },
    { value: 'en', label: t('lingueDisponibili.en') },
  ]

  function handleChange(nuovoLocale: string) {
    router.replace(pathname, { locale: nuovoLocale })
  }

  return (
    <div style={{ width: 260 }}>
      <label style={{ fontSize: 'var(--fs-form-label)' }}>
        {t('etichettaLingua')}
        <div style={{ marginTop: 4 }}>
          <MenuSelect value={localeAttivo} onChange={handleChange} options={opzioni} />
        </div>
      </label>
    </div>
  )
}
