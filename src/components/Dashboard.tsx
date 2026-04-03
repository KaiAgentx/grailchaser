"use client";
import { Card } from "@/lib/types";
import { Box, BOX_TYPE_LABELS, BoxType } from "@/hooks/useBoxes";
import { Lot } from "@/hooks/useLots";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, amber, muted, secondary, text, font, mono, sportColors } from "./styles";

type NavTarget = { screen: string; filter?: string; card?: Card; box?: Box };

interface Props {
  cards: Card[];
  boxes: Box[];
  lots: Lot[];
  userEmail: string;
  onNavigate: (target: NavTarget) => void;
  onSignOut: () => void;
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

const typeColors: Record<string, string> = { scanned: cyan, singles: text, sell: green, slabs_sell: green, slabs_pc: purple, pc: purple, grade_check: amber, sorted: text };

export function Dashboard({ cards, boxes, lots, userEmail, onNavigate, onSignOut }: Props) {
  const unsold = cards.filter(c => !c.sold);
  const totalValue = unsold.reduce((s, c) => s + (c.raw_value || 0), 0);

  // Stats
  const listed = cards.filter(c => c.status === "listed");
  const grading = cards.filter(c => c.status === "grading");
  const needShipping = cards.filter(c => c.status === "sold" && !c.shipped_date);
  const shipped = cards.filter(c => c.status === "shipped");

  // Action items
  const unassigned = cards.filter(c => !c.storage_box || c.storage_box === "PENDING");
  const staleListings = listed.filter(c => c.listed_date && daysSince(c.listed_date) > 14);
  const gradeCheckBoxNames = boxes.filter(b => b.box_type === "grade_check" && !b.name.startsWith("AT ")).map(b => b.name);
  const toInspect = cards.filter(c => gradeCheckBoxNames.includes(c.storage_box));

  const hasActions = needShipping.length > 0 || unassigned.length > 0 || staleListings.length > 0 || grading.length > 0 || toInspect.length > 0;

  // Recent & top
  const recent = [...cards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const topValue = [...unsold].sort((a, b) => b.raw_value - a.raw_value).slice(0, 5);

  const stats = [
    { label: "Listed", count: listed.length, color: cyan, filter: "listed" },
    { label: "Grading", count: grading.length, color: purple, filter: "grading" },
    { label: "To Ship", count: needShipping.length, color: amber, filter: "sold" },
    { label: "Shipped", count: shipped.length, color: green, filter: "shipped" },
  ];

  const quickActions = [
    { icon: "S", label: "Scan", screen: "scanToCollection", color: green },
    { icon: "?", label: "Check", screen: "cardCheck", color: cyan },
    { icon: "+", label: "Add", screen: "addCard", color: accent },
    { icon: "^", label: "Import", screen: "csvImport", color: secondary },
    { icon: "#", label: "Boxes", screen: "storage", color: purple },
    { icon: "=", label: "Cards", screen: "myCards", color: secondary },
  ];

  return (
    <Shell title="GrailChaser" brandTitle>
      <div style={{ paddingTop: 20 }}>

        {/* SECTION 1 — Collection Value */}
        <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
          <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 4, marginBottom: 8, fontWeight: 600 }}>Collection Value</div>
          <div style={{ fontSize: 42, fontFamily: mono, fontWeight: 700, color: accent, textShadow: "0 0 40px rgba(212,168,67,0.2)" }}>${totalValue.toFixed(2)}</div>
          <div style={{ marginTop: 8 }}><span style={{ fontSize: 13, color: secondary, background: "rgba(255,255,255,0.05)", borderRadius: 9999, padding: "4px 12px" }}>{unsold.length} card{unsold.length !== 1 ? "s" : ""}</span></div>
        </div>

        {/* SECTION 2 — Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          {stats.map(s => (
            <button key={s.label} onClick={() => onNavigate({ screen: "myCards", filter: s.filter })} style={{ background: surface, borderRadius: 12, padding: "12px 8px", textAlign: "center", border: "none", borderTop: "2px solid " + (s.count > 0 ? s.color : "transparent"), cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
              <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: s.count > 0 ? s.color : muted }}>{s.count}</div>
              <div style={{ fontSize: 10, color: muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </button>
          ))}
        </div>

        {/* SECTION 3 — Action Items */}
        {hasActions ? (
          <div style={{ marginBottom: 20 }}>
            {needShipping.length > 0 && (
              <button onClick={() => onNavigate({ screen: "pickList" })} style={{ width: "100%", background: "linear-gradient(90deg, rgba(248,113,113,0.06), transparent)", borderLeft: "3px solid " + red, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: red }}>{needShipping.length} card{needShipping.length !== 1 ? "s" : ""} need shipping</div><div style={{ fontSize: 12, color: secondary, marginTop: 4 }}>{needShipping.slice(0, 3).map(c => `${c.player} $${c.sold_price}`).join(" · ")}</div></div>
                <span style={{ fontSize: 20, color: muted }}>›</span>
              </button>
            )}
            {unassigned.length > 0 && (
              <button onClick={() => onNavigate({ screen: "myCards", filter: "pending" })} style={{ width: "100%", background: surface, borderLeft: "3px solid " + amber, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: amber }}>{unassigned.length} card{unassigned.length !== 1 ? "s" : ""} not in a box</div>
              </button>
            )}
            {staleListings.length > 0 && (
              <button onClick={() => onNavigate({ screen: "myCards", filter: "stale" })} style={{ width: "100%", background: surface, borderLeft: "3px solid " + amber, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: amber }}>{staleListings.length} listing{staleListings.length > 1 ? "s" : ""} over 14 days</div>
              </button>
            )}
            {toInspect.length > 0 && (
              <button onClick={() => onNavigate({ screen: "gradeCheck" })} style={{ width: "100%", background: surface, borderLeft: "3px solid " + purple, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: purple }}>{toInspect.length} card{toInspect.length !== 1 ? "s" : ""} to inspect</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>Grade Check — tap to start inspecting</div>
              </button>
            )}
            {grading.length > 0 && (
              <button onClick={() => onNavigate({ screen: "gradingReturn" })} style={{ width: "100%", background: surface, borderLeft: "3px solid " + purple, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: purple }}>{grading.length} card{grading.length !== 1 ? "s" : ""} at grading</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{grading.slice(0, 3).map(c => `${c.player} (${c.grading_company || "?"} · ${daysSince(c.grading_submit_date)}d)`).join(" · ")}</div>
              </button>
            )}
          </div>
        ) : cards.length > 0 ? (
          <div style={{ background: green + "10", border: "1px solid " + green + "30", borderRadius: 12, padding: "14px", marginBottom: 20, textAlign: "center", fontSize: 14, color: green, fontWeight: 600 }}>All caught up! ✓</div>
        ) : null}

        {/* SECTION 4 — Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          {quickActions.map(a => (
            <button key={a.label} onClick={() => onNavigate({ screen: a.screen })} style={{ background: surface, border: "1px solid " + border, borderTop: "1px solid " + (a as any).color + "40", borderRadius: 12, padding: "16px 8px", textAlign: "center", cursor: "pointer", minHeight: 48, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 20, fontFamily: mono, fontWeight: 700, color: (a as any).color, marginBottom: 6, opacity: 0.7 }}>{a.icon}</div>
              <div style={{ fontSize: 12, color: secondary, fontWeight: 600 }}>{a.label}</div>
            </button>
          ))}
        </div>

        {/* SECTION 5 — Recently Added */}
        {recent.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontWeight: 700, marginTop: 28 }}>Recently Added</div>
            {recent.map(c => (
              <button key={c.id} onClick={() => onNavigate({ screen: "cardDetail", card: c })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", background: "none", border: "none", borderBottom: "1px solid " + border, cursor: "pointer", textAlign: "left" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.player}</div>
                  <div style={{ fontSize: 10, color: muted }}>{c.storage_box && c.storage_box !== "PENDING" ? `${c.storage_box} #${c.storage_position}` : "Unassigned"} · {relativeDate(c.created_at)}</div>
                </div>
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: green }}>${c.raw_value}</span>
              </button>
            ))}
          </div>
        )}

        {/* SECTION 6 — Top Value Cards */}
        {topValue.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontWeight: 700, marginTop: 28 }}>Top Value</div>
            {topValue.map((c, i) => (
              <button key={c.id} onClick={() => onNavigate({ screen: "cardDetail", card: c })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", background: "none", border: "none", borderBottom: "1px solid " + border, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: accent, width: 24, textAlign: "center" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.player}</div>
                  <div style={{ fontSize: 10, color: muted }}>{c.year} {c.brand}</div>
                </div>
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: green }}>${c.raw_value}</span>
              </button>
            ))}
          </div>
        )}

        {/* SECTION 7 — Boxes Overview */}
        {(boxes.length > 0 || unassigned.length > 0) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontWeight: 700, marginTop: 28 }}>Boxes</div>
            {unassigned.length > 0 && (
              <button onClick={() => onNavigate({ screen: "myCards", filter: "pending" })} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: amber + "08", border: "1px solid " + amber + "20", borderRadius: 10, marginBottom: 6, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 12, color: amber, fontWeight: 600 }}>Unassigned</span>
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: amber }}>{unassigned.length}</span>
              </button>
            )}
            {boxes.map(box => {
              const count = box.card_count || 0;
              const boxValue = cards.filter(c => c.storage_box === box.name && !c.sold).reduce((s, c) => s + (c.raw_value || 0), 0);
              const typeLabel = BOX_TYPE_LABELS[box.box_type || ("singles" as BoxType)]?.label || box.box_type || "Singles";
              const typeColor = typeColors[box.box_type || "singles"] || text;
              return (
                <button key={box.id} onClick={() => onNavigate({ screen: "storage", box })} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: surface, border: "1px solid " + border, borderRadius: 10, marginBottom: 6, cursor: "pointer", textAlign: "left" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{box.name}</div>
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, background: typeColor + "15", color: typeColor, fontWeight: 600 }}>{typeLabel}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: count > 0 ? green : muted }}>{count}</div>
                    <div style={{ fontSize: 9, color: muted }}>${boxValue.toFixed(0)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Lots */}
        {lots.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontWeight: 700, marginTop: 28 }}>Lots</div>
            <button onClick={() => onNavigate({ screen: "lotBuilder" })} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: surface, border: "1px solid " + border, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: text }}>Lot Builder</div>
              <div style={{ display: "flex", gap: 6 }}>
                {lots.filter(l => l.status === "draft").length > 0 && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: surface2, color: muted }}>{lots.filter(l => l.status === "draft").length} draft</span>}
                {lots.filter(l => l.status === "listed").length > 0 && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: cyan + "15", color: cyan }}>{lots.filter(l => l.status === "listed").length} listed</span>}
                {lots.filter(l => l.status === "sold").length > 0 && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: amber + "15", color: amber }}>{lots.filter(l => l.status === "sold").length} to ship</span>}
              </div>
            </button>
          </div>
        )}

        {/* SECTION 8 — Footer */}
        <div style={{ textAlign: "center", paddingTop: 12, borderTop: "1px solid " + border }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>{userEmail}</div>
          <button onClick={onSignOut} style={{ padding: "10px 24px", background: "none", border: "none", color: muted, fontFamily: font, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>Sign Out</button>
        </div>
      </div>
    </Shell>
  );
}
