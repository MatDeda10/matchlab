/**
 * Orologio server-side isolato.
 * Evita chiamate impure direttamente nel corpo dei Server Components
 * (regola react-hooks/purity) e rende esplicito il punto in cui si legge l'ora.
 */
export function nowMs(): number {
  return Date.now();
}
