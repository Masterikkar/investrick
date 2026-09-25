import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { GraficoRendimentiAnnuali, type RendimentoAnnuale } from '@/components/grafico-rendimenti-annuali'
import { GraficoBarre, type PuntoBarra } from '@/components/grafico-barre'
import { Sezione } from '@/components/sezione'

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

export default async function RendimentiPage() {
  const t = await getTranslations('PaginaRendimenti')
  const tMenu = await getTranslations('Menu')
  const tContenitori = await getTranslations('Contenitori')
  const tPaginaContenitore = await getTranslations('PaginaContenitore')
  const supabase = await createClient()

  const ETICHETTA_TIPO: Record<string, string> = {
    PAC: tContenitori('pac'),
    Polizza: tPaginaContenitore('etichettaPolizza'),
  }

  const [{ data: contenitori }, { data: contiLiquidita }] = await Promise.all([
    supabase
      .from('contenitori')
      .select('id, nome, tipo')
      .in('tipo', ['PAC', 'Polizza'])
      .order('tipo')
      .order('nome'),
    // I conti di liquidità sono gli strumenti di categoria Liquidita (non
    // esiste più un contenitore "Liquidità").
    supabase.from('strumenti').select('id').eq('categoria', 'Liquidita'),
  ])
  const idContiLiquidita = (contiLiquidita ?? []).map((s) => s.id)

  const ids = (contenitori ?? []).map((c) => c.id)

  // Una riga per contenitore e per giorno, oltre 1000 righe per PAC e Polizze
  // insieme: va letta a blocchi, con un ordinamento univoco (data, contenitore).
  const { data: storicoRaw } = ids.length
    ? await tutteLeRighe((da, a) =>
        supabase
          .from('v_storico_valorizzazioni_per_contenitore')
          .select('contenitore_id, data, valore_totale, capitale_investito_totale')
          .in('contenitore_id', ids)
          .order('data', { ascending: true })
          .order('contenitore_id', { ascending: true })
          .range(da, a)
      )
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

  // --- Liquidità: interessi netti per anno (nessun "capitale investito" per un conto,
  // quindi qui il rendimento è mostrato come importo assoluto, non come percentuale) ---
  const { data: interessiRaw } = idContiLiquidita.length
    ? await supabase
        .from('movimenti_liquidita')
        .select('data, importo, tassa_trattenuta')
        .in('strumento_id', idContiLiquidita)
        .eq('tipo_movimento', 'Interesse')
        .order('data', { ascending: true })
    : { data: null }

  const interessiPerAnno = new Map<number, number>()
  for (const r of interessiRaw ?? []) {
    const anno = Number(r.data.slice(0, 4))
    const netto = Number(r.importo) - Number(r.tassa_trattenuta)
    interessiPerAnno.set(anno, (interessiPerAnno.get(anno) ?? 0) + netto)
  }
  const puntiInteressiAnnuali: PuntoBarra[] = Array.from(interessiPerAnno.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([anno, valore]) => ({ etichetta: String(anno), valore }))

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('rendimenti')}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, maxWidth: 640 }}>
        {t('paragrafoSpiegazione')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {(contenitori ?? []).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>{t('alertNessunContenitore')}</p>
        ) : (
          (contenitori ?? []).map((c) => {
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
              <section key={c.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{c.nome}</h2>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-surface)',
                      padding: '2px 8px',
                    }}
                  >
                    {ETICHETTA_TIPO[c.tipo] ?? c.tipo}
                  </span>
                </div>
                <Sezione>
                  <GraficoRendimentiAnnuali rendimentoCumulato={cumulato} rendimentiAnnuali={annuali} />
                </Sezione>
              </section>
            )
          })
        )}

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
            {tContenitori('liquidita')} — {t('suffissoInteressiMaturati')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
            {t('paragrafoSpiegazioneLiquidita')}
          </p>
          <Sezione>
            {puntiInteressiAnnuali.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunInteresseAnnuale')}</p>
            ) : (
              <GraficoBarre punti={puntiInteressiAnnuali} />
            )}
          </Sezione>
        </section>
      </div>
    </div>
  )
}
