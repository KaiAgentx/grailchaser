/**
 * Normalize a card name for matching.
 *
 * Rules (applied in order):
 * 1. Lowercase
 * 2. Unicode NFD decomposition
 * 3. Strip combining diacritical marks (accents)
 * 4. Replace any non-alphanumeric character with a single space
 * 5. Collapse multiple spaces into one
 * 6. Trim leading/trailing whitespace
 *
 * @example normalizeName("Pokémon  Card #25!") === "pokemon card 25"
 * @example normalizeName("Magic: The Gathering") === "magic the gathering"
 * @example normalizeName("Café Society") === "cafe society"
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]/g, " ")      // non-alphanumeric → space
    .replace(/\s+/g, " ")            // collapse spaces
    .trim();
}
