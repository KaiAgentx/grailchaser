# Recognition Benchmark Dataset

## Folder Structure

```
benchmarks/
├── manifest.json
├── README.md
└── images/
    ├── pokemon/
    │   └── charizard-base-set-4.jpg
    ├── mtg/
    │   └── black-lotus-alpha.jpg
    └── one_piece/
        └── luffy-op01-001.jpg
```

## Target Counts

- **Pokémon**: 100 images
- **Magic: The Gathering**: 100 images
- **One Piece**: 50 images

## Image Requirements

- Well-lit, single card centered in frame
- JPG or PNG format
- 600×800px or larger
- No sleeves, toploaders, or heavy reflections preferred
- Mix of holos, reverses, full arts, and standard cards

## manifest.json Format

```json
{
  "version": "1",
  "items": [
    {
      "imagePath": "pokemon/charizard-base-set-4.jpg",
      "expectedCanonicalCardId": "base1-4",
      "game": "pokemon"
    },
    {
      "imagePath": "mtg/black-lotus-alpha.jpg",
      "expectedCanonicalCardId": "lea-233",
      "game": "mtg"
    },
    {
      "imagePath": "one_piece/luffy-op01-001.jpg",
      "expectedCanonicalCardId": "OP01-001",
      "game": "one_piece"
    }
  ]
}
```

### Card ID Conventions

- **Pokémon**: `{set_id}-{number}` from pokemontcg.io (e.g., `base1-4`)
- **MTG**: `{set_code}-{collector_number}` from Scryfall (e.g., `lea-233`)
- **One Piece**: `{set_id}-{number}` (e.g., `OP01-001`)

## Running the Benchmark

```bash
npm run benchmark
```

**Note**: Until Phase 1B catalog sync populates `catalog_hashes` in Supabase,
the benchmark can only test preprocessing and hashing speed, not matching accuracy.
