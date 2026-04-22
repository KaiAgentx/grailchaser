# GrailChaser — Session D2a Query Audit

**Date:** 2026-04-22
**Scope:** Game-sensitive queries on non-rewritten screens (home dashboards, cards list, boxes, market selector, shared hooks/utilities)
**Methodology:** Grep all `.from(<table>)` and `.rpc()` sites in `src/`; classify each by whether it should filter by `game` (cards) or `mode` (boxes); trace context to consuming screens. Out-of-scope files (scan flow, save flow, card detail, card edit, batch upload, webhooks) excluded per session brief.

## Summary

| Classification | Count |
|---|---|
| ALREADY_SCOPED | 3 |
| NOT_GAME_SENSITIVE | 22 |
| MISSING_FILTER_TCG_CONTEXT | 0 |
| MISSING_FILTER_SPORTS_CONTEXT | 0 |
| MISSING_FILTER_SPECIFIC_GAME | 0 |
| AMBIGUOUS | 3 |
| **Total queries audited (in scope)** | **28** |

The three AMBIGUOUS findings are the **central concern of this audit** — see "Recommendations" below.

---

## Findings — by classification

### ALREADY_SCOPED (3 queries)

#### Finding A1
- **File:** `src/app/page.tsx:79`
- **Query:** `supabase.from("cards").select("id, raw_value", { count: "exact" }).eq("user_id", user.id).eq("game", activeGame)`
- **Context:** TCG Home — collection card-count stat. `activeGame` is one of `pokemon` / `mtg` / `one_piece` set via the active-game pills.
- **Notes:** Correct game-specific filtering for the TCG-home pill experience.

#### Finding A2
- **File:** `src/app/page.tsx:80`
- **Query:** `supabase.from("cards").select("id, player, set, card_number, raw_value, scan_image_url, created_at").eq("user_id", user.id).eq("game", activeGame).order("created_at", { ascending: false }).limit(5)`
- **Context:** TCG Home — "Recently Added" thumbnails. Same `activeGame` scoping.

#### Finding A3
- **File:** `src/app/page.tsx:81`
- **Query:** `supabase.from("scan_results").select("id, catalog_match_name, final_catalog_name, created_at").eq("user_id", user.id).eq("game", activeGame).order("created_at", { ascending: false }).limit(5)`
- **Context:** TCG Home — "Recent Activity" feed. `scan_results` has its own `game game_t NOT NULL` column (`20260410120000_create_scan_results.sql:6`); filter is applied directly, no derivation needed.

---

### NOT_GAME_SENSITIVE (22 queries)

These mutate or fetch by primary key / lot_id / box name and don't need a game filter for correctness.

#### Mutations on `cards` by `id` (12 queries)
| File:Line | Pattern |
|---|---|
| `src/hooks/useCards.ts:113` | `.update(updates).eq("id", id)` — generic single-card update |
| `src/hooks/useCards.ts:119` | `.delete().eq("id", id)` |
| `src/hooks/useCards.ts:125` | `.delete().in("id", ids)` |
| `src/hooks/useCards.ts:171` | `.update(updates).in("id", ids)` |
| `src/hooks/useCards.ts:215` | `.update({ storage_position: newPos }).eq("id", boxCards[i].id)` |
| `src/hooks/useListings.ts:21,43,60,81,108` | platform-listing updates by card `id` |
| `src/hooks/useListings.ts:94,98` | mercari/facebook flag flips by card `id` |
| `src/hooks/useCards.ts:104` | sports-only batch insert via CSV import — `inserts` already include `game: "sports"` (or default) per `useCards.ts:84` payload |

#### `lots` table CRUD + cross-references (9 queries)
| File:Line | Pattern |
|---|---|
| `src/hooks/useLots.ts:46` | `.from("lots").insert(...)` — new lot |
| `src/hooks/useLots.ts:61` | `.from("lots").update(updates).eq("id", id)` |
| `src/hooks/useLots.ts:71` | `.from("lots").delete().eq("id", id)` |
| `src/hooks/useLots.ts:54` | `.from("cards").update({ lot_id }).eq("id", cid)` — tagging cards into a new lot |
| `src/hooks/useLots.ts:70` | `.from("cards").update({ lot_id: null }).eq("lot_id", id)` — clearing a deleted lot |
| `src/hooks/useLots.ts:86,97` | `.from("cards").select("id").eq("lot_id", id)` — gathering a lot's members |
| `src/hooks/useLots.ts:89,100` | per-card sold/shipped updates by `id` |

#### Singleton / cron / position helpers (1 query)
- `src/lib/boxPosition.ts:20`: `.from("cards").select("storage_position").eq("user_id", userId).eq("storage_box", boxName)` — server-authoritative MAX(position)+1 lookup. Box names are user-scoped and there's no cross-game collision in practice (the auto-created box names are game-suffixed via `DEFAULT_BOX_NAME`).

