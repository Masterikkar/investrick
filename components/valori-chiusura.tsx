import { createClient } from '@/lib/supabase/server'
import { formatPercent } from '@/lib/format'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { stileCardMetrica } from '@/components/card-metrica'

type RigaChiusura = {
  strumentoId: string
  nome: string
  variazionePct: number
}

export async function ValoriChiusura() {
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

  // Tutte le righe di variazione per gli strumenti posseduti, ordinate dalla
  // più recente. Niente filtro su una singola data condivisa: obbligazioni
  // e fondi aggiornano il NAV con cadenza diversa dagli ETF, quindi ognuno
  // può avere una propria "ultima chiusura" su un giorno diverso.
  const { data: variazioniRaw } = await supabase
    .from('v_variazione_giornaliera')
    .select('strumento_id, data, variazione_pct')
    .in('strumento_id', idsPosseduti)
    .order('data', { ascending: false })

  // Per ciascuno strumento tiene solo la riga più recente con un valore
  // valido (la prima volta che compare in questo elenco, dato l'ordine
  // decrescente); se la riga più recente ha variazione_pct nullo (es. primo
  // dato mai registrato), passa a quella immediatamente precedente.
  const ultimaVariazionePerStrumento = new Map<string, number>()
  for (const v of variazioniRaw ?? []) {
    if (!v.strumento_id) continue
    if (ultimaVariazionePerStrumento.has(v.strumento_id)) continue
    if (v.variazione_pct == null) continue
    ultimaVariazionePerStrumento.set(v.strumento_id, Number(v.variazione_pct))
  }

  if (ultimaVariazionePerStrumento.size === 0) {
    return null
  }

  const { data: strumentiRaw } = await supabase
    .from('strumenti')
    .select('id, nome')
    .in('id', Array.from(ultimaVariazionePerStrumento.keys()))

  const nomeMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.nome]))

  const righe: RigaChiusura[] = Array.from(ultimaVariazionePerStrumento.entries()).map(
    ([strumentoId, variazionePct]) => ({
      strumentoId,
      nome: nomeMap.get(strumentoId) ?? '—',
      variazionePct,
    })
  )

  const chiSale = righe
    .filter((r) => r.variazionePct >= 0)
    .sort((a, b) => b.variazionePct - a.variazionePct)
    .slice(0, 5)

  const chiScende = righe
    .filter((r) => r.variazionePct < 0)
    .sort((a, b) => a.variazionePct - b.variazionePct)
    .slice(0, 5)

  const movimenti = [...chiSale, ...chiScende].sort((a, b) => b.variazionePct - a.variazionePct)

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>Valori di chiusura</h2>
      <Sezione>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {movimenti.map((r) => (
            <div key={r.strumentoId} style={{ ...stileCardMetrica, minWidth: 180 }}>
              <RippleLink
                href={`/asset/${r.strumentoId}`}
                className="link-interattivo"
                style={{ fontSize: 'var(--fs-card-label)', display: 'block' }}
              >
                {r.nome}
              </RippleLink>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 'var(--fs-card-value)',
                  fontWeight: 500,
                  color: r.variazionePct >= 0 ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {formatPercent(r.variazionePct, 2, true)}
              </div>
            </div>
          ))}
        </div>
      </Sezione>
    </section>
  )
}