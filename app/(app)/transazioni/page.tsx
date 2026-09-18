import { createClient } from '@/lib/supabase/server'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { ImportaExcel } from './importa-excel'
import { ImportaExcelLiquidita } from './importa-excel-liquidita'
import { EsportaTransazioniFinanziarie, EsportaTransazioniLiquidita } from './esporta-transazioni'
import { NuovaTransazioneFinanziaria, NuovaTransazioneLiquidita } from './nuova-transazione'

const stileBlocco: React.CSSProperties = {
  marginTop: 32,
  paddingTop: 32,
  borderTop: '1px solid var(--border-default)',
}

export default async function TransazioniPage({
  searchParams,
}: {
  searchParams: Promise<{
    successo_finanziaria?: string
    errore_finanziaria?: string
    successo_liquidita?: string
    errore_liquidita?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: strumenti } = await supabase
    .from('strumenti')
    .select('id, nome, ticker, categoria, isin')
    .order('categoria')
    .order('nome')

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome')
    .order('nome')

  const { data: tipiRaw } = await supabase
    .from('tipi_strumento')
    .select('categoria, tipo')
    .neq('categoria', 'Liquidita')
    .order('categoria')
    .order('tipo')

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>Account</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 4, fontWeight: 500 }}>Transazioni</h1>

      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--fs-body)', marginTop: 12, marginBottom: 24 }}>
        <RippleLink href="/transazioni/asset" className="link-interattivo">
          Vedi storico Transazioni finanziarie →
        </RippleLink>
        <RippleLink href="/transazioni/liquidita" className="link-interattivo">
          Vedi storico Transazioni di liquidità →
        </RippleLink>
      </div>

      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Transazioni finanziarie</h2>
        <Sezione>
          <div>
            <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Importa</h3>
            <NuovaTransazioneFinanziaria
              strumenti={strumenti ?? []}
              contenitori={contenitori ?? []}
              successo={params.successo_finanziaria === '1'}
              errore={params.errore_finanziaria === '1'}
            />
            <div style={{ marginTop: 20 }}>
              <ImportaExcel
                strumenti={(strumenti ?? []).map((s) => ({ id: s.id, isin: s.isin, ticker: s.ticker, nome: s.nome }))}
                contenitori={contenitori ?? []}
                tipiPerCategoria={tipiPerCategoria}
              />
            </div>
          </div>

          <div style={stileBlocco}>
            <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Esporta</h3>
            <EsportaTransazioniFinanziarie />
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Transazioni di liquidità</h2>
        <Sezione>
          <div>
            <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Importa</h3>
            <NuovaTransazioneLiquidita
              strumentiLiquidita={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
              contenitori={contenitori ?? []}
              successo={params.successo_liquidita === '1'}
              errore={params.errore_liquidita === '1'}
            />
            <div style={{ marginTop: 20 }}>
              <ImportaExcelLiquidita
                strumenti={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
                contenitori={contenitori ?? []}
              />
            </div>
          </div>

          <div style={stileBlocco}>
            <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Esporta</h3>
            <EsportaTransazioniLiquidita />
          </div>
        </Sezione>
      </section>
    </div>
  )
}