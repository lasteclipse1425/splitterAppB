export function optimizeDebts(balances: Record<string, number>): Array<{ from: string; to: string; amount: number }> {
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance < -0.01) {
      debtors.push({ id, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ id, amount: balance });
    }
  }

  // Sort descending by amount to minimize number of transactions
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: Array<{ from: string; to: string; amount: number }> = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    // Guard for noUncheckedIndexedAccess
    if (!debtor || !creditor) break;

    const amount = Math.min(debtor.amount, creditor.amount);

    // Round to 2 decimals to avoid floating point errors
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0) {
      transactions.push({
        from: debtor.id,
        to: creditor.id,
        amount: roundedAmount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) {
      d++;
    }
    if (creditor.amount < 0.01) {
      c++;
    }
  }

  return transactions;
}