> **Note (NOT a finding to fix):** The two cron-style server endpoints `src/app/api/alerts/check/route.ts:14` and `src/app/api/prices/snapshot/route.ts:27` query `cards` without a game filter, but they are **intentionally** all-cards: alerts apply to whatever the user has watchlisted regardless of game; the price-snapshot job records every unsold card. These were excluded from the count above per "intentional system-wide scope".

---

### AMBIGUOUS (3 queries — the BUG-001 root architecture decision)

These three queries are the central question of this audit. None of them is "wrong" in isolation — they are shared hooks intended to feed both Sports and TCG screens — but every consumer that doesn't add its own filter is leaking the other mode's data.

#### Finding M1 — `useCards.ts:15` `fetchCards`
- **File:** `src/hooks/useCards.ts:14-19`
- **Query:**
  ```ts
  let query = supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  ```
- **Context:** Called once at the top of `<Home>` (`src/app/page.tsx:38`). Its `cards` array is then passed/destructured into:
  - **Sports Dashboard** (`Dashboard.tsx`) — `cards.filter(c => !c.sold)` with **no game filter**. Pulls ALL games' cards into Sports KPIs.
  - **TCG Home** — uses its own scoped queries (`page.tsx:79-81`), does NOT consume the shared array for stats. ✅
  - **My Cards** (`page.tsx:171-176`) — derives `ecosystemCards` via `cards.filter(isTcgCard)` / `cards.filter(c => !isTcgCard(c))`. ✅ Filters client-side.
  - **StorageView** — receives all cards, filters client-side via `isTcgCard`. ✅
  - **GradeCheck / GradingReturn / SmartPull / PickList / LotBuilder** — no game filter at all (sports-only flows; pre-existing finding from earlier audit).
- **Why AMBIGUOUS:** the query is intentionally mode-blind because it's a shared hook. The architectural call is whether to push the filter into the hook (single point of correctness, requires a mode parameter and may break sports-only screens) or fix each downstream consumer.
- **Risk level:** HIGH — directly causes BUG-001's Sports Dashboard symptom.

#### Finding M2 — `useBoxes.ts:41` `fetchBoxes`
- **File:** `src/hooks/useBoxes.ts:40-44`
- **Query:**
  ```ts
  const { data, error } = await supabase
    .from("boxes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  ```
- **Context:** Called at the top of `<Home>` (`page.tsx:40`). Returns ALL boxes for the user. Consumers:
  - `StorageView.tsx:49` — `boxes.filter(b => b.mode === "tcg")` / `b.mode !== "tcg"` (client-side).
  - `CardDetail.tsx:49` — `boxes.filter(b => b.mode === cardMode)` (client-side).
  - `TcgCardDetail.tsx:60` — same client-side filter pattern.
  - `page.tsx:126` (TCG-home auto-create guard) — `boxes.some(b => b.mode === "tcg")`.
- **Why AMBIGUOUS:** Same structural issue as M1 but with the discriminator being the `mode` text column on `boxes` instead of `game`. Filtering happens 4 times across 3 components, slightly differently each time. Fragile.
- **Risk level:** MEDIUM — does not produce visibly-wrong data today (consumers do filter), but every new screen has to re-implement the filter, and any miss leaks across modes.

#### Finding M3 — `useLots.ts:34` `fetchLots`
- **File:** `src/hooks/useLots.ts:34`
- **Query:** `supabase.from("lots").select("*").eq("user_id", userId).order("created_at", { ascending: false })`
- **Context:** Called at `page.tsx:41`. `lots` is consumed by `LotBuilder` and `Dashboard`. **The `lots` table has no `game` column** (confirmed: no migration creates the table — out-of-band like `cards`/`boxes` — and the TS `Lot` interface in `useLots.ts:5-24` has no `game` field).
- **Why AMBIGUOUS:** Filtering by game requires either (a) inferring game from a lot's member cards (joined via `cards.lot_id = lots.id`), or (b) adding a `game` column to `lots` and backfilling. Option (b) is the cleaner long-term fix; option (a) is more code per query. Either way this is NOT a one-line `.eq("game", X)` like M1/M2.
- **Risk level:** LOW — Lots are currently a sports-only feature in practice (the `LotBuilder.tsx` UI assumes sports — `generateTitle` reads `c.sport` directly). TCG users won't see leaked lots until TCG lots are introduced.

---

## Recommendations (ordered by priority for fix session)

1. **Single-point fix opportunity at the hook layer for `fetchCards` and `fetchBoxes`.** If the next session adds a mode/game parameter to `useCards(userId, mode?)` and `useBoxes(userId, mode?)`, every consumer downstream becomes correct without each having to reimplement filtering. **This is the highest-leverage intervention** for BUG-001 and likely closes the Sports Dashboard leak with a single edit pattern. **Fixing M1 and M2 may cascade correctness across most TCG/Sports dashboards.** Estimate: 30-60 min including consumer-call updates.

