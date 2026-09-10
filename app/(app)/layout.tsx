import Link from 'next/link'
import { logout } from '@/app/login/actions'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #ddd',
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <strong>Investrick</strong>
          <Link href="/">Dashboard</Link>
          <Link href="/transazioni">Transazioni</Link>
        </div>
        <form action={logout}>
          <button type="submit">Esci</button>
        </form>
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  )
}