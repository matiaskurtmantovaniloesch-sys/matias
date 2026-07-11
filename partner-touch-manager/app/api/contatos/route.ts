import { NextRequest, NextResponse } from "next/server";
import { createContato, getContatos } from "@/lib/data/contatos";
import { contatoInputSchema } from "@/lib/schemas";
import { handleApiError, revalidateAll } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET /api/contatos[?parceria_id=...] — usado pelo modal global de touch
export async function GET(req: NextRequest) {
  try {
    const parceriaId = req.nextUrl.searchParams.get("parceria_id");
    let contatos = await getContatos();
    if (parceriaId) {
      contatos = contatos.filter((c) => c.parceria_id === parceriaId);
    }
    return NextResponse.json(contatos);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/contatos — cria contato (grava na aba Contatos do Sheets)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = contatoInputSchema.parse(body);
    const contato = await createContato(input);
    revalidateAll();
    return NextResponse.json(contato, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
