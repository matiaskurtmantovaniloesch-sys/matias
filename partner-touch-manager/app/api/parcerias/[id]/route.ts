import { NextRequest, NextResponse } from "next/server";
import { deleteParceria, updateParceria } from "@/lib/data/parcerias";
import { parceriaPatchSchema } from "@/lib/schemas";
import { handleApiError, revalidateAll } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/parcerias/[id] — edição (inclui edição inline de health/status)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch = parceriaPatchSchema.parse(body);
    const updated = await updateParceria(id, patch);
    if (!updated) {
      return NextResponse.json(
        { error: "Parceria não encontrada" },
        { status: 404 }
      );
    }
    revalidateAll();
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/parcerias/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ok = await deleteParceria(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Parceria não encontrada" },
        { status: 404 }
      );
    }
    revalidateAll();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
