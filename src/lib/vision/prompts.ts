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
const POKEMON_PROMPT = `Examine this Pokémon card image carefully.

Extract these fields. All small text is at the BOTTOM LEFT corner of the card:
1. name: The Pokémon or card name at the top (e.g. "Charizard", "M Charizard-EX", "Iono")
2. number: The card number (the numerator) at the BOTTOM LEFT (e.g. "4" from "4/102", "025" from "025/185", or "SWSH146")
3. number_confidence: "high" if all digits/characters are clearly visible, "medium" if partially obscured by glare or blur, "low" if you are guessing
4. set_total: The denominator from the card number at the BOTTOM LEFT. If you see "008/086", return 86. If only a single number with no slash, return null
5. rarity_symbol: The small rarity symbol at the BOTTOM LEFT, near the card number. Look for: "circle" (filled black ●), "diamond" (filled black ◆), "star" (filled black ★), "two_stars" (★★), "gold_star" (gold/yellow ★), "gold_two_stars" (gold ★★), "gold_three_stars" (gold ★★★). Return null if you can't see one clearly
6. set: The set name if visible anywhere on the card (set logo, set symbol text, copyright line). Examples: "Base Set", "Scarlet & Violet", "Stellar Crown". Return "unknown" if you can't identify
7. edition: Look for an oval "Edition 1" or "1st Edition" stamp near the bottom left of the artwork. Return "1st" or "unlimited"
8. finish: Examine the card surface:
   - "holo" if the artwork itself has a rainbow sparkle / holographic shine
   - "reverse_holo" if the border/background sparkles but the artwork itself is flat
   - "non_holo" if the entire card is flat with no sparkle
9. confidence: "high" if all text is clearly readable, "medium" if partial, "low" if unclear

Return ONLY valid JSON, no markdown:
{"name":"...","number":"...","number_confidence":"high|medium|low","set_total":86,"rarity_symbol":"circle|diamond|star|two_stars|gold_star|gold_two_stars|gold_three_stars|null","set":"...","edition":"1st|unlimited","finish":"holo|reverse_holo|non_holo","confidence":"high|medium|low"}

If not a Pokémon card or completely unreadable:
{"name":null,"number":null,"number_confidence":"low","set_total":null,"rarity_symbol":null,"set":null,"edition":"unlimited","finish":"holo","confidence":"low"}`;
