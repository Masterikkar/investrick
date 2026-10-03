import { getTranslations } from 'next-intl/server'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  const params = await searchParams
  const mostraErrore = params.errore === '1'
  const t = await getTranslations('Login')

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1>{t('titolo')}</h1>
      {mostraErrore && <p style={{ color: 'red' }}>{t('erroreCredenziali')}</p>}
      <form action={login}>
        <div>
          <label htmlFor="email">{t('labelEmail')}</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div>
          <label htmlFor="password">{t('labelPassword')}</label>
          <input id="password" name="password" type="password" required />
        </div>
        <button type="submit">{t('bottoneAccedi')}</button>
      </form>
    </div>
  )
}