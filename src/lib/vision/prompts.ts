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

// POKÉMON: Step-by-step extraction with visual location map.
// Leverages Sonnet 4.6's better spec compliance for structured prompts.
const POKEMON_PROMPT = `You are analyzing a Pokémon trading card. Extract structured data by following these steps in order.

═══════════════════════════════════════════════════════
STEP 1 — UNDERSTAND THE CARD LAYOUT
═══════════════════════════════════════════════════════

A Pokémon card has 6 zones you need to recognize:

┌─────────────────────────────────────────────────────────┐
│  [Zone A: Pokémon name]              [Zone B: HP value] │  ← TOP
│                                                         │
│  [Zone C: Artwork / Illustration]                       │  ← MIDDLE
│                                                         │
│  [Zone D: Attacks and game text]                        │
│                                                         │
│  [Zone E: Illustrator,              [Zone F: Copyright] │  ← BOTTOM
│   card number,                                          │
│   set code,                                             │
│   rarity symbol]                                        │
└─────────────────────────────────────────────────────────┘

IMPORTANT LOCATION RULES:
- Zone A (name) is at TOP, center/left
- Zone B (HP) is at TOP, RIGHT side, shows "HP 100" or similar in large bold text
- Zone E (card number cluster) is at BOTTOM-LEFT in small text
- Zone F (copyright) is at BOTTOM-CENTER or BOTTOM-RIGHT

═══════════════════════════════════════════════════════
STEP 2 — EXTRACT FIELDS IN THIS EXACT PRIORITY ORDER
═══════════════════════════════════════════════════════

Priority 1: Read Zone A (TOP). Extract the Pokémon name.
  → Field: "name"
  → Examples: "Charizard", "Zeraora", "Maractus", "Landorus", "Iono"
  → If you see "V", "VMAX", "ex", "VSTAR" after the name, include it (e.g., "Zeraora VMAX")

Priority 2: Read Zone E (BOTTOM-LEFT ONLY). Find the card number.
  → The card number cluster contains 4-5 stacked items in small text:
    - Illustrator credit ("Illus. NAME")
    - Rotation marker (a small "1" or similar)
    - Set abbreviation (2-4 uppercase letters, e.g., "BLK EN", "DRI EN", "ME03 EN")
    - Card number in format "N/TOTAL" (e.g., "008/086", "078/182", "041/088")
    - Rarity symbol (●, ◆, ★, ★★, gold ★)
  → Field: "number" = ONLY the numerator (e.g., "008", "78", "41")
  → Field: "set_total" = the denominator (integer, e.g., 86, 182, 88)

CRITICAL: The HP value in Zone B (TOP-RIGHT) is NOT the card number.
If you see a large bold number in the TOP-RIGHT corner (like "HP 120" or just "120"),
that is HP — do not use it as the card number. The card number is ALWAYS at BOTTOM-LEFT.

If you cannot confidently read the BOTTOM-LEFT card number:
  - Set "number" to null
  - Set "number_confidence" to "low"
  - Set "set_total" to null
  - DO NOT substitute the HP value from Zone B.

Priority 3: Read the rarity symbol in Zone E (BOTTOM-LEFT).
  → Field: "rarity_symbol"
  → Options: "circle" (●), "diamond" (◆), "star" (★), "two_stars" (★★),
    "gold_star" (gold ★), "gold_two_stars" (gold ★★), "gold_three_stars" (gold ★★★)
  → If unclear, return null

Priority 4: Read the set name if visible.
  → Look for a set logo (stylized artwork) somewhere on the card, or text in the
    copyright line at the bottom
  → Field: "set"
  → Examples: "Base Set", "Scarlet & Violet", "Black Bolt", "Destined Rivals"
  → Return "unknown" if you can't identify the specific set (do NOT guess)

Priority 5: Read surface finish.
  → Field: "finish"
  → "holo" = the artwork/illustration itself has a holographic shine or rainbow sparkle
  → "reverse_holo" = the artwork is flat, but the border/background AROUND the artwork sparkles
  → "non_holo" = entirely flat, no sparkle anywhere

Priority 6: Look for 1st Edition stamp.
  → Field: "edition"
  → "1st" if you see an oval "Edition 1" or "1st Edition" stamp near the artwork
  → "unlimited" otherwise

═══════════════════════════════════════════════════════
STEP 3 — ASSESS CONFIDENCE
═══════════════════════════════════════════════════════

Priority 7: Report confidence scores.
  → Field: "number_confidence"
    - "high" if you clearly read the N/TOTAL format in BOTTOM-LEFT
    - "medium" if partially visible (glare/blur obscures some digits)
    - "low" if you cannot find the bottom-left card number at all
  → Field: "confidence" (overall)
    - "high" if name, number, set_total, rarity_symbol all read clearly
    - "medium" if some fields are uncertain
    - "low" if major fields unreadable

═══════════════════════════════════════════════════════
STEP 4 — OUTPUT
═══════════════════════════════════════════════════════

Return ONLY valid JSON. No markdown, no code fences, no explanation.

Schema:
{
  "name": string | null,
  "number": string | null,
  "number_confidence": "high" | "medium" | "low",
  "set_total": integer | null,
  "rarity_symbol": "circle" | "diamond" | "star" | "two_stars" | "gold_star" | "gold_two_stars" | "gold_three_stars" | null,
  "set": string | null,
  "edition": "1st" | "unlimited",
  "finish": "holo" | "reverse_holo" | "non_holo",
  "confidence": "high" | "medium" | "low"
}

If the image is not a Pokémon card OR you cannot extract any fields:
{"name":null,"number":null,"number_confidence":"low","set_total":null,"rarity_symbol":null,"set":null,"edition":"unlimited","finish":"holo","confidence":"low"}`;
