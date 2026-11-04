import { AppShell } from "@/components/shell/AppShell";

export default function WorkspaceLayout({ children }: LayoutProps<"/[locale]">) {
  return <AppShell>{children}</AppShell>;
}
