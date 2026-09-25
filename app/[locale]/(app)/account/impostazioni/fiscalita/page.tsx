import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { AliquoteCategoria, type CategoriaAliquota } from './aliquote-categoria'
import { AliquoteStrumenti, type RigaAliquotaStrumento } from './aliquote-strumenti'
import { SezioneImpostazioni } from '../sezione-impostazioni'
import { CATEGORIE } from '@/lib/categorie'

type ImpostazioneCategoria = { categoria: string; aliquota_default: number }
type Strumento = { id: string; nome: string; categoria: string; aliquota_tassazione: number }


export default async function ImpostazioniFiscalitaPage() {
  const t = await getTranslations('PaginaGestioneFiscalita')
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

  const categorie: CategoriaAliquota[] = CATEGORIE.map((categoria) => ({
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
    <>
      <SezioneImpostazioni titolo={t('titoloAliquotePerCategoria')}>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {t('paragrafoAliquotePerCategoria', { bottone: t('bottoneReimpostaTutti') })}
        </p>
        <AliquoteCategoria categorie={categorie} />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={t('titoloAliquotePerStrumento')}>
        <AliquoteStrumenti righe={righeStrumenti} />
      </SezioneImpostazioni>
    </>
  )
}
