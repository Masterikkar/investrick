import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIE } from '@/lib/categorie'
import { Sezione } from '@/components/sezione'
import { Breadcrumb } from '@/components/breadcrumb'
import { FormTargetPortafoglio } from './form-target-portafoglio'

// Route statica: ha la precedenza su /target/[contenitoreId].
export default async function TargetPortafoglioPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  const { errore } = await searchParams
  const t = await getTranslations('PaginaTargetPortafoglio')
  const tMenu = await getTranslations('Menu')
  const supabase = await createClient()

  const { data: targetRaw } = await supabase
    .from('target_allocazioni')
    .select('categoria, target_percentuale, attivo')
    .is('contenitore_id', null)

  const percentualiIniziali: Record<string, number> = {}
  for (const cat of CATEGORIE) {
    const riga = targetRaw?.find((r) => r.categoria === cat)
    percentualiIniziali[cat] = riga?.attivo ? Number(riga.target_percentuale) : 0
  }

  return (
    <div>
      <Breadcrumb />

      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)', marginTop: 12 }}>
        {tMenu('portafoglio')}
      </div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titolo')}</h1>

      {errore === 'somma' && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>{t('erroreSommaServer')}</p>
      )}
      {errore === '1' && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>{t('erroreGenerico')}</p>
      )}

      <Sezione>
        <FormTargetPortafoglio percentualiIniziali={percentualiIniziali} />
      </Sezione>
    </div>
  )
}
