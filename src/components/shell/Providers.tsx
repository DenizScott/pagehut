"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * next-themes renders an inline <script> that applies the theme before the first paint. It only
 * matters in the server HTML. When the layout renders again on the client (switching language
 * re-renders the [locale] layout), React would warn about a <script> it never runs; marking that
 * client copy as a data block keeps it inert and the console clean. The server copy stays a normal
 * script, so there is still no flash of the wrong theme.
 */
const scriptProps = typeof window === "undefined" ? undefined : { type: "application/json" };

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange scriptProps={scriptProps}>
      {children}
    </ThemeProvider>
  );
}
