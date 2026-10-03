import type { User } from '@supabase/supabase-js'

// I dati personali stanno nei metadati dell'utente di Supabase Auth
// (user_metadata): nessuna tabella dedicata. Questo file è l'unico punto che
// conosce i nomi delle chiavi e come si ricavano le iniziali.
export type Profilo = {
  nome: string
  cognome: string
  dataNascita: string // YYYY-MM-DD oppure vuota
  // Il comune si sceglie dall'elenco ISTAT (tabella comuni): citta, provincia e
  // regione derivano da lui. Tutti vuoti se non è stato scelto.
  codiceIstat: string
  citta: string
  provincia: string
  regione: string
}

export const LUNGHEZZA_MASSIMA_CAMPO_PROFILO = 100
export const LUNGHEZZA_MINIMA_PASSWORD = 8

function testo(valore: unknown): string {
  return typeof valore === 'string' ? valore : ''
}

export function profiloDaUtente(utente: User | null): Profilo {
  const metadati = utente?.user_metadata ?? {}
  return {
    nome: testo(metadati.nome),
    cognome: testo(metadati.cognome),
    dataNascita: testo(metadati.data_nascita),
    codiceIstat: testo(metadati.comune_istat),
    citta: testo(metadati.citta),
    provincia: testo(metadati.provincia),
    regione: testo(metadati.regione),
  }
}

// Chiavi con cui il profilo viene scritto nei metadati.
export function metadatiDaProfilo(profilo: Profilo): Record<string, string> {
  return {
    nome: profilo.nome,
    cognome: profilo.cognome,
    data_nascita: profilo.dataNascita,
    comune_istat: profilo.codiceIstat,
    citta: profilo.citta,
    provincia: profilo.provincia,
    regione: profilo.regione,
  }
}

// Iniziali di nome e cognome (fino a due lettere); stringa vuota se mancano.
export function inizialiProfilo(profilo: Pick<Profilo, 'nome' | 'cognome'>): string {
  const prima = (s: string) => Array.from(s.trim())[0]?.toLocaleUpperCase() ?? ''
  return prima(profilo.nome) + prima(profilo.cognome)
}
