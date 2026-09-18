'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuro, formatNumero } from '@/lib/format'
import { RippleLink } from '@/components/ripple-link'
import { ETICHETTA_OPERAZIONE } from '@/lib/operazioni'
import { aggiornaContenitoreTransazione, eliminaTransazione } from './actions'

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

const RIGHE_PER_PAGINA = 100

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
  const [righeVisibili, setRigheVisibili] = useState(RIGHE_PER_PAGINA)

  const anniDisponibili = useMemo(() => {
    const anni = new Set(transazioni.map((t) => Number(t.data.slice(0, 4))))
    return Array.from(anni).sort((a, b) => b - a)
  }, [transazioni])

  const [anniSelezionati, setAnniSelezionati] = useState<Set<number>>(() => new Set(anniDisponibili))

  function nomeContenitore(id: string | null) {
    if (id === null) return 'Diretto'
    return contenitori.find((c) => c.id === id)?.nome ?? '—'
  }

  const testo = query.trim().toLowerCase()

  const righeFiltrate = useMemo(() => {
    return transazioni.filter((t) => {
      const passaAnno = anniSelezionati.has(Number(t.data.slice(0, 4)))
      if (!passaAnno) return false
      if (!testo) return true
      return (
        t.strumento_nome.toLowerCase().includes(testo) ||
        (t.strumento_ticker ?? '').toLowerCase().includes(testo)
      )
    })
  }, [transazioni, testo, anniSelezionati])

  const righeMostrate = righeFiltrate.slice(0, righeVisibili)
  const ciSonoAltre = righeVisibili < righeFiltrate.length

  function toggleAnno(anno: number) {
    setAnniSelezionati((prev) => {
      const next = new Set(prev)
      if (next.has(anno)) next.delete(anno)
      else next.add(anno)
      return next
    })
  }

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

  function handleElimina(riga: RigaStoricoTransazione) {
    const descrizione = `${ETICHETTA_OPERAZIONE[riga.operazione] ?? riga.operazione} del ${new Date(
      riga.data
    ).toLocaleDateString('it-IT')}${riga.strumento_nome !== '—' ? ` — ${riga.strumento_nome}` : ''}`

    if (!window.confirm(`Eliminare questa transazione?\n\n${descrizione}\n\nL'operazione non è reversibile.`)) {
      return
    }

    setErroreId(null)
    setPendingId(riga.id)

    startTransition(async () => {
      const risultato = await eliminaTransazione(riga.id)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(riga.id)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div>
      <style>{`
        .filtro-anno > summary { list-style: none; cursor: pointer; }
        .filtro-anno > summary::-webkit-details-marker { display: none; }
      `}</style>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <input
          type="text"
          placeholder="Filtra per strumento..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border-default)',
            borderRadius: 0,
            width: 260,
            fontSize: 'var(--fs-table)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
          }}
        />

        <details className="filtro-anno" style={{ position: 'relative' }}>
          <summary
            style={{
              padding: '6px 10px',
              border: '1px solid var(--border-default)',
              borderRadius: 0,
              fontSize: 'var(--fs-table)',
              display: 'inline-block',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            Filtra per anno
            {anniSelezionati.size < anniDisponibili.length ? ` (${anniSelezionati.size})` : ''}
          </summary>
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 0,
              padding: 12,
              zIndex: 10,
              minWidth: 160,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 'var(--fs-table)' }}>
              <button type="button" className="link-interattivo" style={{ border: 'none', background: 'none', padding: 0 }} onClick={() => setAnniSelezionati(new Set(anniDisponibili))}>
                Seleziona tutto
              </button>
              <button type="button" className="link-interattivo" style={{ border: 'none', background: 'none', padding: 0 }} onClick={() => setAnniSelezionati(new Set())}>
                Deseleziona tutto
              </button>
            </div>
            {anniDisponibili.map((anno) => (
              <label key={anno} style={{ display: 'block', fontSize: 'var(--fs-table)', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={anniSelezionati.has(anno)}
                  onChange={() => toggleAnno(anno)}
                  style={{ marginRight: 6, accentColor: 'var(--primary)' }}
                />
                {anno}
              </label>
            ))}
          </div>
        </details>
      </div>

      {erroreId && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginTop: 8 }}>
          Non è stato possibile completare l'operazione su quella transazione. Riprova.
        </p>
      )}

      {righeFiltrate.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', marginTop: 12, color: 'var(--text-secondary)' }}>Nessuna transazione trovata.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Data</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Operazione</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Contenitore</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Quantità</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Prezzo unitario</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Commissione</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa trattenuta</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {righeMostrate.map((t) => {
                const inCorso = pendingId === t.id
                return (
                  <tr key={t.id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{new Date(t.data).toLocaleDateString('it-IT')}</td>
                    <td style={{ padding: 8 }}>
                      {t.strumento_id ? (
                        <RippleLink href={`/asset/${t.strumento_id}`} className="link-interattivo">
                          {t.strumento_nome}
                        </RippleLink>
                      ) : (
                        t.strumento_nome
                      )}
                    </td>
                    <td style={{ padding: 8 }}>{ETICHETTA_OPERAZIONE[t.operazione] ?? t.operazione}</td>
                    <td style={{ padding: 8 }}>{nomeContenitore(t.contenitore_id)}</td>
                    <td style={{ padding: 8 }}>{formatNumero(t.quantita, 6)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(t.prezzo_unitario)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(t.commissione)}</td>
                    <td style={{ padding: 8 }}>{formatEuro(t.tassa_trattenuta)}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <button
                            type="button"
                            disabled={inCorso}
                            title="Sposta in un altro contenitore"
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: inCorso ? 'default' : 'pointer',
                              fontSize: 16,
                              padding: '2px 4px',
                              opacity: inCorso ? 0.4 : 1,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            →
                          </button>
                          <select
                            value=""
                            disabled={inCorso}
                            onChange={(e) => handleSposta(t.id, e.target.value)}
                            aria-label="Sposta in un altro contenitore"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0,
                              cursor: inCorso ? 'default' : 'pointer',
                            }}
                          >
                            <option value="">Sposta in...</option>
                            {t.contenitore_id !== null && <option value="diretto">Diretto</option>}
                            {contenitori
                              .filter((c) => c.id !== t.contenitore_id)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleElimina(t)}
                          disabled={inCorso}
                          title="Elimina transazione"
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: inCorso ? 'default' : 'pointer',
                            fontSize: 16,
                            padding: '2px 4px',
                            color: 'var(--danger)',
                            opacity: inCorso ? 0.4 : 1,
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 'var(--fs-table)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {righeMostrate.length} di {righeFiltrate.length}
            </span>
            {ciSonoAltre && (
              <>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili((v) => v + RIGHE_PER_PAGINA)}
                >
                  Mostra altre {Math.min(RIGHE_PER_PAGINA, righeFiltrate.length - righeVisibili)}
                </button>
                <button
                  type="button"
                  className="link-interattivo"
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setRigheVisibili(righeFiltrate.length)}
                >
                  Mostra tutte
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}