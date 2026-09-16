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
          <style>{`
            .submenu-asset > summary {
              list-style: none;
              cursor: pointer;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .submenu-asset > summary::-webkit-details-marker { display: none; }
            .submenu-asset > summary::after {
              content: '⌄';
              margin-left: 12px;
              transition: transform 0.15s ease;
            }
            .submenu-asset[open] > summary::after {
              transform: rotate(180deg);
            }
          `}</style>
          <details style={{ position: 'relative' }}>
            <summary style={{ cursor: 'pointer' }}>Portafoglio</summary>
            <div style={{ ...stilePannello, right: 0 }}>
              <Link href="/pac">Piani di Accumulo</Link>
              <Link href="/polizze">Polizze</Link>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: 0 }} />
              <details className="submenu-asset">
                <summary>Asset</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 12 }}>
                  <Link href="/azioni">Azioni</Link>
                  <Link href="/obbligazioni">Obbligazioni</Link>
                  <Link href="/materie-prime">Materie prime</Link>
                  <Link href="/monetario">Monetario</Link>
                  <Link href="/multiasset">Multiasset</Link>
                  <Link href="/crypto">Crypto</Link>
                </div>
              </details>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: 0 }} />
              <Link href="/liquidita">Liquidità</Link>
            </div>
          </details>
          <details style={{ position: 'relative' }}>
            <summary style={{ cursor: 'pointer' }}>Analisi</summary>
            <div style={{ ...stilePannello, right: 0 }}>
              <Link href="/costi">Costi</Link>
              <Link href="/fiscalita">Fiscalità</Link>
              <Link href="/rendimenti">Rendimenti</Link>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: 0 }} />
              <Link href="/ribilanciamento">Ribilanciamento</Link>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: 0 }} />
              <details className="submenu-asset">
                <summary>Storico</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 12 }}>
                  <Link href="/transazioni/liquidita">Liquidità</Link>
                  <Link href="/transazioni/asset">Transazioni</Link>
                </div>
              </details>
            </div>
          </details>
          <details style={{ position: 'relative' }}>
            <summary style={{ cursor: 'pointer' }}>Account</summary>
            <div style={{ ...stilePannello, right: 0 }}>
              <details className="submenu-asset">
                <summary>Gestione</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 12 }}>
                  <Link href="/asset/nuovo">Strumenti</Link>
                  <Link href="/transazioni">Transazioni</Link>
                </div>
              </details>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: 0 }} />
              <form action={logout}>
                <button type="submit">Esci</button>
              </form>
            </div>
          </details>
        </nav>
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  )
}