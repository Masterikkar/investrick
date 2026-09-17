import { createClient } from '@/lib/supabase/server'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { FormNuovoAsset } from './form-nuovo-asset'
import { creaContenitore } from './actions-contenitore'
import { ListaContenitori } from './lista-contenitori'

type TipoStrumento = { categoria: string; tipo: string }

const TIPI_CONTENITORE = [
  { value: 'PAC', label: 'PAC' },
  { value: 'Polizza', label: 'Polizza vita' },
  { value: 'Liquidita', label: 'Liquidità' },
]

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

export default async function GestioneStrumentiPage({
  searchParams,
}: {
  searchParams: Promise<{
    errore?: string
    duplicato_id?: string
    duplicato_nome?: string
    successo_contenitore?: string
    errore_contenitore?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: tipiRaw } = await supabase
    .from('tipi_strumento')
    .select('categoria, tipo')
    .order('categoria')
    .order('tipo')
    .returns<TipoStrumento[]>()

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome, tipo')
    .order('nome')

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Account</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16, fontWeight: 500 }}>Gestione strumenti</h1>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Nuovo asset</h2>
        <Sezione>
          {params.errore === 'duplicato' && params.duplicato_id && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--warning)',
                padding: 12,
                marginBottom: 16,
                color: 'var(--text-primary)',
                maxWidth: 420,
              }}
            >
              Esiste già uno strumento con questo ISIN:{' '}
              <strong>{decodeURIComponent(params.duplicato_nome ?? '')}</strong>.{' '}
              <RippleLink href={`/asset/${params.duplicato_id}`} className="link-interattivo">
                Vai alla sua scheda
              </RippleLink>{' '}
              invece di crearne uno nuovo.
            </div>
          )}
          {params.errore === '1' && (
            <p style={{ color: 'var(--danger)', marginBottom: 16 }}>
              Qualcosa è andato storto, controlla i campi e riprova.
            </p>
          )}

          <FormNuovoAsset tipiPerCategoria={tipiPerCategoria} />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Contenitori</h2>
        <Sezione>
          <ListaContenitori contenitori={contenitori ?? []} />

          <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 24, marginBottom: 12 }}>Aggiungi un nuovo contenitore</h3>

          {params.successo_contenitore === '1' && (
            <p style={{ color: 'var(--success)', marginBottom: 12 }}>Contenitore creato.</p>
          )}
          {params.errore_contenitore === '1' && (
            <p style={{ color: 'var(--danger)', marginBottom: 12 }}>
              Qualcosa è andato storto, controlla i campi e riprova.
            </p>
          )}

          <form
            action={creaContenitore}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, color: 'var(--text-primary)' }}
          >
            <label>
              Nome
              <input type="text" name="nome" required style={stileCampo} />
            </label>

            <label>
              Tipo
              <select name="tipo" required style={stileCampo}>
                <option value="">Seleziona...</option>
                {TIPI_CONTENITORE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Data di attivazione
              <input type="date" name="data_attivazione" style={stileCampo} />
              <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                Facoltativa, utile soprattutto per le polizze.
              </small>
            </label>

            <label>
              Note
              <textarea name="note" rows={3} style={stileCampo} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="target_attivo" defaultChecked style={{ accentColor: 'var(--primary)' }} />
              Target attivo
            </label>

            <button
              type="submit"
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Crea contenitore
            </button>
          </form>
        </Sezione>
      </section>
    </div>
  )
}