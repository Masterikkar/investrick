import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
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
} from '@/components/icone-menu'

const stilePannello: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 48px',
          borderBottom: '1px solid var(--border-default)',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
            <strong>Investrick</strong>
          </Link>
          <BarraRicerca strumenti={strumenti ?? []} contenitori={contenitori ?? []} />
        </div>

        <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <details style={{ position: 'relative' }}>
            <summary className="menu-toggle">
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
            <summary className="menu-toggle">
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
                  <RippleLink href="/transazioni/liquidita" className="menu-row link-interattivo">
                    Liquidità
                  </RippleLink>
                  <RippleLink href="/transazioni/asset" className="menu-row link-interattivo">
                    Transazioni
                  </RippleLink>
                </div>
              </details>
            </div>
          </details>

          <details style={{ position: 'relative' }}>
            <summary className="menu-toggle">
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
                    <IconaGestione /> Gestione
                  </span>
                  <span className="menu-chevron">
                    <IconaChevron />
                  </span>
                </summary>
                <div className="menu-submenu-items">
                  <RippleLink href="/asset/nuovo" className="menu-row link-interattivo">
                    Strumenti
                  </RippleLink>
                  <RippleLink href="/transazioni" className="menu-row link-interattivo">
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
      <main style={{ padding: '32px 48px' }}>{children}</main>
    </div>
  )
}