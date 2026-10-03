import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatData, formatPercent, type LocaleFormato } from '@/lib/format'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'

type RigaChiusura = {
  strumentoId: string
  nome: string
  variazionePct: number
}

type VariazioneRiga = {
  strumento_id: string | null
  data: string | null
  variazione_pct: number | null
}

const NUM_COLONNE = 4
const ALTEZZA_RIGA = 32

function suddividiInColonneFisse<T>(elementi: T[], numColonne: number): T[][] {
  const perColonna = Math.max(1, Math.ceil(elementi.length / numColonne))
  const colonne: T[][] = []
  for (let i = 0; i < numColonne; i++) {
    colonne.push(elementi.slice(i * perColonna, (i + 1) * perColonna))
  }
  return colonne
}

function BloccoMovimenti({
  titolo,
  righe,
  messaggioVuoto,
  locale,
}: {
  titolo: string
  righe: RigaChiusura[]
  messaggioVuoto: string
  locale: LocaleFormato
}) {
  const colonne = suddividiInColonneFisse(righe, NUM_COLONNE)

  return (
    <Sezione>
      <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)', marginBottom: 12 }}>
        {titolo}
      </div>
      {righe.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{messaggioVuoto}</p>
      ) : (
        <>
          <style>{`
            .blocco-movimenti-container { container-type: inline-size; }
            .blocco-movimenti-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 20px;
            }
            @container (max-width: 900px) {
              .blocco-movimenti-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @container (max-width: 420px) {
              .blocco-movimenti-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <div className="blocco-movimenti-container">
            <div className="blocco-movimenti-grid">
              {colonne.map((colonna, ci) => (
                <div key={ci}>
                  {colonna.map((r, ri) => (
                    <div
                      key={r.strumentoId}
                      style={{
                        height: ALTEZZA_RIGA,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        borderBottom: ri < colonna.length - 1 ? '1px solid var(--border-default)' : 'none',
                      }}
                    >
                      <RippleLink
                        href={`/asset/${r.strumentoId}`}
                        className="link-interattivo"
                        style={{
                          fontSize: 'var(--fs-table)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                        }}
                      >
                        {r.nome}
                      </RippleLink>
                      <span
                        style={{
                          fontSize: 'var(--fs-table)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          color: r.variazionePct >= 0 ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {formatPercent(r.variazionePct, 2, true, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Sezione>
  )
}

export async function ValoriChiusura() {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('ValoriChiusura')
  const supabase = await createClient()

  const { data: posizioniRaw } = await supabase
    .from('v_riepilogo_posizione')
    .select('strumento_id, quantita_posseduta')

  const idsPosseduti = Array.from(
    new Set(
      (posizioniRaw ?? [])
        .filter((p) => Number(p.quantita_posseduta) > 0)
        .map((p) => p.strumento_id)
        .filter((id): id is string => id !== null)
    )
  )

  if (idsPosseduti.length === 0) {
    return null
  }

  const risultati = await Promise.all(
    idsPosseduti.map(async (id) => {
      const { data } = await supabase
        .from('v_variazione_giornaliera')
        .select('strumento_id, data, variazione_pct')
        .eq('strumento_id', id)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as VariazioneRiga | null
    })
  )

  const righeValide = risultati.filter(
    (r): r is { strumento_id: string; data: string; variazione_pct: number } =>
      r !== null &&
      r.strumento_id !== null &&
      r.data !== null &&
      r.variazione_pct !== null &&
      Number(r.variazione_pct) !== 0
  )

  if (righeValide.length === 0) {
    return null
  }

  const dataRiferimento = righeValide.reduce((max, r) => (r.data > max ? r.data : max), righeValide[0].data)

  const { data: strumentiRaw } = await supabase
    .from('strumenti')
    .select('id, nome')
    .in('id', righeValide.map((r) => r.strumento_id))

  const nomeMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.nome]))

  const righe: RigaChiusura[] = righeValide.map((r) => ({
    strumentoId: r.strumento_id,
    nome: nomeMap.get(r.strumento_id) ?? '—',
    variazionePct: Number(r.variazione_pct),
  }))

  const rialzi = righe.filter((r) => r.variazionePct > 0).sort((a, b) => b.variazionePct - a.variazionePct)
  const ribassi = righe.filter((r) => r.variazionePct < 0).sort((a, b) => a.variazionePct - b.variazionePct)

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>
        {t('titolo')}{' '}
        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
          — {formatData(dataRiferimento, locale)}
        </span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <BloccoMovimenti titolo={t('titoloRialzi')} righe={rialzi} messaggioVuoto={t('alertNessunRialzo')} locale={locale} />
        <BloccoMovimenti titolo={t('titoloRibassi')} righe={ribassi} messaggioVuoto={t('alertNessunRibasso')} locale={locale} />
      </div>
    </section>
  )
}