'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { rinominaContenitore, eliminaContenitore } from './actions-contenitore'
import { LARGHEZZA_STANDARD, LARGHEZZA_RIGA_QUATTRO_CAMPI, STILE_BOTTONE_ICONA } from './layout-campi'
import { IconaElimina, IconaSalva } from '@/components/icone'
import { useConferma } from '@/components/conferma'
import { useNotifica } from '@/components/notifica'

type Contenitore = { id: string; nome: string; tipo: string }

export function ListaContenitori({ contenitori }: { contenitori: Contenitore[] }) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tPaginaContenitore = useTranslations('PaginaContenitore')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const router = useRouter()
  const conferma = useConferma()
  const notifica = useNotifica()

  function etichettaTipo(tipo: string): string {
    if (tipo === 'Polizza') return tPaginaContenitore('etichettaPolizza')
    if (tipo === 'Personalizzato') return tPaginaContenitore('etichettaPersonalizzato')
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
        notifica({ messaggio: t('successoContenitoreSalvato') })
      }
    })
  }

  async function handleElimina(id: string, nome: string) {
    const confermato = await conferma({
      titolo: t('titoloEliminaContenitore'),
      messaggio: t('confermaEliminaContenitore', { nome }),
      etichettaConferma: t('bottoneElimina'),
      pericoloso: true,
    })
    if (!confermato) return
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
        notifica({ messaggio: t('successoContenitoreEliminato') })
      }
    })
  }

  if (contenitori.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunContenitoreCreato')}</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
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
                minWidth: 120,
              }}
            />
            <span
              style={{
                fontSize: 'var(--fs-card-link)',
                color: 'var(--text-secondary)',
                width: LARGHEZZA_STANDARD,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {etichettaTipo(c.tipo)}
            </span>
            <button
              type="button"
              onClick={() => handleRinomina(c.id)}
              disabled={pendingId === c.id || (nomi[c.id] ?? '').trim() === c.nome}
              aria-label={tPaginaRibilanciamento('bottoneSalva')}
              title={tPaginaRibilanciamento('bottoneSalva')}
              style={{
                ...STILE_BOTTONE_ICONA,
                color: 'var(--text-primary)',
                opacity: pendingId === c.id || (nomi[c.id] ?? '').trim() === c.nome ? 0.5 : 1,
              }}
            >
              <IconaSalva />
            </button>
            <button
              type="button"
              onClick={() => handleElimina(c.id, c.nome)}
              disabled={pendingId === c.id}
              aria-label={t('bottoneElimina')}
              title={t('bottoneElimina')}
              style={{ ...STILE_BOTTONE_ICONA, color: 'var(--danger)', opacity: pendingId === c.id ? 0.5 : 1 }}
            >
              <IconaElimina />
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