import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { GraficoStorico, type PuntoStorico } from '@/components/grafico-storico'
import { GraficoAnello, ElencoAllocazione, type FettaAnello } from '@/components/grafico-anello'
import { CardMetrica } from '@/components/card-metrica'
import { CardRendimento } from '@/components/card-rendimento'
import { Sezione } from '@/components/sezione'
import { ValoriChiusura } from '@/components/valori-chiusura'
import { CATEGORIE } from '@/lib/categorie'

type Posizione = {
  strumento_id: string
  contenitore_id: string | null
  valore: number | null
  capitale_investito: number
  quantita_posseduta: number
  prezzo_medio_unitario: number
}
type NonRealizzatoDettaglio = {
  strumento_id: string
  contenitore_id: string | null
  categoria: string
  contenitore_tipo: string | null
  valore: number | null
  capitale_investito: number
  // Fuori polizza il costo dei lotti, in polizza la quota dei premi residui.
  base_fiscale: number | null
}
type SaldoLiquidita = { strumento_id: string; contenitore_id: string | null; saldo_corrente: number }
type CostoRiga = { strumento_id: string; contenitore_id: string | null; costo_totale: number }
type StoricoTotale = {
  data: string | null
  valore_totale: number | null
  capitale_investito_totale: number | null
}
type RealizzatoAnno = { anno: number; realizzato_netto_totale: number }


