'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { eliminaAsset } from './actions'
import { IconaElimina, IconaModifica } from '@/components/icone'
import { Modale } from '@/components/modale'
import { useConferma } from '@/components/conferma'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { traduciTipoStrumento } from '@/lib/i18n-tipi-strumento'
import { CHIAVE_TRADUZIONE_TIPO_LIQUIDITA } from '@/lib/i18n-tipi-liquidita'
import { LARGHEZZA_RIGA_QUATTRO_CAMPI, STILE_BOTTONE_ICONA } from './layout-campi'
import { FormAsset, type StrumentoModificabile } from './form-asset'

export type AssetElenco = StrumentoModificabile & {
  transazioni: number
  movimenti: number
}

export function ListaAsset({
  asset,
  tipiPerCategoria,
  aliquoteDefaultPerCategoria,
}: {
  asset: AssetElenco[]
  tipiPerCategoria: Record<string, string[]>
  aliquoteDefaultPerCategoria: Record<string, number>
}) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tCategorie = useTranslations('Categorie')
  const tTipiLiquidita = useTranslations('TipiLiquidita')
  const tTipiStrumento = useTranslations('TipiStrumento')
  const tMenu = useTranslations('Menu')
  const tGestioneTransazioni = useTranslations('PaginaGestioneTransazioni')
  const router = useRouter()
  const conferma = useConferma()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<{ tipo: 'successo' | 'errore'; testo: string } | null>(null)
  const [, startTransition] = useTransition()
  const [inModifica, setInModifica] = useState<AssetElenco | null>(null)

  function etichettaCategoria(categoria: string): string {
    return traduciCategoria(tCategorie, categoria)
  }

  function etichettaTipo(categoria: string, tipo: string): string {
    if (categoria === 'Liquidita') {
      const chiave = CHIAVE_TRADUZIONE_TIPO_LIQUIDITA[tipo]
      return chiave ? tTipiLiquidita(chiave) : tipo
    }
    return traduciTipoStrumento(tTipiStrumento, tipo)
  }

  // Raggruppati per categoria (nella lingua corrente), poi per nome.
  const assetOrdinati = useMemo(
    () =>
      [...asset].sort(
        (a, b) =>
          etichettaCategoria(a.categoria).localeCompare(etichettaCategoria(b.categoria)) || a.nome.localeCompare(b.nome)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asset]
  )

  async function handleElimina(a: AssetElenco) {
    const confermato = await conferma({
      titolo: t('titoloEliminaAsset'),
      messaggio: t('confermaEliminaAsset', { nome: a.nome }),
      etichettaConferma: t('bottoneElimina'),
      pericoloso: true,
    })
    if (!confermato) return

    // Con transazioni o movimenti collegati serve una seconda conferma: vengono
    // eliminati anche quelli, e non si torna indietro.
    if (a.transazioni > 0 || a.movimenti > 0) {
      const confermatoConDati = await conferma({
        titolo: t('titoloEliminaAssetIrreversibile'),
        messaggio: t('confermaEliminaAssetConDati', {
          nome: a.nome,
          transazioni: a.transazioni,
          movimenti: a.movimenti,
          percorsoEsporta: `${tMenu('gestioneDatabase')} → ${tGestioneTransazioni('titoloEsporta')}`,
        }),
        etichettaConferma: t('bottoneElimina'),
        pericoloso: true,
      })
      if (!confermatoConDati) return
    }

    setMessaggio(null)
    setPendingId(a.id)
    startTransition(async () => {
      const risultato = await eliminaAsset(a.id)
      setPendingId(null)
      if ('errore' in risultato) {
        setMessaggio({ tipo: 'errore', testo: risultato.errore })
      } else {
        setMessaggio({
          tipo: 'successo',
          testo: t('successoEliminaAsset', {
            nome: a.nome,
            transazioni: risultato.transazioniEliminate,
            movimenti: risultato.movimentiEliminati,
          }),
        })
        router.refresh()
      }
    })
  }

  if (asset.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunAssetCreato')}</p>
  }

  return (
    <div>
      {messaggio && (
        <p
          style={{
            color: messaggio.tipo === 'successo' ? 'var(--success)' : 'var(--danger)',
            fontSize: 'var(--fs-body)',
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          {messaggio.testo}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        {assetOrdinati.map((a, indice) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              // Divisore tra le righe, non dopo l'ultima.
              borderBottom: indice < assetOrdinati.length - 1 ? '1px solid var(--border-default)' : 'none',
              opacity: pendingId === a.id ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-table)', color: 'var(--text-primary)' }}>{a.nome}</span>
            <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {etichettaCategoria(a.categoria)} · {etichettaTipo(a.categoria, a.tipo)}
            </span>
            <button
              type="button"
              onClick={() => {
                setMessaggio(null)
                setInModifica(a)
              }}
              disabled={pendingId !== null}
              aria-label={t('ariaLabelModificaAsset', { nome: a.nome })}
              title={t('ariaLabelModificaAsset', { nome: a.nome })}
              style={{ ...STILE_BOTTONE_ICONA, color: 'var(--text-primary)', cursor: pendingId !== null ? 'default' : 'pointer' }}
            >
              <IconaModifica />
            </button>
            <button
              type="button"
              onClick={() => handleElimina(a)}
              disabled={pendingId !== null}
              aria-label={t('ariaLabelEliminaAsset', { nome: a.nome })}
              title={t('ariaLabelEliminaAsset', { nome: a.nome })}
              style={{ ...STILE_BOTTONE_ICONA, color: 'var(--danger)', cursor: pendingId !== null ? 'default' : 'pointer' }}
            >
              <IconaElimina />
            </button>
          </div>
        ))}
      </div>

      <Modale
        aperto={inModifica !== null}
        onChiudi={() => setInModifica(null)}
        titolo={t('titoloModificaAsset')}
        mostraChiusura={false}
        larghezzaMassima={760}
      >
        {inModifica && (
          <FormAsset
            // key: un altro strumento riparte da un form nuovo, non dallo stato del precedente.
            key={inModifica.id}
            tipiPerCategoria={tipiPerCategoria}
            aliquoteDefaultPerCategoria={aliquoteDefaultPerCategoria}
            strumento={inModifica}
            haCollegamenti={inModifica.transazioni > 0 || inModifica.movimenti > 0}
            onAnnulla={() => setInModifica(null)}
            onSalvato={() => {
              setMessaggio({ tipo: 'successo', testo: t('successoModificaAsset', { nome: inModifica.nome }) })
              setInModifica(null)
              router.refresh()
            }}
          />
        )}
      </Modale>
    </div>
  )
}
