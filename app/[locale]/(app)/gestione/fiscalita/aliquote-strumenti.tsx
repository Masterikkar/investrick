'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { aggiornaAliquotaStrumento } from './actions-aliquote'

export type RigaAliquotaStrumento = {
  id: string
  nome: string
  categoria: string
  aliquotaTassazione: number
}

const ETICHETTA_CATEGORIA: Record<string, string> = {
  Liquidita: 'Liquidità',
}

const stileBottoneOutline: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  padding: '4px 10px',
  fontSize: 'var(--fs-card-link)',
  cursor: 'pointer',
}

export function AliquoteStrumenti({ righe }: { righe: RigaAliquotaStrumento[] }) {
  const router = useRouter()
  const [valori, setValori] = useState<Record<string, string>>(() =>
    Object.fromEntries(righe.map((r) => [r.id, String(r.aliquotaTassazione)]))
  )
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [erroreId, setErroreId] = useState<string | null>(null)
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const testo = query.trim().toLowerCase()
  const righeFiltrate = useMemo(() => {
    if (!testo) return righe
    return righe.filter((r) => r.nome.toLowerCase().includes(testo))
  }, [righe, testo])

  function handleSalva(id: string) {
    const nuovoValore = Number(valori[id])
    setErroreId(null)
    setMessaggioErrore(null)
    setPendingId(id)

    startTransition(async () => {
      const risultato = await aggiornaAliquotaStrumento(id, nuovoValore)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(id)
        setMessaggioErrore(risultato.errore)
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
          border: '1px solid var(--border-default)',
          width: 260,
          fontSize: 'var(--fs-table)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          marginBottom: 12,
        }}
      />

      {righeFiltrate.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Nessuno strumento trovato.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Categoria</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Aliquota</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}></th>
            </tr>
          </thead>
          <tbody>
            {righeFiltrate.map((r) => {
              const inPending = pendingId === r.id
              const valoreCorrente = valori[r.id] ?? ''
              const invariato = Number(valoreCorrente) === r.aliquotaTassazione

              return (
                <tr key={r.id} className="tabella-riga">
                  <td style={{ padding: 8 }}>{r.nome}</td>
                  <td style={{ padding: 8 }}>{ETICHETTA_CATEGORIA[r.categoria] ?? r.categoria}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={valoreCorrente}
                        onChange={(e) => setValori((stato) => ({ ...stato, [r.id]: e.target.value }))}
                        disabled={inPending}
                        style={{
                          width: 70,
                          padding: '4px 8px',
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--fs-table)',
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>%</span>
                    </div>
                    {erroreId === r.id && messaggioErrore && (
                      <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-card-link)', margin: '4px 0 0' }}>{messaggioErrore}</p>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleSalva(r.id)}
                      disabled={inPending || invariato}
                      style={{ ...stileBottoneOutline, opacity: inPending || invariato ? 0.5 : 1 }}
                    >
                      Salva
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}