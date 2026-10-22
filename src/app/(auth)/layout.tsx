import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PlatformShell } from "@/components/analytics/PlatformShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
