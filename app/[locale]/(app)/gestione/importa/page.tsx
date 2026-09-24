import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Sezione } from '@/components/sezione'
import { ImportaExcel } from './importa-excel'
import { ImportaExcelLiquidita } from './importa-excel-liquidita'

const stileBlocco: React.CSSProperties = {
  marginTop: 32,
  paddingTop: 32,
  borderTop: '1px solid var(--border-default)',
}

const stileTitoloBlocco: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 0, marginBottom: 12 }

export default async function ImportaPage() {
  const tMenu = await getTranslations('Menu')
  const tGestioneTransazioni = await getTranslations('PaginaGestioneTransazioni')
  const tPaginaStorico = await getTranslations('PaginaStorico')
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: tipiRaw }] = await Promise.all([
    supabase.from('strumenti').select('id, nome, ticker, categoria, isin').order('categoria').order('nome'),
    supabase.from('contenitori').select('id, nome').order('nome'),
    supabase.from('tipi_strumento').select('categoria, tipo').neq('categoria', 'Liquidita').order('categoria').order('tipo'),
  ])

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tGestioneTransazioni('titoloImporta')}</h1>

      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{tMenu('transazioni')}</h2>
        <Sezione>
          <div>
            <h3 style={stileTitoloBlocco}>{tMenu('transazioniFinanziarie')}</h3>
            <ImportaExcel
              strumenti={(strumenti ?? []).map((s) => ({ id: s.id, isin: s.isin, ticker: s.ticker, nome: s.nome }))}
              contenitori={contenitori ?? []}
              tipiPerCategoria={tipiPerCategoria}
            />
          </div>

          <div style={stileBlocco}>
            <h3 style={stileTitoloBlocco}>{tPaginaStorico('titoloTransazioniLiquidita')}</h3>
            <ImportaExcelLiquidita
              strumenti={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
              contenitori={contenitori ?? []}
            />
          </div>
        </Sezione>
      </section>
    </div>
  )
}
