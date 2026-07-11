"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTouchModal } from "@/components/touch-modal";

export function RegistrarTouchButton({ parceriaId }: { parceriaId?: string }) {
  const { open } = useTouchModal();
  return (
    <Button onClick={() => open(parceriaId)}>
      <Plus /> Registrar touch
    </Button>
  );
}
