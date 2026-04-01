export async function fetchPrices(player: string, year: number, set: string, cardNumber: string, sport: string) {
  try {
    const res = await fetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player, year, set, card_number: cardNumber, sport }),
    });
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}
