import { NextRequest, NextResponse } from "next/server";
import { createTouch, getTouches } from "@/lib/data/touches";
import { touchInputSchema } from "@/lib/schemas";
import { handleApiError, revalidateAll } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET /api/touches[?parceria_id=...]
export async function GET(req: NextRequest) {
  try {
    const parceriaId = req.nextUrl.searchParams.get("parceria_id");
    let touches = await getTouches();
    if (parceriaId) {
      touches = touches.filter((t) => t.parceria_id === parceriaId);
    }
    return NextResponse.json(touches);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/touches — registra touch e atualiza a parceria
// (ultima_interacao / proximo_followup) na sequência.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = touchInputSchema.parse(body);
    const touch = await createTouch(input);
    revalidateAll();
    return NextResponse.json(touch, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
