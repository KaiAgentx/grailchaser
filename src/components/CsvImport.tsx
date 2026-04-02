"use client";
import { useState, useRef } from "react";
import Papa from "papaparse";
import { NewCard } from "@/lib/types";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, muted, text, font, mono } from "./styles";

const columnMap: Record<string, keyof NewCard> = {};
const aliases: [RegExp, keyof NewCard][] = [
  [/^(player|name|card.?name)$/i, "player"],
  [/^(sport)$/i, "sport"],
  [/^(year)$/i, "year"],
  [/^(brand|manufacturer)$/i, "brand"],
  [/^(set|release)$/i, "set"],
  [/^(parallel|variant)$/i, "parallel"],
  [/^(card.?number|number|#|num)$/i, "card_number"],
  [/^(value|price|raw.?value|raw)$/i, "raw_value"],
  [/^(cost|paid|cost.?basis)$/i, "cost_basis"],
  [/^(rc|rookie)$/i, "is_rc"],
  [/^(auto|autograph)$/i, "is_auto"],
  [/^(condition|cond)$/i, "condition"],
  [/^(box|storage|storage.?box)$/i, "storage_box"],
  [/^(notes|note|comments)$/i, "notes"],
  [/^(team)$/i, "team"],
  [/^(numbered|numbered.?to|serial)$/i, "numbered_to"],
];

function mapHeader(header: string): keyof NewCard | null {
  const h = header.trim();
  for (const [re, field] of aliases) {
    if (re.test(h)) return field;
  }
  return null;
}

function isTruthy(val: string): boolean {
  return ["yes", "true", "1", "x", "y"].includes(val.trim().toLowerCase());
}

interface Props {
  onBack: () => void;
  addCards: (cards: Partial<NewCard>[]) => Promise<{ data: any; error: any }>;
}

export function CsvImport({ onBack, addCards }: Props) {
  const [screen, setScreen] = useState<"pick" | "preview" | "importing" | "done">("pick");
  const [rows, setRows] = useState<Partial<NewCard>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<(keyof NewCard | null)[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [parseError, setParseError] = useState("");
  const [importResult, setImportResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setParseError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          console.log("CSV parse errors:", result.errors);
        }

        const csvHeaders = result.meta.fields || [];
        const mapped = csvHeaders.map(h => mapHeader(h));
        setHeaders(csvHeaders);
        setMappedFields(mapped);

        let skipCount = 0;
        const parsed: Partial<NewCard>[] = [];

        for (const row of result.data as Record<string, string>[]) {
          const card: any = {};
          let hasPlayer = false;

          for (let i = 0; i < csvHeaders.length; i++) {
            const field = mapped[i];
            if (!field) continue;
            const val = (row[csvHeaders[i]] || "").trim();
            if (!val) continue;

            switch (field) {
              case "player":
                card.player = val;
                hasPlayer = true;
                break;
              case "year":
                card.year = parseInt(val) || new Date().getFullYear();
                break;
              case "raw_value":
                card.raw_value = parseFloat(val.replace(/[$,]/g, "")) || 0;
                break;
              case "cost_basis":
                card.cost_basis = parseFloat(val.replace(/[$,]/g, "")) || 0;
                break;
              case "numbered_to":
                card.numbered_to = parseInt(val) || null;
                card.is_numbered = true;
                break;
              case "is_rc":
                card.is_rc = isTruthy(val);
                break;
              case "is_auto":
                card.is_auto = isTruthy(val);
                break;
              default:
                card[field] = val;
            }
          }

          if (hasPlayer) {
            parsed.push(card);
          } else {
            skipCount++;
          }
        }

        setRows(parsed);
        setSkipped(skipCount);

        if (parsed.length === 0) {
          setParseError("No valid rows found. Make sure the CSV has a 'player' or 'name' column.");
        } else {
          setScreen("preview");
        }
      },
      error: (err) => {
        setParseError("Failed to parse CSV: " + err.message);
      },
    });
  };

  const handleImport = async () => {
    setScreen("importing");
    const batchSize = 50;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await addCards(batch);
      if (error) {
        console.error("Import batch error:", error);
        failed += batch.length;
      } else {
        success += batch.length;
      }
    }

    setImportResult({ success, failed });
    setScreen("done");
  };

  // File picker screen
  if (screen === "pick") return (
    <Shell title="Import CSV" back={onBack}>
      <div style={{ paddingTop: 24 }}>
        <input type="file" accept=".csv" ref={fileRef} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "40px 20px", background: "linear-gradient(135deg, " + surface + ", " + surface2 + ")", border: "2px dashed " + border, borderRadius: 16, cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: text }}>Choose CSV File</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>Supports any spreadsheet exported as CSV</div>
        </button>

        {parseError && <div style={{ background: red + "10", border: "1px solid " + red + "30", borderRadius: 10, padding: "10px 14px", marginTop: 16, fontSize: 12, color: red }}>{parseError}</div>}

        <div style={{ background: surface, borderRadius: 14, padding: 16, marginTop: 24 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Supported columns</div>
          {[
            ["player / name", "Required"],
            ["year, brand, set, parallel", "Card info"],
            ["card number / #", "Card number"],
            ["value / raw value", "Market value"],
            ["cost / paid", "Purchase price"],
            ["rc / rookie", "yes/true/1"],
            ["auto / autograph", "yes/true/1"],
            ["condition", "Mint, NM, EX..."],
            ["box / storage", "Storage location"],
            ["notes", "Free text"],
          ].map(([col, desc]) => (
            <div key={col} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + border }}>
              <span style={{ fontSize: 12, color: cyan, fontFamily: mono }}>{col}</span>
              <span style={{ fontSize: 11, color: muted }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );

  // Preview screen
  if (screen === "preview") {
    const previewRows = rows.slice(0, 10);
    const displayFields: (keyof NewCard)[] = ["player", "year", "brand", "set", "raw_value", "cost_basis"];

    return (
      <Shell title="Preview Import" back={() => setScreen("pick")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: green }}>{rows.length}</div>
              <div style={{ fontSize: 12, color: muted }}>cards ready to import</div>
            </div>
            {skipped > 0 && <div style={{ fontSize: 12, color: accent }}>{skipped} rows skipped (no player name)</div>}
          </div>

          {/* Column mapping */}
          <div style={{ background: surface, borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Column mapping</div>
            {headers.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid " + border }}>
                <span style={{ fontSize: 11, color: text }}>{h}</span>
                <span style={{ fontSize: 11, color: mappedFields[i] ? green : muted, fontFamily: mono }}>{mappedFields[i] || "—"}</span>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Preview (first {previewRows.length})</div>
            {previewRows.map((row, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? surface : surface2, borderRadius: 8, padding: "8px 10px", marginBottom: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{row.player || "?"}</div>
                <div style={{ fontSize: 11, color: muted }}>
                  {[row.year, row.brand, row.set, row.parallel !== "Base" ? row.parallel : ""].filter(Boolean).join(" · ")}
                  {row.raw_value ? ` · $${row.raw_value}` : ""}
                  {row.cost_basis ? ` · paid $${row.cost_basis}` : ""}
                  {row.is_rc ? " · RC" : ""}
                  {row.storage_box ? ` · ${row.storage_box}` : ""}
                </div>
              </div>
            ))}
            {rows.length > 10 && <div style={{ fontSize: 11, color: muted, textAlign: "center", marginTop: 6 }}>...and {rows.length - 10} more</div>}
          </div>

          <button onClick={handleImport} style={{ width: "100%", padding: "16px", minHeight: 52, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 17, fontWeight: 700, cursor: "pointer" }}>Import {rows.length} Cards</button>
        </div>
      </Shell>
    );
  }

  // Importing screen
  if (screen === "importing") return (
    <Shell title="Importing...">
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid " + border, borderTopColor: green, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: text }}>Importing {rows.length} cards...</div>
        <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>This may take a moment</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Shell>
  );

  // Done screen
  if (screen === "done") return (
    <Shell title="Import Complete">
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{importResult.failed === 0 ? "✓" : "⚠"}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: importResult.failed === 0 ? green : accent, marginBottom: 8 }}>
          {importResult.success} cards imported
        </div>
        {importResult.failed > 0 && <div style={{ fontSize: 14, color: red, marginBottom: 16 }}>{importResult.failed} cards failed</div>}
        <button onClick={onBack} style={{ padding: "14px 32px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Done</button>
      </div>
    </Shell>
  );

  return null;
}
