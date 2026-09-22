'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { aggiornaAliquotaDefaultCategoria, reimpostaAliquotaCategoria } from './actions-aliquote'

export type CategoriaAliquota = {
  categoria: string
  aliquotaDefault: number
  numeroStrumenti: number
}

const ETICHETTA_CATEGORIA: Record<string, string> = {
  Liquidita: 'Liquidità',
}

const stileBottoneOutline: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  padding: '6px 12px',
  fontSize: 'var(--fs-table)',
  cursor: 'pointer',
}

export function AliquoteCategoria({ categorie }: { categorie: CategoriaAliquota[] }) {
  const router = useRouter()
  const [valori, setValori] = useState<Record<string, string>>(() =>
    Object.fromEntries(categorie.map((c) => [c.categoria, String(c.aliquotaDefault)]))
  )
  const [pendingCategoria, setPendingCategoria] = useState<string | null>(null)
  const [erroreCategoria, setErroreCategoria] = useState<string | null>(null)
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null)
  const [messaggioSuccesso, setMessaggioSuccesso] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleSalvaDefault(categoria: string) {
    const nuovoValore = Number(valori[categoria])
    setErroreCategoria(null)
    setMessaggioErrore(null)
    setMessaggioSuccesso(null)
    setPendingCategoria(categoria)

    startTransition(async () => {
      const risultato = await aggiornaAliquotaDefaultCategoria(categoria, nuovoValore)
      setPendingCategoria(null)
      if ('errore' in risultato) {
        setErroreCategoria(categoria)
        setMessaggioErrore(risultato.errore)
      } else {
        router.refresh()
      }
    })
  }

  function handleReimposta(categoria: string, aliquotaDefault: number, numeroStrumenti: number) {
    if (
      !window.confirm(
        `Reimpostare l'aliquota di TUTTI i ${numeroStrumenti} strumenti in "${ETICHETTA_CATEGORIA[categoria] ?? categoria}" a ${aliquotaDefault}%?\n\nQuesto sovrascrive qualunque personalizzazione fatta sui singoli strumenti di questa categoria.\n\nL'operazione non è reversibile.`
      )
    )
      return

    setErroreCategoria(null)
    setMessaggioErrore(null)
    setMessaggioSuccesso(null)
    setPendingCategoria(categoria)

    startTransition(async () => {
      const risultato = await reimpostaAliquotaCategoria(categoria)
      setPendingCategoria(null)
      if ('errore' in risultato) {
        setErroreCategoria(categoria)
        setMessaggioErrore(risultato.errore)
      } else {
        setMessaggioSuccesso(
          `${risultato.aggiornati} strumenti aggiornati in "${ETICHETTA_CATEGORIA[categoria] ?? categoria}".`
        )
        router.refresh()
      }
    })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {categorie.map((c) => {
          const inPending = pendingCategoria === c.categoria
          const valoreCorrente = valori[c.categoria] ?? ''
          const invariato = Number(valoreCorrente) === c.aliquotaDefault

          return (
            <div key={c.categoria} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: 12 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginBottom: 8 }}>
                {ETICHETTA_CATEGORIA[c.categoria] ?? c.categoria}
              </div>
              <div style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {c.numeroStrumenti} strument{c.numeroStrumenti === 1 ? 'o' : 'i'}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={valoreCorrente}
                  onChange={(e) => setValori((stato) => ({ ...stato, [c.categoria]: e.target.value }))}
                  disabled={inPending}
                  style={{
                    width: 70,
                    padding: '6px 8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--fs-table)',
                  }}
                />
                <span style={{ fontSize: 'var(--fs-table)', color: 'var(--text-secondary)' }}>%</span>
                <button
                  type="button"
                  onClick={() => handleSalvaDefault(c.categoria)}
                  disabled={inPending || invariato}
                  style={{ ...stileBottoneOutline, opacity: inPending || invariato ? 0.5 : 1 }}
                >
                  Salva
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleReimposta(c.categoria, c.aliquotaDefault, c.numeroStrumenti)}
                disabled={inPending || c.numeroStrumenti === 0}
                style={{ ...stileBottoneOutline, width: '100%', opacity: inPending || c.numeroStrumenti === 0 ? 0.5 : 1 }}
              >
                Reimposta tutti gli strumenti
              </button>

              {erroreCategoria === c.categoria && messaggioErrore && (
                <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-card-link)', marginTop: 8 }}>{messaggioErrore}</p>
              )}
            </div>
          )
        })}
      </div>

      {messaggioSuccesso && <p style={{ color: 'var(--success)', fontSize: 'var(--fs-body)', marginTop: 12 }}>{messaggioSuccesso}</p>}
    </div>
  )
}