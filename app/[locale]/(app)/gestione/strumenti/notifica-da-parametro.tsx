'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useNotifica } from '@/components/notifica'

// Mostra una notifica a popup quando la pagina arriva da un redirect con un
// parametro di esito (es. ?successo_contenitore=1), poi toglie il parametro
// dall'indirizzo: ricaricando la pagina la notifica non ricompare.
export function NotificaDaParametro({ messaggio }: { messaggio: string }) {
  const notifica = useNotifica()
  const router = useRouter()
  const pathname = usePathname()
  const mostrata = useRef(false)

  useEffect(() => {
    if (mostrata.current) return
    mostrata.current = true
    notifica({ messaggio })
    router.replace(pathname, { scroll: false })
  }, [notifica, messaggio, router, pathname])

  return null
}
