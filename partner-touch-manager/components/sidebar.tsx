"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Handshake, LayoutDashboard, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTouchModal } from "@/components/touch-modal";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parcerias", label: "Parcerias", icon: Handshake },
  { href: "/contatos", label: "Contatos", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { open } = useTouchModal();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-b bg-card p-4 md:h-screen md:w-60 md:border-b-0 md:border-r md:sticky md:top-0">
      <div className="flex items-center gap-2 px-2">
        <Handshake className="h-6 w-6 text-primary" />
        <div>
          <p className="text-sm font-bold leading-tight">Partner Touch</p>
          <p className="text-xs text-muted-foreground">Time de Relacionamentos</p>
        </div>
      </div>

      <Button onClick={() => open()} className="w-full">
        <Plus /> Registrar touch
      </Button>

      <nav className="flex gap-1 md:flex-col">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-auto hidden px-2 text-xs text-muted-foreground md:block">
        Dados vivos no Google Sheets
      </p>
    </aside>
  );
}
