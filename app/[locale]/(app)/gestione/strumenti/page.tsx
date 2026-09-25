import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { FormAsset } from './form-asset'
import { FormNuovoContenitore } from './form-nuovo-contenitore'
import { NotificaDaParametro } from './notifica-da-parametro'
import { ListaContenitori } from './lista-contenitori'
import { ListaAsset, type AssetElenco } from './lista-asset'

type TipoStrumento = { categoria: string; tipo: string }
type ImpostazioneCategoria = { categoria: string; aliquota_default: number }
type Contenitore = { id: string; nome: string; tipo: string }

export default async function GestioneStrumentiPage({
  searchParams,
}: {
  searchParams: Promise<{
    errore?: string
    duplicato_id?: string
    duplicato_nome?: string
    successo_contenitore?: string
    errore_contenitore?: string
  }>
}) {
  const t = await getTranslations('PaginaGestioneStrumenti')
  const tMenu = await getTranslations('Menu')
  const params = await searchParams
  const supabase = await createClient()

  const [
    { data: tipiRaw },
    { data: impostazioniRaw },
    { data: contenitori },
    { data: strumenti },
    { data: transazioniPerStrumento },
    { data: movimentiPerStrumento },
  ] = await Promise.all([
    supabase
      .from('tipi_strumento')
      .select('categoria, tipo')
      .order('categoria')
      .order('tipo')
      .returns<TipoStrumento[]>(),
    supabase
      .from('impostazioni_aliquote_categoria')
      .select('categoria, aliquota_default')
      .returns<ImpostazioneCategoria[]>(),
    supabase.from('contenitori').select('id, nome, tipo').order('nome').returns<Contenitore[]>(),
    supabase
      .from('strumenti')
      .select(
        'id, nome, categoria, tipo, ticker, isin, valuta, codice_prezzo, provider, tasso_percentuale, data_scadenza, cedola_percentuale, frequenza_cedola, note'
      )
      .order('nome'),
    // Solo strumento_id, per contare transazioni e movimenti collegati a ogni
    // strumento: decidono se l'eliminazione chiede la seconda conferma.
    tutteLeRighe((da, a) => supabase.from('transazioni').select('strumento_id').order('id').range(da, a)),
    tutteLeRighe((da, a) => supabase.from('movimenti_liquidita').select('strumento_id').order('id').range(da, a)),
  ])

  const conteggio = (righe: { strumento_id: string | null }[] | null) => {
    const mappa = new Map<string, number>()
    for (const r of righe ?? []) if (r.strumento_id) mappa.set(r.strumento_id, (mappa.get(r.strumento_id) ?? 0) + 1)
    return mappa
  }
  const nTransazioni = conteggio(transazioniPerStrumento)
  const nMovimenti = conteggio(movimentiPerStrumento)
  const assetElenco: AssetElenco[] = (strumenti ?? []).map((s) => ({
    ...s,
    transazioni: nTransazioni.get(s.id) ?? 0,
    movimenti: nMovimenti.get(s.id) ?? 0,
  }))

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const aliquoteDefaultPerCategoria: Record<string, number> = {}
  for (const i of impostazioniRaw ?? []) {
    aliquoteDefaultPerCategoria[i.categoria] = Number(i.aliquota_default)
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titoloGestioneStrumenti')}</h1>

      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloAsset')}</h2>
        <Sezione>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 12 }}>{t('titoloCreaNuovoAsset')}</h3>

          {params.errore === 'duplicato' && params.duplicato_id && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--warning)',
                padding: 12,
                marginBottom: 16,
                color: 'var(--text-primary)',
                fontSize: 'var(--fs-body)',
                maxWidth: 420,
              }}
            >
              {t.rich('erroreIsinDuplicato', {
                nome: decodeURIComponent(params.duplicato_nome ?? ''),
                strong: (chunks) => <strong>{chunks}</strong>,
                link: (chunks) => (
                  <RippleLink href={`/asset/${params.duplicato_id}`} className="link-interattivo">
                    {chunks}
                  </RippleLink>
                ),
              })}
            </div>
          )}
          {params.errore === '1' && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>
              {t('erroreGenerico')}
            </p>
          )}

          <FormAsset tipiPerCategoria={tipiPerCategoria} aliquoteDefaultPerCategoria={aliquoteDefaultPerCategoria} />

          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>{t('titoloAssetEsistenti')}</h3>
          <ListaAsset
            asset={assetElenco}
            tipiPerCategoria={tipiPerCategoria}
            aliquoteDefaultPerCategoria={aliquoteDefaultPerCategoria}
          />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloContenitori')}</h2>
        <Sezione>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 12 }}>{t('titoloModificaContenitori')}</h3>

          <ListaContenitori contenitori={contenitori ?? []} />

          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>
            {t('titoloCreaNuovoContenitore')}
          </h3>

          {params.successo_contenitore === '1' && <NotificaDaParametro messaggio={t('successoContenitoreCreato')} />}
          {params.errore_contenitore === '1' && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 12 }}>
              {t('erroreGenerico')}
            </p>
          )}

          <FormNuovoContenitore />
        </Sezione>
      </section>
    </div>
  )
}