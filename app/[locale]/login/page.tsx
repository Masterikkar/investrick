import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  const params = await searchParams
  const mostraErrore = params.errore === '1'

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1>Accedi a Investrick</h1>
      {mostraErrore && <p style={{ color: 'red' }}>Email o password non corrette.</p>}
      <form action={login}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />
        </div>
        <button type="submit">Accedi</button>
      </form>
    </div>
  )
}