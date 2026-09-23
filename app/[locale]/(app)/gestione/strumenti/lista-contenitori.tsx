'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { rinominaContenitore, eliminaContenitore } from './actions-contenitore'

type Contenitore = { id: string; nome: string; tipo: string }

const stileBottoneOutline: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  padding: '6px 12px',
  fontSize: 'var(--fs-table)',
  cursor: 'pointer',
}

export function ListaContenitori({ contenitori }: { contenitori: Contenitore[] }) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tPaginaContenitore = useTranslations('PaginaContenitore')
  const tContenitori = useTranslations('Contenitori')
  const tPaginaCategoria = useTranslations('PaginaCategoria')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const router = useRouter()

  function etichettaTipo(tipo: string): string {
    if (tipo === 'Polizza') return tPaginaContenitore('etichettaPolizza')
    if (tipo === 'Liquidita') return tContenitori('liquidita')
    return tipo
  }
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
        t('confermaEliminaContenitore', { nome, diretto: tPaginaCategoria('provenienzaDiretto') })
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
    return <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunContenitoreCreato')}</p>
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
              style={{
                padding: '6px 8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 'var(--fs-table)',
                flex: 1,
              }}
            />
            <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', minWidth: 80 }}>
              {etichettaTipo(c.tipo)}
            </span>
            <button
              type="button"
              onClick={() => handleRinomina(c.id)}
              disabled={pendingId === c.id || (nomi[c.id] ?? '').trim() === c.nome}
              style={{ ...stileBottoneOutline, opacity: pendingId === c.id || (nomi[c.id] ?? '').trim() === c.nome ? 0.5 : 1 }}
            >
              {tPaginaRibilanciamento('bottoneSalva')}
            </button>
            <button
              type="button"
              onClick={() => handleElimina(c.id, c.nome)}
              disabled={pendingId === c.id}
              style={{ ...stileBottoneOutline, color: 'var(--danger)', opacity: pendingId === c.id ? 0.5 : 1 }}
            >
              {t('bottoneElimina')}
            </button>
          </div>
        ))}
      </div>

      {erroreId && messaggioErrore && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginTop: 12 }}>{messaggioErrore}</p>
      )}
    </div>
  )
}