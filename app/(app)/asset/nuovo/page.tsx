import { createClient } from '@/lib/supabase/server'
import { FormNuovoAsset } from './form-nuovo-asset'

type TipoStrumento = { categoria: string; tipo: string }

export default async function NuovoAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; duplicato_id?: string; duplicato_nome?: string }>
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

  return (
    <div>
      <h1>Crea nuovo asset</h1>

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
    </div>
  )
}