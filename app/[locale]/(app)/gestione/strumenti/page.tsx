import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { FormNuovoAsset } from './form-nuovo-asset'
import { FormNuovoContenitore } from './form-nuovo-contenitore'
import { ListaContenitori } from './lista-contenitori'

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

  const [{ data: tipiRaw }, { data: impostazioniRaw }, { data: contenitori }] = await Promise.all([
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
  ])

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

          <FormNuovoAsset tipiPerCategoria={tipiPerCategoria} aliquoteDefaultPerCategoria={aliquoteDefaultPerCategoria} />
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

          {params.successo_contenitore === '1' && (
            <p style={{ color: 'var(--success)', fontSize: 'var(--fs-body)', marginBottom: 12 }}>{t('successoContenitoreCreato')}</p>
          )}
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