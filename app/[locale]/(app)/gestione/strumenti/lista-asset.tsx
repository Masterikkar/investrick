'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { eliminaAsset } from './actions'
import { IconaElimina } from '@/components/icone'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { traduciTipoStrumento } from '@/lib/i18n-tipi-strumento'
import { CHIAVE_TRADUZIONE_TIPO_LIQUIDITA } from '@/lib/i18n-tipi-liquidita'
import { LARGHEZZA_RIGA_QUATTRO_CAMPI } from './layout-campi'

export type AssetElenco = {
  id: string
  nome: string
  categoria: string
  tipo: string
  transazioni: number
  movimenti: number
}

const stileBottoneIcona: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--danger)',
  padding: 4,
  cursor: 'pointer',
  flexShrink: 0,
}

export function ListaAsset({ asset }: { asset: AssetElenco[] }) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tCategorie = useTranslations('Categorie')
  const tContenitori = useTranslations('Contenitori')
  const tTipiLiquidita = useTranslations('TipiLiquidita')
  const tTipiStrumento = useTranslations('TipiStrumento')
  const tMenu = useTranslations('Menu')
  const tGestioneTransazioni = useTranslations('PaginaGestioneTransazioni')
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<{ tipo: 'successo' | 'errore'; testo: string } | null>(null)
  const [, startTransition] = useTransition()

  function etichettaCategoria(categoria: string): string {
    return categoria === 'Liquidita' ? tContenitori('liquidita') : traduciCategoria(tCategorie, categoria)
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

  function handleElimina(a: AssetElenco) {
    if (!window.confirm(t('confermaEliminaAsset', { nome: a.nome }))) return
    // Con transazioni o movimenti collegati serve una seconda conferma: vengono
    // eliminati anche quelli, e non si torna indietro.
    if (
      (a.transazioni > 0 || a.movimenti > 0) &&
      !window.confirm(
        t('confermaEliminaAssetConDati', {
          nome: a.nome,
          transazioni: a.transazioni,
          movimenti: a.movimenti,
          percorsoEsporta: `${tMenu('gestioneDatabase')} → ${tGestioneTransazioni('titoloEsporta')}`,
        })
      )
    )
      return

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
        {assetOrdinati.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              borderBottom: '1px solid var(--border-default)',
              opacity: pendingId === a.id ? 0.5 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-table)', color: 'var(--text-primary)' }}>{a.nome}</span>
            <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {etichettaCategoria(a.categoria)} · {etichettaTipo(a.categoria, a.tipo)}
            </span>
            <button
              type="button"
              onClick={() => handleElimina(a)}
              disabled={pendingId !== null}
              aria-label={t('ariaLabelEliminaAsset', { nome: a.nome })}
              title={t('ariaLabelEliminaAsset', { nome: a.nome })}
              style={{ ...stileBottoneIcona, cursor: pendingId !== null ? 'default' : 'pointer' }}
            >
              <IconaElimina />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
