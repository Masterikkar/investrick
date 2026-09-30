'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useNotifica } from '@/components/notifica'

// Mostra una notifica a popup quando la pagina arriva da un redirect con un
// parametro di esito (es. ?successo_contenitore=1), poi toglie i parametri di
// esito dall'indirizzo: ricaricando la pagina la notifica non ricompare. Gli
// altri parametri (es. ?tipo=liquidita) restano.
export function NotificaDaParametro({ messaggio }: { messaggio: string }) {
  const notifica = useNotifica()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mostrata = useRef(false)

  useEffect(() => {
    if (mostrata.current) return
    mostrata.current = true
    notifica({ messaggio })

    const rimanenti = new URLSearchParams(searchParams.toString())
    for (const chiave of Array.from(rimanenti.keys())) {
      if (chiave.startsWith('successo_') || chiave.startsWith('errore_')) rimanenti.delete(chiave)
    }
    const query = rimanenti.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [notifica, messaggio, router, pathname, searchParams])

  return null
}
