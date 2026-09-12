import { createClient } from '@/lib/supabase/server'
import { FormNuovoAsset } from './form-nuovo-asset'
import { creaContenitore } from './actions-contenitore'
import { ListaContenitori } from './lista-contenitori'

type TipoStrumento = { categoria: string; tipo: string }

const TIPI_CONTENITORE = [
  { value: 'PAC', label: 'PAC' },
  { value: 'Polizza', label: 'Polizza vita' },
  { value: 'Liquidita', label: 'Liquidità' },
]

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
      <h1>Gestione strumenti</h1>

      <h2 style={{ fontSize: 18, marginTop: 24, marginBottom: 12 }}>Nuovo asset</h2>

      {params.errore === 'duplicato' && params.duplicato_id && (
        <p style={{ color: '#92400e', background: '#fef3c7', padding: 12, borderRadius: 6, marginTop: 16 }}>
          Esiste già uno strumento con questo ISIN: <strong>{decodeURIComponent(params.duplicato_nome ?? '')}</strong>.{' '}
          <a href={`/asset/${params.duplicato_id}`}>Vai alla sua scheda</a> invece di crearne uno nuovo.
        </p>
      )}
      {params.errore === '1' && (
        <p style={{ color: 'red', marginTop: 16 }}>Qualcosa è andato storto, controlla i campi e riprova.</p>
      )}

      <div style={{ marginTop: 16 }}>
        <FormNuovoAsset tipiPerCategoria={tipiPerCategoria} />
      </div>

      <hr style={{ margin: '32px 0' }} />

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Contenitori</h2>

      <ListaContenitori contenitori={contenitori ?? []} />

      <h3 style={{ fontSize: 15, marginTop: 24, marginBottom: 12 }}>Aggiungi un nuovo contenitore</h3>

      {params.successo_contenitore === '1' && <p style={{ color: 'green' }}>Contenitore creato.</p>}
      {params.errore_contenitore === '1' && (
        <p style={{ color: 'red' }}>Qualcosa è andato storto, controlla i campi e riprova.</p>
      )}

      <form
        action={creaContenitore}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, marginTop: 16 }}
      >
        <label>
          Nome
          <input type="text" name="nome" required style={{ width: '100%' }} />
        </label>

        <label>
          Tipo
          <select name="tipo" required style={{ width: '100%' }}>
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
          <input type="date" name="data_attivazione" style={{ width: '100%' }} />
          <small style={{ color: '#666' }}>Facoltativa, utile soprattutto per le polizze.</small>
        </label>

        <label>
          Note
          <textarea name="note" rows={3} style={{ width: '100%' }} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" name="target_attivo" defaultChecked />
          Target attivo
        </label>

        <button type="submit">Crea contenitore</button>
      </form>
    </div>
  )
}