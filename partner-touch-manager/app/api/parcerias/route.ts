import { NextRequest, NextResponse } from "next/server";
import { createParceria, getParcerias } from "@/lib/data/parcerias";
import { parceriaInputSchema } from "@/lib/schemas";
import { handleApiError, revalidateAll } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET /api/parcerias — usado pelo modal global de touch (autocomplete)
export async function GET() {
  try {
    const parcerias = await getParcerias();
    return NextResponse.json(parcerias);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/parcerias — cria parceria (grava na aba Parcerias do Sheets)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = parceriaInputSchema.parse(body);
    const parceria = await createParceria(input);
    revalidateAll();
    return NextResponse.json(parceria, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
