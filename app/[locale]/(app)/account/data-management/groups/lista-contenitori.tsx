'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { eliminaContenitore } from './actions-contenitore'
import { LARGHEZZA_RIGA_QUATTRO_CAMPI } from '../layout-campi'
import { IconaElimina, IconaModifica, STILE_BOTTONE_ICONA } from '@/components/icone'
import { Modale } from '@/components/modale'
import { useConferma } from '@/components/conferma'
import { useNotifica } from '@/components/notifica'
import { FormContenitore, type ContenitoreModificabile } from './form-contenitore'

export function ListaContenitori({ contenitori }: { contenitori: ContenitoreModificabile[] }) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tPaginaContenitore = useTranslations('PaginaContenitore')
  const router = useRouter()
  const conferma = useConferma()
  const notifica = useNotifica()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [erroreId, setErroreId] = useState<string | null>(null)
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [inModifica, setInModifica] = useState<ContenitoreModificabile | null>(null)

  function etichettaTipo(tipo: string): string {
    if (tipo === 'Polizza') return tPaginaContenitore('etichettaPolizza')
    if (tipo === 'Personalizzato') return tPaginaContenitore('etichettaPersonalizzato')
    return tipo
  }

  async function handleElimina(c: ContenitoreModificabile) {
    const confermato = await conferma({
      titolo: t('titoloEliminaContenitore'),
      messaggio: t('confermaEliminaContenitore', { nome: c.nome }),
      etichettaConferma: t('bottoneElimina'),
      pericoloso: true,
    })
    if (!confermato) return

    setErroreId(null)
    setMessaggioErrore(null)
    setPendingId(c.id)

    startTransition(async () => {
      const risultato = await eliminaContenitore(c.id)
      setPendingId(null)
      if ('errore' in risultato) {
        setErroreId(c.id)
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
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        {contenitori.map((c, indice) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              // Divisore tra le righe, non dopo l'ultima.
              borderBottom: indice < contenitori.length - 1 ? '1px solid var(--border-default)' : 'none',
              opacity: pendingId === c.id ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-table)', color: 'var(--text-primary)' }}>{c.nome}</span>
            <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {etichettaTipo(c.tipo)}
            </span>
            <button
              type="button"
              onClick={() => {
                setErroreId(null)
                setMessaggioErrore(null)
                setInModifica(c)
              }}
              disabled={pendingId !== null}
              aria-label={t('ariaLabelModificaContenitore', { nome: c.nome })}
              title={t('ariaLabelModificaContenitore', { nome: c.nome })}
              style={{ ...STILE_BOTTONE_ICONA, color: 'var(--text-primary)', cursor: pendingId !== null ? 'default' : 'pointer' }}
            >
              <IconaModifica />
            </button>
            <button
              type="button"
              onClick={() => handleElimina(c)}
              disabled={pendingId !== null}
              aria-label={t('ariaLabelEliminaContenitore', { nome: c.nome })}
              title={t('ariaLabelEliminaContenitore', { nome: c.nome })}
              style={{ ...STILE_BOTTONE_ICONA, color: 'var(--danger)', cursor: pendingId !== null ? 'default' : 'pointer' }}
            >
              <IconaElimina />
            </button>
          </div>
        ))}
      </div>

      {erroreId && messaggioErrore && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginTop: 12 }}>{messaggioErrore}</p>
      )}

      <Modale
        aperto={inModifica !== null}
        onChiudi={() => setInModifica(null)}
        titolo={t('titoloModificaContenitore')}
        mostraChiusura={false}
        larghezzaMassima={760}
      >
        {inModifica && (
          <FormContenitore
            // key: un altro gruppo riparte da un form nuovo, non dallo stato del precedente.
            key={inModifica.id}
            contenitore={inModifica}
            onAnnulla={() => setInModifica(null)}
            onSalvato={() => {
              setInModifica(null)
              router.refresh()
              notifica({ messaggio: t('successoContenitoreSalvato') })
            }}
          />
        )}
      </Modale>
    </div>
  )
}
