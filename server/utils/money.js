// Importes en centavos enteros: evitan los errores de redondeo de la coma flotante al sumar o multiplicar.
// Un importe de Motorix siempre tiene como máximo dos decimales, así que su valor en centavos es exacto.

export const toCents = (amount) => Math.round(Number(amount) * 100);

export const fromCents = (cents) => cents / 100;

// Suma una lista de importes ya expresados en centavos enteros.
export const sumCents = (values) => values.reduce((total, cents) => total + cents, 0);
