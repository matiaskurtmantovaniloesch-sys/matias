import { NextRequest, NextResponse } from "next/server";
import { deleteTouch, updateTouch } from "@/lib/data/touches";
import { touchPatchSchema } from "@/lib/schemas";
import { handleApiError, revalidateAll } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch = touchPatchSchema.parse(body);
    const updated = await updateTouch(id, patch);
    if (!updated) {
      return NextResponse.json(
        { error: "Touch não encontrado" },
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
    const ok = await deleteTouch(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Touch não encontrado" },
        { status: 404 }
      );
    }
    revalidateAll();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
