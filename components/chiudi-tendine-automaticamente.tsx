'use client'

import { useEffect } from 'react'
import { usePathname } from '@/i18n/navigation'

/**
 * Chiude qualsiasi <details> aperto nella pagina quando si clicca fuori da esso,
 * e tutti quelli del menu principale ([data-menu-principale]) a ogni cambio di
 * pagina: il clic su un link del menu è "dentro" il <details>, e la navigazione
 * client-side non ricarica il layout, quindi senza questo il menu resterebbe
 * aperto. Componente "invisibile": nessun markup proprio.
 */
export function ChiudiTendineAutomaticamente() {
  const pathname = usePathname()

  useEffect(() => {
    document.querySelectorAll('[data-menu-principale] details[open]').forEach((dettaglio) => {
      dettaglio.removeAttribute('open')
    })
  }, [pathname])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      document.querySelectorAll('details[open]').forEach((dettaglio) => {
        if (!dettaglio.contains(event.target as Node)) {
          dettaglio.removeAttribute('open')
        }
      })
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}