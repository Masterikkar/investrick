import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { ChiudiTendineAutomaticamente } from '@/components/chiudi-tendine-automaticamente'
import { BarraRicerca } from '@/components/barra-ricerca'

const OFFSET_TENDINA = 'calc(100% + 17px)' // = padding verticale header (16px) + bordo (1px)

const stilePannello: React.CSSProperties = {
  position: 'absolute',
  top: OFFSET_TENDINA,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 160,
  zIndex: 10,
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase
      .from('strumenti')
      .select('id, nome, categoria, ticker')
      .neq('categoria', 'Liquidita')
      .order('nome'),
    supabase.from('contenitori').select('id, nome, tipo').order('nome'),
  ])

  return (
    <div>
      <ChiudiTendineAutomaticamente />
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #ddd',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong>Investrick</strong>
          </Link>
          <BarraRicerca strumenti={strumenti ?? []} contenitori={contenitori ?? []} />
        </div>

        <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/liquidita">Liquidità</Link>
          <Link href="/pac">PAC</Link>
          <Link href="/polizze">Polizze</Link>
          <details style={{ position: 'relative' }}>
            <summary style={{ cursor: 'pointer' }}>Categorie</summary>
            <div style={{ ...stilePannello, left: 0 }}>
              <Link href="/azioni">Azioni</Link>
              <Link href="/obbligazioni">Obbligazioni</Link>
              <Link href="/materie-prime">Materie prime</Link>
              <Link href="/crypto">Crypto</Link>
              <Link href="/multiasset">Multiasset</Link>
            </div>
          </details>
        </nav>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <details style={{ position: 'relative' }}>
            <summary style={{ cursor: 'pointer' }}>Altro</summary>
            <div style={{ ...stilePannello, right: 0 }}>
              <Link href="/costi">Costi</Link>
              <Link href="/fiscalita">Fiscalità</Link>
              <Link href="/ribilanciamento">Ribilanciamento</Link>
              <Link href="/transazioni">Transazioni</Link>
              <Link href="/asset/nuovo">Crea nuovo asset</Link>
            </div>
          </details>
          <form action={logout}>
            <button type="submit">Esci</button>
          </form>
        </div>
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  )
}