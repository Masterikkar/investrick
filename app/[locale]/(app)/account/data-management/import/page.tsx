import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SezioneImpostazioni } from '../../settings/sezione-impostazioni'
import { ImportaExcel } from './importa-excel'
import { ImportaExcelLiquidita } from './importa-excel-liquidita'

export default async function ImportPage() {
  const tMenu = await getTranslations('Menu')
  const tPaginaStorico = await getTranslations('PaginaStorico')
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: tipiRaw }] = await Promise.all([
    supabase.from('strumenti').select('id, nome, ticker, categoria, isin').order('categoria').order('nome'),
    supabase.from('contenitori').select('id, nome, tipo').order('nome'),
    supabase.from('tipi_strumento').select('categoria, tipo').neq('categoria', 'Liquidita').order('categoria').order('tipo'),
  ])

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <>
      <SezioneImpostazioni titolo={tMenu('transazioniFinanziarie')}>
        <ImportaExcel
          strumenti={(strumenti ?? []).map((s) => ({ id: s.id, isin: s.isin, ticker: s.ticker, nome: s.nome }))}
          contenitori={contenitori ?? []}
          tipiPerCategoria={tipiPerCategoria}
        />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={tPaginaStorico('titoloTransazioniLiquidita')}>
        <ImportaExcelLiquidita
          strumenti={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
          contenitori={contenitori ?? []}
        />
      </SezioneImpostazioni>
    </>
  )
}
