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

// POKÉMON: Tight JSON-only prompt for Sonnet 4. No ASCII diagrams or step headings
// (those cause Sonnet 4 to narrate instead of returning JSON).
const POKEMON_PROMPT = `Analyze this Pokémon card image. Return ONLY a JSON object. No preamble, no explanation, no analysis, no narration. Just JSON.

CRITICAL HP vs CARD NUMBER DISTINCTION:
- HP is at TOP-RIGHT of the card in LARGE BOLD text (e.g., "HP 120"). HP is typically 60, 70, 80, 100, 110, 120, 130, 150, 180, 210. This is NOT the card number. IGNORE HP.
- Card number is at BOTTOM-LEFT in small text in format "N/TOTAL" (e.g., "078/182", "041/088", "008/086"). Extract this.

Required fields:

name: Pokémon or card name from TOP of card (e.g., "Charizard", "Zeraora VMAX", "Maractus")

number: Numerator of BOTTOM-LEFT card number only (e.g., "78" from "078/182", "41" from "041/088"). NEVER the HP value. If you cannot clearly see the bottom-left card number, set to null. Do NOT guess. Do NOT substitute HP.

number_confidence: "high" (clearly visible) / "medium" (partial/blurry) / "low" (cannot find bottom-left number)

set_total: Denominator from bottom-left (e.g., 182 from "078/182", 88 from "041/088"). Integer. null if no slash-format visible.

rarity_symbol: Small symbol at BOTTOM-LEFT near card number. One of: "circle" (●), "diamond" (◆), "star" (★), "two_stars" (★★), "gold_star" (gold ★), "gold_two_stars" (gold ★★), "gold_three_stars" (gold ★★★), or null.

set: Set name if visible on card logo/symbol/copyright. "unknown" if you cannot identify. Do NOT guess.

edition: "1st" if "1st Edition" stamp visible, else "unlimited"

finish: "holo" (artwork sparkles), "reverse_holo" (border sparkles but artwork flat), "non_holo" (flat)

confidence: overall "high" / "medium" / "low"

OUTPUT FORMAT (return exactly this shape, nothing else):
{"name":"...","number":"...","number_confidence":"high","set_total":86,"rarity_symbol":"circle","set":"...","edition":"unlimited","finish":"holo","confidence":"high"}

If image is not a Pokémon card or completely unreadable:
{"name":null,"number":null,"number_confidence":"low","set_total":null,"rarity_symbol":null,"set":null,"edition":"unlimited","finish":"holo","confidence":"low"}

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;
