'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatEuro } from '@/lib/format'
import { aggiornaContenitoreTransazione } from './actions'

export type RigaStoricoTransazione = {
  id: string
  data: string
  operazione: string
  contenitore_id: string | null
  quantita: number
  prezzo_unitario: number
  commissione: number
  tassa_trattenuta: number
  strumento_id: string | null
  strumento_nome: string
  strumento_ticker: string | null
}

type Contenitore = { id: string; nome: string }

const ETICHETTE_OPERAZIONE: Record<string, string> = {
  Acquisto: 'Acquisto',
  Vendita: 'Vendita',
  Dividendo: 'Dividendo',
  Ricompensa: 'Ricompensa',
  Costo_quote: 'Costo (in quote)',
  Costo_contanti: 'Costo (in contanti)',
  Scambio_cessione: 'Scambio (cessione)',
  Scambio_acquisizione: 'Scambio (acquisizione)',
}

export function StoricoTransazioni({
  transazioni,
  contenitori,
}: {
  transazioni: RigaStoricoTransazione[]
  contenitori: Contenitore[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [erroreId, setErroreId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function nomeContenitore(id: string | null) {
    if (id === null) return 'Diretto'
    return contenitori.find((c) => c.id === id)?.nome ?? '—'
  }

  const testo = query.trim().toLowerCase()

  const righeFiltrate = useMemo(() => {
    if (!testo) return transazioni
    return transazioni.filter(
      (t) =>
        t.strumento_nome.toLowerCase().includes(testo) ||
        (t.strumento_ticker ?? '').toLowerCase().includes(testo)
    )
  }, [transazioni, testo])

  function handleSposta(transazioneId: string, valoreSelezionato: string) {
    if (!valoreSelezionato) return
    setErroreId(null)
    setPendingId(transazioneId)

    const nuovoContenitoreId = valoreSelezionato === 'diretto' ? null : valoreSelezionato

    startTransition(async () => {
      const risultato = await aggiornaContenitoreTransazione(transazioneId, nuovoContenitoreId)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(transazioneId)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Filtra per strumento..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: '6px 10px',
          border: '1px solid #ddd',
          borderRadius: 6,
          width: 260,
          fontSize: 14,
        }}
      />

      {erroreId && (
        <p style={{ color: 'red', marginTop: 8 }}>
          Non è stato possibile spostare quella transazione. Riprova.
        </p>
      )}

      {righeFiltrate.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nessuna transazione trovata.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: 8 }}>Data</th>
              <th style={{ padding: 8 }}>Strumento</th>
              <th style={{ padding: 8 }}>Operazione</th>
              <th style={{ padding: 8 }}>Contenitore</th>
              <th style={{ padding: 8 }}>Quantità</th>
              <th style={{ padding: 8 }}>Prezzo unitario</th>
              <th style={{ padding: 8 }}>Commissione</th>
              <th style={{ padding: 8 }}>Tassa trattenuta</th>
              <th style={{ padding: 8 }}>Sposta in</th>
            </tr>
          </thead>
          <tbody>
            {righeFiltrate.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{new Date(t.data).toLocaleDateString('it-IT')}</td>
                <td style={{ padding: 8 }}>
                  {t.strumento_id ? (
                    <Link href={`/asset/${t.strumento_id}`} style={{ color: 'inherit' }}>
                      {t.strumento_nome}
                    </Link>
                  ) : (
                    t.strumento_nome
                  )}
                </td>
                <td style={{ padding: 8 }}>{ETICHETTE_OPERAZIONE[t.operazione] ?? t.operazione}</td>
                <td style={{ padding: 8 }}>{nomeContenitore(t.contenitore_id)}</td>
                <td style={{ padding: 8 }}>{t.quantita.toFixed(6)}</td>
                <td style={{ padding: 8 }}>{formatEuro(t.prezzo_unitario)}</td>
                <td style={{ padding: 8 }}>{formatEuro(t.commissione)}</td>
                <td style={{ padding: 8 }}>{formatEuro(t.tassa_trattenuta)}</td>
                <td style={{ padding: 8 }}>
                  <select
                    value=""
                    disabled={pendingId === t.id}
                    onChange={(e) => handleSposta(t.id, e.target.value)}
                    style={{ padding: '4px 6px' }}
                  >
                    <option value="">{pendingId === t.id ? 'Spostamento...' : 'Sposta in...'}</option>
                    {t.contenitore_id !== null && <option value="diretto">Diretto</option>}
                    {contenitori
                      .filter((c) => c.id !== t.contenitore_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}