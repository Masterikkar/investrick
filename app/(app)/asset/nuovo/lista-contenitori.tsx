'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rinominaContenitore, eliminaContenitore } from './actions-contenitore'

type Contenitore = { id: string; nome: string; tipo: string }

const ETICHETTA_TIPO: Record<string, string> = {
  PAC: 'PAC',
  Polizza: 'Polizza vita',
  Liquidita: 'Liquidità',
}

export function ListaContenitori({ contenitori }: { contenitori: Contenitore[] }) {
  const router = useRouter()
  const [nomi, setNomi] = useState<Record<string, string>>(() =>
    Object.fromEntries(contenitori.map((c) => [c.id, c.nome]))
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [erroreId, setErroreId] = useState<string | null>(null)
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleRinomina(id: string) {
    const nuovoNome = (nomi[id] ?? '').trim()
    if (!nuovoNome) return
    setErroreId(null)
    setMessaggioErrore(null)
    setPendingId(id)

    startTransition(async () => {
      const risultato = await rinominaContenitore(id, nuovoNome)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(id)
        setMessaggioErrore(risultato.errore)
      } else {
        setNomi((stato) => ({ ...stato, [id]: nuovoNome }))
        router.refresh()
      }
    })
  }

  function handleElimina(id: string, nome: string) {
    if (
      !window.confirm(
        `Eliminare il contenitore "${nome}"?\n\nLe transazioni e i movimenti collegati verranno spostati nel contenitore 'Diretto'; eventuali target impostati su questo contenitore verranno cancellati.\n\nL'operazione non è reversibile.`
      )
    )
      return
    setErroreId(null)
    setMessaggioErrore(null)
    setPendingId(id)

    startTransition(async () => {
      const risultato = await eliminaContenitore(id)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(id)
        setMessaggioErrore(risultato.errore)
      } else {
        router.refresh()
      }
    })
  }

  if (contenitori.length === 0) {
    return <p style={{ color: '#666' }}>Nessun contenitore creato.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
        {contenitori.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={nomi[c.id] ?? ''}
              onChange={(e) => setNomi((stato) => ({ ...stato, [c.id]: e.target.value }))}
              disabled={pendingId === c.id}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, flex: 1 }}
            />
            <span style={{ fontSize: 12, color: '#666', minWidth: 80 }}>
              {ETICHETTA_TIPO[c.tipo] ?? c.tipo}
            </span>
            <button
              type="button"
              onClick={() => handleRinomina(c.id)}
              disabled={pendingId === c.id || (nomi[c.id] ?? '').trim() === c.nome}
            >
              Salva
            </button>
            <button
              type="button"
              onClick={() => handleElimina(c.id, c.nome)}
              disabled={pendingId === c.id}
              style={{ color: '#c0392b' }}
            >
              Elimina
            </button>
          </div>
        ))}
      </div>

      {erroreId && messaggioErrore && <p style={{ color: 'red', marginTop: 12 }}>{messaggioErrore}</p>}
    </div>
  )
}