import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/[locale]/login/actions'
import { ChiudiTendineAutomaticamente } from '@/components/chiudi-tendine-automaticamente'
import { BarraRicerca } from '@/components/barra-ricerca'
import { RippleLink } from '@/components/ripple-link'
import {
  IconaChevron,
  IconaPortafoglio,
  IconaAnalisi,
  IconaAccount,
  IconaAsset,
  IconaLiquidita,
  IconaPac,
  IconaPolizze,
  IconaCosti,
  IconaFiscalita,
  IconaRendimenti,
  IconaRibilanciamento,
  IconaStorico,
  IconaGestione,
  IconaEsci,
} from '@/components/icone'

// top: 100% = bordo inferiore reale dell'header. +1px bordo header, +5px distacco richiesto.
const stilePannello: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
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
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg-base)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          padding: '0 48px',
          borderBottom: '1px solid var(--border-default)',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
            <strong>Investrick</strong>
          </Link>
          <BarraRicerca strumenti={strumenti ?? []} contenitori={contenitori ?? []} />
        </div>

        <nav style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          <details style={{ position: 'relative' }}>
            <summary className="menu-toggle menu-toggle-bar">
              <IconaPortafoglio />
              Portafoglio
              <span className="menu-chevron">
                <IconaChevron />
              </span>
            </summary>
            <div className="menu-panel" style={stilePannello}>
              <details>
                <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                  <span className="menu-row-left">
                    <IconaAsset /> Asset
                  </span>
                  <span className="menu-chevron">
                    <IconaChevron />
                  </span>
                </summary>
                <div className="menu-submenu-items">
                  <RippleLink href="/azioni" className="menu-row link-interattivo">
                    Azioni
                  </RippleLink>
                  <RippleLink href="/obbligazioni" className="menu-row link-interattivo">
                    Obbligazioni
                  </RippleLink>
                  <RippleLink href="/materie-prime" className="menu-row link-interattivo">
                    Materie prime
                  </RippleLink>
                  <RippleLink href="/monetario" className="menu-row link-interattivo">
                    Monetario
                  </RippleLink>
                  <RippleLink href="/multiasset" className="menu-row link-interattivo">
                    Multiasset
                  </RippleLink>
                  <RippleLink href="/crypto" className="menu-row link-interattivo">
                    Crypto
                  </RippleLink>
                </div>
              </details>
              <RippleLink
                href="/liquidita"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaLiquidita /> Liquidità
              </RippleLink>
              <RippleLink
                href="/pac"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaPac /> Piani di Accumulo
              </RippleLink>
              <RippleLink
                href="/polizze"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaPolizze /> Polizze
              </RippleLink>
            </div>
          </details>

          <details style={{ position: 'relative' }}>
            <summary className="menu-toggle menu-toggle-bar">
              <IconaAnalisi />
              Analisi
              <span className="menu-chevron">
                <IconaChevron />
              </span>
            </summary>
            <div className="menu-panel" style={stilePannello}>
              <RippleLink
                href="/costi"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaCosti /> Costi
              </RippleLink>
              <RippleLink
                href="/fiscalita"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaFiscalita /> Fiscalità
              </RippleLink>
              <RippleLink
                href="/rendimenti"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaRendimenti /> Rendimenti
              </RippleLink>
              <hr className="menu-divider" />
              <RippleLink
                href="/ribilanciamento"
                className="menu-row link-interattivo"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
              >
                <IconaRibilanciamento /> Ribilanciamento
              </RippleLink>
              <hr className="menu-divider" />
              <details>
                <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                  <span className="menu-row-left">
                    <IconaStorico /> Storico
                  </span>
                  <span className="menu-chevron">
                    <IconaChevron />
                  </span>
                </summary>
                <div className="menu-submenu-items">
                  <RippleLink href="/storico/liquidita" className="menu-row link-interattivo">
                    Transazioni liquidità
                  </RippleLink>
                  <RippleLink href="/storico/asset" className="menu-row link-interattivo">
                    Transazioni finanziarie
                  </RippleLink>
                </div>
              </details>
            </div>
          </details>

          <details style={{ position: 'relative' }}>
            <summary className="menu-toggle menu-toggle-bar">
              <IconaAccount />
              Account
              <span className="menu-chevron">
                <IconaChevron />
              </span>
            </summary>
            <div className="menu-panel" style={stilePannello}>
              <details>
                <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                  <span className="menu-row-left">
                    <IconaGestione /> Gestione database
                  </span>
                  <span className="menu-chevron">
                    <IconaChevron />
                  </span>
                </summary>
                <div className="menu-submenu-items">
                  <RippleLink href="/gestione/fiscalita" className="menu-row link-interattivo">
                    Fiscalità
                  </RippleLink>
                  <RippleLink href="/gestione/strumenti" className="menu-row link-interattivo">
                    Strumenti
                  </RippleLink>
                  <RippleLink href="/gestione/transazioni" className="menu-row link-interattivo">
                    Transazioni
                  </RippleLink>
                </div>
              </details>
              <hr className="menu-divider" />
              <form action={logout}>
                <button
                  type="submit"
                  className="menu-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <IconaEsci /> Esci
                </button>
              </form>
            </div>
          </details>
        </nav>
      </header>
      <main style={{ padding: '32px 48px' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}