export default async function DashboardPage() {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('Dashboard')
  const tCategorie = await getTranslations('Categorie')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()
  const annoCorrente = new Date().getFullYear()

  const [
    { data: totale },
    { data: posizioniRaw },
    { data: saldiLiquiditaRaw },
    { data: costoMercatoRaw },
    { data: costoLiquiditaRaw },
    { data: storicoRaw },
    { data: realizzatoAnnoRaw },
    { data: contenitori },
    { data: scostamenti },
    { data: impostazioni },
    { data: nonRealizzatoRaw },
  ] = await Promise.all([
    supabase.from('v_valore_totale_portafoglio').select('valore_totale').single(),
    supabase
      .from('v_riepilogo_posizione')
      .select('strumento_id, contenitore_id, valore, capitale_investito, quantita_posseduta, prezzo_medio_unitario')
      .returns<Posizione[]>(),
    supabase.from('v_saldo_liquidita').select('strumento_id, contenitore_id, saldo_corrente').returns<SaldoLiquidita[]>(),
    supabase.from('v_costo_per_strumento').select('strumento_id, contenitore_id, costo_totale').returns<CostoRiga[]>(),
    supabase.from('v_costo_liquidita').select('strumento_id, contenitore_id, costo_totale').returns<CostoRiga[]>(),
    // Una riga per giorno: letta a blocchi per non fermarsi a 1000 righe.
    tutteLeRighe((da, a) =>
      supabase
        .from('v_storico_valorizzazioni_totale')
        .select('data, valore_totale, capitale_investito_totale')
        .order('data', { ascending: true })
        .range(da, a)
        .returns<StoricoTotale[]>()
    ),
    supabase.from('v_realizzato_per_anno').select('anno, realizzato_netto_totale').eq('anno', annoCorrente).maybeSingle().returns<RealizzatoAnno>(),
    supabase.from('v_valore_per_contenitore').select('contenitore_id, tipo, nome, valore_totale').order('tipo'),
    supabase.from('v_scostamento_target').select('*'),
    supabase.from('impostazioni_utente').select('soglia_ribilanciamento_pp').maybeSingle(),
    supabase
      .from('v_non_realizzato_dettaglio')
      .select('strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito, base_fiscale')
      .returns<NonRealizzatoDettaglio[]>(),
  ])

  const posizioni = posizioniRaw ?? []
  const saldiLiquidita = saldiLiquiditaRaw ?? []
  const valoreTotalePortafoglio = totale?.valore_totale ?? 0

  const valoreTotaleMercato = posizioni.reduce((s, p) => s + (p.valore ?? 0), 0)
  const valoreTotaleLiquidita = saldiLiquidita.reduce((s, x) => s + Number(x.saldo_corrente ?? 0), 0)

  // Plus/minus e rendimento complessivo sulla stessa base: per le polizze i
  // premi residui del contratto (v_premi_residui_polizza), per il resto il
  // costo dei lotti. È base_fiscale di v_non_realizzato_dettaglio.
  const righeNonRealizzate = (nonRealizzatoRaw ?? []).filter((r) => r.valore != null)
  const valoreNonRealizzato = righeNonRealizzate.reduce((s, r) => s + Number(r.valore), 0)
  const baseTotale = righeNonRealizzate.reduce((s, r) => s + Number(r.base_fiscale ?? 0), 0)
  const plusMinusNonRealizzata = valoreNonRealizzato - baseTotale
  const rendimentoPctTotale = baseTotale > 0 ? (plusMinusNonRealizzata / baseTotale) * 100 : null

  // La variazione "Oggi" resta quella di sempre: rendimento sui lotti di oggi
  // contro l'ultima valorizzazione salvata, che è sui lotti.
  const capitaleInvestitoLordo = posizioni.reduce((s, p) => s + (p.capitale_investito ?? 0), 0)
  const rendimentoLottiPct =
    capitaleInvestitoLordo > 0 ? ((valoreTotaleMercato - capitaleInvestitoLordo) / capitaleInvestitoLordo) * 100 : null

  const capitaleInvestitoNetto = posizioni.reduce(
    (s, p) => s + (p.quantita_posseduta ?? 0) * (p.prezzo_medio_unitario ?? 0),
    0
  )

  const costoTotale =
    (costoMercatoRaw ?? []).reduce((s, c) => s + (c.costo_totale ?? 0), 0) +
    (costoLiquiditaRaw ?? []).reduce((s, c) => s + (c.costo_totale ?? 0), 0)

  const realizzatoNettoAnno = realizzatoAnnoRaw?.realizzato_netto_totale ?? 0

  const storicoValoreMap = new Map<string, number>()
  const storicoCapitaleMap = new Map<string, number>()
  for (const r of storicoRaw ?? []) {
    if (!r.data) continue
    storicoValoreMap.set(r.data, Number(r.valore_totale))
    if (r.capitale_investito_totale != null) {
      storicoCapitaleMap.set(r.data, Number(r.capitale_investito_totale))
    }
  }

  const puntiRendimento: PuntoStorico[] = Array.from(storicoValoreMap.entries())
    .map(([data, valore]) => {
      const capitale = storicoCapitaleMap.get(data)
      if (!capitale || capitale <= 0) return null
      return { data, valore: ((valore - capitale) / capitale) * 100 }
    })
    .filter((p): p is PuntoStorico => p !== null)
    .sort((a, b) => a.data.localeCompare(b.data))

  const rendimentoUltimoSnapshot =
    puntiRendimento.length > 0 ? puntiRendimento[puntiRendimento.length - 1].valore : null

  const variazioneDaUltimoSnapshot =
    rendimentoLottiPct != null && rendimentoUltimoSnapshot != null
      ? rendimentoLottiPct - rendimentoUltimoSnapshot
      : null

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const alert = (scostamenti ?? [])
    .filter((s) => Math.abs(s.scostamento_pp ?? 0) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp ?? 0) - Math.abs(a.scostamento_pp ?? 0))

  const valorePerCategoria = new Map<string, number>()
  for (const r of nonRealizzatoRaw ?? []) {
    if (r.valore == null) continue
    valorePerCategoria.set(r.categoria, (valorePerCategoria.get(r.categoria) ?? 0) + Number(r.valore))
  }
  // La liquidità non ha posizioni di mercato: il suo valore è la somma dei saldi.
  valorePerCategoria.set('Liquidita', valoreTotaleLiquidita)
  const fetteCategorie: FettaAnello[] = CATEGORIE.map((cat) => ({
    nome: cat,
    valore: valorePerCategoria.get(cat) ?? 0,
    nomeVisualizzato: traduciCategoria(tCategorie, cat),
  }))

  let valorePac = 0
  let valorePolizze = 0
  let valoreDiretto = 0
  for (const r of nonRealizzatoRaw ?? []) {
    if (r.valore == null) continue
    if (r.contenitore_tipo === 'PAC') valorePac += Number(r.valore)
    else if (r.contenitore_tipo === 'Polizza') valorePolizze += Number(r.valore)
    else if (r.contenitore_tipo == null) valoreDiretto += Number(r.valore)
  }
  const fetteContenitori: FettaAnello[] = [
    { nome: 'PAC', valore: valorePac, nomeVisualizzato: tContenitori('pac') },
    { nome: 'Polizze', valore: valorePolizze, nomeVisualizzato: tContenitori('polizze') },
    { nome: 'NessunGruppo', valore: valoreDiretto, nomeVisualizzato: tContenitori('nessunGruppo') },
  ]

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('etichettaDashboard')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titolo')}</h1>

      <section>
        <Sezione>
          <GraficoStorico punti={puntiRendimento} formato="percent" valoreAttuale={valoreTotalePortafoglio} />
        </Sezione>
      </section>

      <section style={{ marginTop: 24 }}>
        <Sezione>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardRendimento
              rendimentoPct={rendimentoPctTotale}
              variazioneOggi={variazioneDaUltimoSnapshot}
              label={t('titoloRendimentoLive')}
              etichettaOggi={t('etichettaOggi')}
              href="/rendimenti"
              linkLabel={t('linkRendimenti')}
            />

            <CardMetrica label={t('labelPlusMinusNonRealizzata')} href="/fiscalita" linkLabel={t('linkFiscalita')}>
              <span style={{ color: plusMinusNonRealizzata >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(plusMinusNonRealizzata, locale)}
              </span>
            </CardMetrica>

            <CardMetrica
              label={t('labelPlusMinusRealizzata', { anno: annoCorrente })}
              href="/fiscalita"
              linkLabel={t('linkFiscalita')}
            >
              <span style={{ color: realizzatoNettoAnno >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatEuroSigned(realizzatoNettoAnno, locale)}
              </span>
            </CardMetrica>

            <CardMetrica label={t('labelCostoTotale')} href="/costi" linkLabel={t('linkCosti')}>
              {formatEuro(costoTotale, locale)}
            </CardMetrica>

            <CardMetrica label={t('labelCapitaleInvestitoNetto')} href="/gestione/transazioni" linkLabel={t('linkTransazioni')}>
              {formatEuro(capitaleInvestitoNetto, locale)}
            </CardMetrica>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloAllocazioneAsset')}</h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', maxWidth: 480 }}>
            <Sezione>
              <GraficoAnello fette={fetteCategorie} />
            </Sezione>
          </div>
          <div style={{ flex: '2 1 380px' }}>
            <Sezione>
              <ElencoAllocazione fette={fetteCategorie} />
            </Sezione>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloAllocazioneContenitori')}</h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', maxWidth: 480 }}>
            <Sezione>
              <GraficoAnello fette={fetteContenitori} />
            </Sezione>
          </div>
          <div style={{ flex: '2 1 380px' }}>
            <Sezione>
              <ElencoAllocazione fette={fetteContenitori} />
            </Sezione>
          </div>
        </div>
      </section>

      <ValoriChiusura />

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>{t('titoloRibilanciamento')}</h2>
        <Sezione>
          {alert.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-table)', margin: 0 }}>
              {t('alertNessunoScostamento')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alert.map((a) => (
                <div key={`${a.contenitore_id}-${a.categoria}`} style={{ fontSize: 'var(--fs-table)', color: 'var(--text-primary)' }}>
                  <strong>{a.contenitore_nome}</strong> —{' '}
                  {t('alertScostamento', {
                    categoria: traduciCategoria(tCategorie, a.categoria ?? ''),
                    pesoAttuale: a.peso_attuale_pct ?? 0,
                    target: a.target_percentuale ?? 0,
                    segnoScostamento: a.scostamento_pp && a.scostamento_pp > 0 ? '+' : '',
                    scostamento: a.scostamento_pp ?? 0,
                  })}
                </div>
              ))}
            </div>
          )}
        </Sezione>
      </section>
    </div>
  )
}