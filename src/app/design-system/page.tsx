/**
 * /design-system — server-component shell.
 *
 * Forces dynamic rendering so Vercel doesn't try to statically prerender
 * the route at build time (which silently dropped it from the deploy on
 * commit 7a588f6). The actual UI is the client component DesignSystemView.
 *
 * The "use client" page.tsx → renamed view.tsx pattern is required because
 * Next.js 16.2 doesn't honor `export const dynamic` from a "use client"
 * file — only from server components.
 */
export const dynamic = "force-dynamic";

import { DesignSystemView } from "./view";

export default function Page() {
  return <DesignSystemView />;
}
