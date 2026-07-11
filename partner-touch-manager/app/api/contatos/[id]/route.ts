import { NextRequest, NextResponse } from "next/server";
import { deleteContato, updateContato } from "@/lib/data/contatos";
import { contatoPatchSchema } from "@/lib/schemas";
import { handleApiError, revalidateAll } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch = contatoPatchSchema.parse(body);
    const updated = await updateContato(id, patch);
    if (!updated) {
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }
    revalidateAll();
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ok = await deleteContato(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Contato não encontrado" },
        { status: 404 }
      );
    }
    revalidateAll();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
