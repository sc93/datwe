import type { ReactNode } from "react";

import { DrawNavigationBoundary } from "./_components/draw-screens";

export default function DrawLayout({ children }: { children: ReactNode }) {
  return <DrawNavigationBoundary>{children}</DrawNavigationBoundary>;
}
