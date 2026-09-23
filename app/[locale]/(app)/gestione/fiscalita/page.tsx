import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Sezione } from '@/components/sezione'
import { EsportaFiscalita } from './esporta-fiscalita'
import { AliquoteCategoria, type CategoriaAliquota } from './aliquote-categoria'
import { AliquoteStrumenti, type RigaAliquotaStrumento } from './aliquote-strumenti'

type ImpostazioneCategoria = { categoria: string; aliquota_default: number }
type Strumento = { id: string; nome: string; categoria: string; aliquota_tassazione: number }

const ORDINE_CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto', 'Liquidita']

export default async function GestioneFiscalitaPage() {
  const t = await getTranslations('PaginaGestioneFiscalita')
  const tMenu = await getTranslations('Menu')
  const supabase = await createClient()

  const [{ data: impostazioniRaw }, { data: strumentiRaw }] = await Promise.all([
    supabase.from('impostazioni_aliquote_categoria').select('categoria, aliquota_default').returns<ImpostazioneCategoria[]>(),
    supabase.from('strumenti').select('id, nome, categoria, aliquota_tassazione').order('nome').returns<Strumento[]>(),
  ])

  const impostazioni = impostazioniRaw ?? []
  const strumenti = strumentiRaw ?? []

  const defaultMap = new Map(impostazioni.map((i) => [i.categoria, Number(i.aliquota_default)]))
  const conteggioMap = new Map<string, number>()
  for (const s of strumenti) {
    conteggioMap.set(s.categoria, (conteggioMap.get(s.categoria) ?? 0) + 1)
  }

  const categorie: CategoriaAliquota[] = ORDINE_CATEGORIE.map((categoria) => ({
    categoria,
    aliquotaDefault: defaultMap.get(categoria) ?? 26,
    numeroStrumenti: conteggioMap.get(categoria) ?? 0,
  }))

  const righeStrumenti: RigaAliquotaStrumento[] = strumenti.map((s) => ({
    id: s.id,
    nome: s.nome,
    categoria: s.categoria,
    aliquotaTassazione: Number(s.aliquota_tassazione),
  }))

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titoloGestioneFiscalita')}</h1>

      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloEsportazione')}</h2>
        <Sezione>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
            {t('paragrafoEsportazione')}
          </p>
          <EsportaFiscalita />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 4 }}>{t('titoloAliquotePerCategoria')}</h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {t('paragrafoAliquotePerCategoria', { bottone: t('bottoneReimpostaTutti') })}
        </p>
        <Sezione>
          <AliquoteCategoria categorie={categorie} />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloAliquotePerStrumento')}</h2>
        <Sezione>
          <AliquoteStrumenti righe={righeStrumenti} />
        </Sezione>
      </section>
    </div>
  )
}