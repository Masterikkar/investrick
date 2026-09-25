import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { aggregaStrumenti } from '@/lib/gruppi'
import { CATEGORIE } from '@/lib/categorie'
import { Breadcrumb } from '@/components/breadcrumb'
import { Sezione } from '@/components/sezione'
import { ElencoMembri, type StrumentoSelezionabile } from './elenco-membri'

export default async function MembriGruppoPage({
  params,
  searchParams,
}: {
  params: Promise<{ contenitoreId: string }>
  searchParams: Promise<{ errore?: string }>
}) {
  const { contenitoreId } = await params
  const { errore } = await searchParams
  const t = await getTranslations('PaginaMembriGruppo')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()

  const { data: gruppo } = await supabase
    .from('contenitori')
    .select('id, nome, tipo')
    .eq('id', contenitoreId)
    .maybeSingle()

  if (!gruppo || gruppo.tipo !== 'Personalizzato') notFound()

  const [{ data: membriRaw }, { data: strumentiRaw }] = await Promise.all([
    supabase.from('gruppi_personalizzati_strumenti').select('strumento_id').eq('contenitore_id', contenitoreId),
    supabase.from('strumenti').select('id, nome, ticker, categoria').order('nome'),
  ])

  const strumenti = strumentiRaw ?? []
  // Valore di ogni strumento su tutti i suoi contenitori reali, come nella pagina Asset.
  const aggregati = await aggregaStrumenti(supabase, strumenti)
  const idMembri = new Set((membriRaw ?? []).map((m) => m.strumento_id))

  // Ordine: categoria canonica, poi nome.
  const ordineCategoria = (c: string) => {
    const i = CATEGORIE.indexOf(c)
    return i === -1 ? CATEGORIE.length : i
  }
  const selezionabili: StrumentoSelezionabile[] = strumenti
    .map((s) => ({ id: s.id, nome: s.nome, ticker: s.ticker, categoria: s.categoria, valore: aggregati.get(s.id)?.valore ?? 0 }))
    .sort((a, b) => ordineCategoria(a.categoria) - ordineCategoria(b.categoria) || a.nome.localeCompare(b.nome))

  return (
    <div>
      <Breadcrumb />

      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)', marginTop: 12 }}>
        {tContenitori('personalizzati')}
      </div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 8, fontWeight: 500 }}>{gruppo.nome}</h1>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: 0, maxWidth: 640 }}>{t('intro')}</p>

      {errore === '1' && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)' }}>{t('erroreGenerico')}</p>
      )}

      <Sezione>
        <ElencoMembri
          contenitoreId={gruppo.id}
          membri={selezionabili.filter((s) => idMembri.has(s.id))}
          disponibili={selezionabili.filter((s) => !idMembri.has(s.id))}
        />
      </Sezione>
    </div>
  )
}
