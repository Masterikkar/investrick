import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { Sezione } from '@/components/sezione'
import { RippleLink } from '@/components/ripple-link'
import { SogliaRibilanciamento } from '@/components/soglia-ribilanciamento'
import { SimulatorePortafoglio } from './simulatore-portafoglio'
import { SimulatoreGruppo } from './simulatore-gruppo'
import { leggiUltimeSimulazioniPortafoglio } from './actions-simulazione'
import { leggiSogliaRibilanciamento, type Scostamento, type ScostamentoPortafoglio } from '@/lib/ribilanciamento-simulazione'
import { traduciCategoria } from '@/lib/i18n-categorie'

export default async function RibilanciamentoPage() {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaRibilanciamento')
  const tMenu = await getTranslations('Menu')
  const tContenitori = await getTranslations('Contenitori')
  const tCategorie = await getTranslations('Categorie')
  const tPaginaCosti = await getTranslations('PaginaCosti')
  const tPaginaContenitore = await getTranslations('PaginaContenitore')
  const supabase = await createClient()

  const [{ data: scostamenti }, { data: scostamentiPortafoglio }, { data: contenitori }, soglia, storicoPortafoglio] =
    await Promise.all([
      supabase.from('v_scostamento_target').select('*').returns<Scostamento[]>(),
      supabase
        .from('v_scostamento_target_portafoglio')
        .select('target_id, categoria, target_percentuale, peso_attuale_pct, scostamento_pp')
        .returns<ScostamentoPortafoglio[]>(),
      supabase.from('contenitori').select('id, nome, tipo'),
      leggiSogliaRibilanciamento(supabase),
      leggiUltimeSimulazioniPortafoglio(),
    ])

  const fuoriSoglia = (scostamenti ?? [])
    .filter((s) => Math.abs(s.scostamento_pp) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp) - Math.abs(a.scostamento_pp))

  const fuoriSogliaPortafoglio = (scostamentiPortafoglio ?? [])
    .filter((s) => Math.abs(s.scostamento_pp) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp) - Math.abs(a.scostamento_pp))

  // I gruppi Personalizzati compaiono negli scostamenti ma non si simulano:
  // non contengono posizioni proprie da comprare o vendere.
  const scostamentiSimulabili = (scostamenti ?? []).filter((s) => s.contenitore_tipo !== 'Personalizzato')
  const contenitoriMap = new Map<string, string>()
  for (const s of scostamentiSimulabili) contenitoriMap.set(s.contenitore_id, s.contenitore_nome)
  const contenitoriDisponibili = Array.from(contenitoriMap.entries())

  const pacDisponibili = (contenitori ?? []).filter((c) => c.tipo === 'PAC').map((c) => ({ id: c.id, nome: c.nome }))
  const polizzeDisponibili = (contenitori ?? []).filter((c) => c.tipo === 'Polizza').map((c) => ({ id: c.id, nome: c.nome }))

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('tool')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('ribilanciamento')}</h1>
      <SogliaRibilanciamento sogliaIniziale={soglia} />

      {/* Portafoglio e gruppi in due sezioni separate: i pesi si misurano su
          totali diversi (l'intero portafoglio contro il singolo gruppo), quindi
          gli scostamenti non si confrontano tra loro in un unico ordinamento. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, margin: 0 }}>{tMenu('portafoglio')}</h2>
        <RippleLink href="/target/portfolio" className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
          {tPaginaContenitore('linkModificaTarget')}
        </RippleLink>
      </div>

      {(scostamentiPortafoglio ?? []).length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', margin: 0, color: 'var(--text-secondary)' }}>{t('alertNessunTargetPortafoglio')}</p>
      ) : fuoriSogliaPortafoglio.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', margin: 0, color: 'var(--text-secondary)' }}>{t('alertPortafoglioInLinea')}</p>
      ) : (
        <Sezione>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAsset')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTarget')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAttuale')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaScostamento')}</th>
              </tr>
            </thead>
            <tbody>
              {fuoriSogliaPortafoglio.map((s) => {
                const sovrappeso = s.scostamento_pp > 0
                return (
                  <tr key={s.target_id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, s.categoria)}</td>
                    <td style={{ padding: 8 }}>{formatPercent(s.target_percentuale, 2, false, locale)}</td>
                    <td style={{ padding: 8 }}>{formatPercent(s.peso_attuale_pct, 2, false, locale)}</td>
                    <td style={{ padding: 8, color: sovrappeso ? 'var(--warning)' : 'var(--primary-vivid)', fontWeight: 500 }}>
                      {formatNumero(s.scostamento_pp, 2, true, locale)} pp ({sovrappeso ? t('sovrappeso') : t('sottopeso')})
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Sezione>
      )}

      {(scostamentiPortafoglio ?? []).length > 0 && (
        <>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>{t('titoloSimulazione')}</h3>
          <SimulatorePortafoglio
            pacDisponibili={pacDisponibili}
            polizzeDisponibili={polizzeDisponibili}
            storicoIniziale={storicoPortafoglio}
          />
        </>
      )}

      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 40, marginBottom: 12 }}>{tMenu('gruppi')}</h2>

      {fuoriSoglia.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', margin: 0, color: 'var(--text-secondary)' }}>{t('alertNessunoScostamentoSoglia')}</p>
      ) : (
        <div>
          <Sezione>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tContenitori('colonnaNome')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCosti('colonnaCategoria')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTarget')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAttuale')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaScostamento')}</th>
                </tr>
              </thead>
              <tbody>
                {fuoriSoglia.map((s) => {
                  const sovrappeso = s.scostamento_pp > 0
                  return (
                    <tr key={s.target_id} className="tabella-riga">
                      <td style={{ padding: 8 }}>{s.contenitore_nome}</td>
                      <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, s.categoria)}</td>
                      <td style={{ padding: 8 }}>{formatPercent(s.target_percentuale, 2, false, locale)}</td>
                      <td style={{ padding: 8 }}>{formatPercent(s.peso_attuale_pct, 2, false, locale)}</td>
                      <td style={{ padding: 8, color: sovrappeso ? 'var(--warning)' : 'var(--primary-vivid)', fontWeight: 500 }}>
                        {formatNumero(s.scostamento_pp, 2, true, locale)} pp ({sovrappeso ? t('sovrappeso') : t('sottopeso')})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Sezione>
        </div>
      )}

      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 40, marginBottom: 12 }}>{t('titoloSimulazione')}</h2>

      <SimulatoreGruppo contenitoriDisponibili={contenitoriDisponibili} />
    </div>
  )
}
