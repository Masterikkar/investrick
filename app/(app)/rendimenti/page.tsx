import { createClient } from '@/lib/supabase/server'
import { GraficoRendimentiAnnuali, type RendimentoAnnuale } from '@/components/grafico-rendimenti-annuali'

type Snapshot = { data: string; valore: number; capitaleInvestito: number }

function calcolaSerieAnnuale(punti: Snapshot[]): { cumulato: number | null; annuali: RendimentoAnnuale[] } {
  if (punti.length === 0) return { cumulato: null, annuali: [] }

  const ordinati = [...punti].sort((a, b) => a.data.localeCompare(b.data))
  const ultimo = ordinati[ordinati.length - 1]
  const cumulato =
    ultimo.capitaleInvestito > 0 ? ((ultimo.valore - ultimo.capitaleInvestito) / ultimo.capitaleInvestito) * 100 : null

  const primoAnno = new Date(ordinati[0].data).getFullYear()
  const ultimoAnno = new Date(ultimo.data).getFullYear()

  const annuali: RendimentoAnnuale[] = []
  let puntoAnnoPrecedente: Snapshot | null = null

  for (let anno = primoAnno; anno <= ultimoAnno; anno++) {
    const confineAnno = `${anno}-12-31`
    const puntiFinoAConfine = ordinati.filter((p) => p.data <= confineAnno)
    const puntoFineAnno = puntiFinoAConfine.length > 0 ? puntiFinoAConfine[puntiFinoAConfine.length - 1] : null

    if (!puntoFineAnno) continue

    const valoreInizio = puntoAnnoPrecedente?.valore ?? 0
    const capitaleInizio = puntoAnnoPrecedente?.capitaleInvestito ?? 0
    const guadagnoAnno = puntoFineAnno.valore - puntoFineAnno.capitaleInvestito - (valoreInizio - capitaleInizio)
    const rendimentoPct =
      puntoFineAnno.capitaleInvestito > 0 ? (guadagnoAnno / puntoFineAnno.capitaleInvestito) * 100 : null

    annuali.push({ anno, rendimentoPct })
    puntoAnnoPrecedente = puntoFineAnno
  }

  return { cumulato, annuali }
}

const ETICHETTA_TIPO: Record<string, string> = {
  PAC: 'PAC',
  Polizza: 'Polizza vita',
  Liquidita: 'Liquidità',
}

export default async function RendimentiPage() {
  const supabase = await createClient()

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome, tipo')
    .in('tipo', ['PAC', 'Polizza', 'Liquidita'])
    .order('tipo')
    .order('nome')

  const ids = (contenitori ?? []).map((c) => c.id)

  const { data: storicoRaw } = ids.length
    ? await supabase
        .from('v_storico_valorizzazioni_per_contenitore')
        .select('contenitore_id, data, valore_totale, capitale_investito_totale')
        .in('contenitore_id', ids)
        .order('data', { ascending: true })
    : { data: null }

  const perContenitore = new Map<string, Map<string, { valore: number; capitaleInvestito: number }>>()
  for (const r of storicoRaw ?? []) {
    if (!r.contenitore_id || !r.data) continue
    if (!perContenitore.has(r.contenitore_id)) perContenitore.set(r.contenitore_id, new Map())
    const mappaDate = perContenitore.get(r.contenitore_id)!
    mappaDate.set(r.data, {
      valore: Number(r.valore_totale),
      capitaleInvestito: Number(r.capitale_investito_totale ?? 0),
    })
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>Rendimenti</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>Rendimenti</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24, maxWidth: 640 }}>
        Rendimento per anno solare (01/01 → 31/12), calcolato come variazione della plus/minusvalenza non
        realizzata rispetto al capitale investito a fine anno. L'anno in corso mostra il rendimento maturato
        finora, fino all'ultimo aggiornamento disponibile.
      </p>

      {(contenitori ?? []).length === 0 ? (
        <p style={{ color: '#666' }}>Nessun PAC, polizza o conto di liquidità registrato.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {(contenitori ?? []).map((c) => {
            const mappaDate = perContenitore.get(c.id)
            const punti: Snapshot[] = mappaDate
              ? Array.from(mappaDate.entries()).map(([data, v]) => ({
                  data,
                  valore: v.valore,
                  capitaleInvestito: v.capitaleInvestito,
                }))
              : []
            const { cumulato, annuali } = calcolaSerieAnnuale(punti)

            return (
              <section key={c.id} style={{ maxWidth: 640 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <h2 style={{ fontSize: 18, margin: 0 }}>{c.nome}</h2>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#666',
                      background: '#eee',
                      borderRadius: 999,
                      padding: '2px 8px',
                    }}
                  >
                    {ETICHETTA_TIPO[c.tipo] ?? c.tipo}
                  </span>
                </div>
                <GraficoRendimentiAnnuali rendimentoCumulato={cumulato} rendimentiAnnuali={annuali} />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}