/**
 * Game-aware vision prompt factory.
 * Each game has unique card layouts (number position, rarity symbol, etc.)
 * so prompts must be tailored per game.
 */

export type SupportedGame = "pokemon" | "mtg" | "one_piece";

export function getVisionPrompt(game: SupportedGame): string {
  switch (game) {
    case "pokemon": return POKEMON_PROMPT;
    case "mtg": throw new Error("MTG vision prompt not yet implemented");
    case "one_piece": throw new Error("One Piece vision prompt not yet implemented");
  }
}

// POKÉMON: number/set_total/rarity all bottom-left, fraction format
// HP/card-number disambiguation is critical — see CRITICAL DISTINCTION block
const POKEMON_PROMPT = `Examine this Pokémon card image carefully.

CRITICAL DISTINCTION: Pokémon cards have TWO numbers that look similar.
Do NOT confuse them:

- **HP (IGNORE THIS)**: Located at TOP-RIGHT of the card, next to the
  Pokémon name. Format: "HP 120" or just "120" in large bold text.
  HP is typically a round number like 60, 70, 80, 100, 110, 120, 130,
  150, 180, 210, 280, 320. Do NOT return HP as the card number.

- **Card number (EXTRACT THIS)**: Located at BOTTOM-LEFT of the card,
  small text. Format: "N/TOTAL" like "078/182", "041/088", "008/086".
  Always appears with a slash separating numerator and denominator
  (unless it's a promo with a letter code like "SWSH146").

Extract these fields:

1. name: The Pokémon or card name at the top of the card
2. number: ONLY the numerator from the BOTTOM-LEFT card number
   (e.g., "78" from "078/182", "41" from "041/088").
   This is NEVER the HP value from top-right.
3. number_confidence: "high" if you clearly see the bottom-left N/TOTAL
   format, "medium" if partially obscured, "low" if you cannot find
   the bottom-left card number
4. set_total: The denominator from the bottom-left card number.
   From "078/182" return 182. From "041/088" return 88.
   Return null if no slash-format number visible.
5. rarity_symbol: Small symbol at BOTTOM-LEFT near the card number.
   "circle" (black ●), "diamond" (black ◆), "star" (black ★),
   "two_stars" (★★), "gold_star" (gold ★), "gold_two_stars" (gold ★★),
   "gold_three_stars" (gold ★★★). Return null if unclear.
6. set: Set name if visible (logo, set symbol, copyright line).
   Return "unknown" if you can't identify.
7. edition: "1st" if you see an "Edition 1" / "1st Edition" stamp,
   else "unlimited"
8. finish: "holo" (artwork sparkles), "reverse_holo" (border sparkles
   but not artwork), or "non_holo" (flat)
9. confidence: "high" if all fields readable, "medium" if partial,
   "low" if unclear

If you cannot confidently find the BOTTOM-LEFT card number: set number
to null and number_confidence to "low". Do not substitute the HP value.

Return ONLY valid JSON, no markdown:
{"name":"...","number":"...","number_confidence":"high|medium|low","set_total":86,"rarity_symbol":"circle|diamond|star|two_stars|gold_star|gold_two_stars|gold_three_stars|null","set":"...","edition":"1st|unlimited","finish":"holo|reverse_holo|non_holo","confidence":"high|medium|low"}

If not a Pokémon card or completely unreadable:
{"name":null,"number":null,"number_confidence":"low","set_total":null,"rarity_symbol":null,"set":null,"edition":"unlimited","finish":"holo","confidence":"low"}`;