2. **Standardize the boxes-by-mode pattern.** Currently `b.mode === "tcg"` is checked in 4 places (`StorageView.tsx:49`, `CardDetail.tsx:49`, `TcgCardDetail.tsx:60`, `page.tsx:126`) with slightly different idioms. Either push `mode` into `useBoxes` as a parameter (recommended) OR extract `useTcgBoxes()` / `useSportsBoxes()` helpers. Without standardization, every new screen has to remember to filter and any miss is silent.

3. **`lots` table needs a schema decision.** It has no `game` column. Two paths:
   - **(a) Add column + backfill.** Adds one migration; backfill SQL would `UPDATE lots SET game = (SELECT MAX(game) FROM cards WHERE lot_id = lots.id)` (or similar). Simple per-query filter afterward.
   - **(b) Compute via join in `fetchLots`.** No schema change but every fetch is heavier and doesn't compose well with future RLS-by-game.
   
   Recommend (a) as part of the larger Phase 1 schema-cleanup work. Defer the actual fix to whichever session owns lots-mode separation.

4. **No MISSING_FILTER_*_CONTEXT findings** in scope. The fix-session estimate is therefore not "20 individual queries × 5 min" but rather **2-3 focused architectural changes** (hook signatures + consumer call sites) plus 1 schema migration for lots. Estimate total: **45-90 minutes** for the architectural fixes; the schema migration is a separate ~15 min item.

5. **Review M3 with Chris before touching.** The Lots-game association decision affects how Phase 1 handles cross-mode collection separation generally.

---

## Notes & Observations

### 1. Hook-layer single-point fix opportunity (per session brief)
`useCards.ts:15` and `useBoxes.ts:41` are unfiltered fetches that feed every downstream screen. Most TCG screens guard themselves correctly via client-side filtering (`isTcgCard(c)`, `b.mode === "tcg"`), but **the Sports Dashboard does not** — hence the visible symptom of BUG-001. Pushing the filter into the hook (as a `mode` parameter or via two parallel hooks) would close the leak in one place and remove the burden from every consumer to remember to filter. **For next session's scope estimate: budget the work as architectural (hook signature change + ~5-7 call site updates) rather than per-query.**

### 2. Client-side filter pattern is fragile
The current pattern is `boxes.filter(b => b.mode === "tcg")` repeated in `StorageView.tsx:49`, `CardDetail.tsx:49`, `TcgCardDetail.tsx:60`, plus `boxes.some(b => b.mode === "tcg")` in `page.tsx:126`. Same logic, four implementations, four chances to drift. Recommended cleanups (in order of preference):
- (a) `useBoxes(userId, mode?: "tcg" | "sports")` returns pre-filtered. Single source of truth.
- (b) `useTcgBoxes(userId)` / `useSportsBoxes(userId)` thin wrappers.
- (c) Centralize the predicate into `lib/games.ts` so all client-side filters use the same function.

(a) is preferred because it also reduces network payload — currently the user's full box list is shipped to every screen, then 90% discarded.

### 3. `lots` table has no `game` column
Confirmed by:
- Grep across `supabase/migrations/` for any `CREATE TABLE.*lots` statement → **no matches** (table created out-of-band).
- Reviewing the `Lot` TypeScript interface in `src/hooks/useLots.ts:5-24` → no `game` field.

This means **lot queries cannot filter by game with a simple `.eq("game", X)`**. Options:
- (a) Add `game game_t` column to `lots`, backfill from member cards' modal game, then update queries with `.eq("game", X)`.
- (b) Filter lots client-side by joining to a known game-tagged member card (heavier, brittle).
- (c) Defer — TCG lots are not a current product surface (LotBuilder is sports-only by UI design).

Whichever fix chooses needs to be aware: `useLots` is not a one-line filter add like `useCards` and `useBoxes`.

---

## Out-of-scope items noted but not classified

For your records, these were excluded from the count per the session brief but do contain `cards`-table queries:

| File | Why excluded |
|---|---|
| `src/app/api/tcg/recognize/route.ts` (multiple `catalog_cards` queries) | Scan flow — being rewritten |
| `src/app/api/tcg/collection-items/route.ts` (RPC) | Save flow — being rewritten |
| `src/app/api/tcg/scan-results/[id]/correct/route.ts` | Scan correction flow |
| `src/app/api/tcg/search/route.ts` (`catalog_cards`) | Search/lookup; tied to scan flow |
| `src/app/api/tcg/price/route.ts` (`catalog_cards`) | Price-fetch path; consumed by TCG card detail (also being rewritten) |
| `src/lib/scanTelemetry.ts` (`scan_sessions`, `scan_results`) | Telemetry for scan flow |
| `src/components/TcgScanScreen.tsx:32` (`scan_sessions`) | Scan UI |
| `src/lib/recognition/cache.ts:149` (`catalog_cards`) | Recognition cache |
| `src/app/api/seed-test/route.ts` | Test data seeding |
| `src/app/api/webhooks/{ebay,shopify}-sold/route.ts` | Webhook handlers; fetch by card `id` only |

---

**End of audit.**
