'use client'

import { useEffect } from 'react'

/**
 * Chiude qualsiasi <details> aperto nella pagina quando si clicca fuori da esso.
 * Componente "invisibile": nessun markup proprio, solo un listener globale.
 */
export function ChiudiTendineAutomaticamente() {
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