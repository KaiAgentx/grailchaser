"use client";
import { BottomNavTab } from "./BottomNavTab";

/**
 * Bottom nav for the 5-tab system: Home / Search / Scan / Collection / Profile.
 *
 * Rendered ONCE by AppShell (which wraps every authed screen). Tabs map to
 * Screen-state values in page.tsx via tabScreenMap. Detail screens
 * (cardDetail, scan, result, batchImport, etc.) bubble up to their
 * conceptual parent tab — e.g., cardDetail → collection.
 *
 * The Scan tab is elevated per design tokens (navigation.scanCenterElevated).
 */

const tabScreenMap: Record<string, string> = {
  home: "home",
  search: "search",
  scanChooser: "scanChooser",
  scan: "scanChooser",
  result: "scanChooser",
  collection: "collection",
  myCards: "collection",
  cardDetail: "collection",
  storage: "collection",
  watchlist: "collection",
  batchImport: "profile",
  tierBreakdown: "collection",
  profile: "profile",
};

interface Props {
  currentScreen: string;
  prevScreen: string;
  onNavigate: (screen: string) => void;
}

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12L12 3l9 9" />
    <path d="M5 10v10h14V10" />
  </svg>
);
const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const ScanIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const CollectionIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);
const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);

export function BottomNav({ currentScreen, prevScreen, onNavigate }: Props) {
  // activeTab can be null when currentScreen doesn't match any known screen
  // (e.g. /design-system passes "__none__"). null → no tab highlighted.
  let activeTab: string | null = tabScreenMap[currentScreen] ?? null;
  if (activeTab == null && currentScreen !== "__none__") {
    activeTab = "home"; // fallback for unknown but legit screens
  }
  if (currentScreen === "cardDetail") {
    activeTab = tabScreenMap[prevScreen] || "collection";
  }

  const tabs: Array<{ id: string; label: string; icon: React.ReactNode; elevated?: boolean }> = [
    { id: "home", label: "Home", icon: <HomeIcon /> },
    { id: "search", label: "Search", icon: <SearchIcon /> },
    { id: "scanChooser", label: "Scan", icon: <ScanIcon />, elevated: true },
    { id: "collection", label: "Collection", icon: <CollectionIcon /> },
    { id: "profile", label: "Profile", icon: <ProfileIcon /> },
  ];

  return (
    <nav
        className="fixed inset-x-0 bottom-0 z-[100] flex justify-center backdrop-blur"
        style={{
          background: "color-mix(in srgb, var(--gc-bg-canvas) 95%, transparent)",
          borderTop: "1px solid var(--gc-border-subtle)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          className="w-full flex items-end"
          style={{ maxWidth: 500, height: 64 }}
        >
          {tabs.map((tab) => (
            <BottomNavTab
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              active={activeTab === tab.id}
              elevated={tab.elevated}
              onTap={onNavigate}
            />
          ))}
        </div>
      </nav>
  );
}
