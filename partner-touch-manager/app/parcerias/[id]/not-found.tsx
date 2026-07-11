import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-xl font-semibold">Parceria não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ela pode ter sido excluída direto na planilha.
      </p>
      <Button asChild className="mt-4">
        <Link href="/parcerias">Voltar para Parcerias</Link>
      </Button>
    </div>
  );
}
