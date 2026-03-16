import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function salvar(telefone: string, mensagem: string, resposta: string | null) {
  await fetch(`${SUPABASE_URL}/rest/v1/webhook_respostas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ telefone, mensagem, resposta, processado: false }),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const telefone: string =
      body?.phone ?? body?.from ?? body?.chatId?.replace("@c.us", "") ?? "";
    const mensagem: string =
      body?.text?.message ?? body?.message?.conversation ?? body?.body ?? "";
    if (!telefone || !mensagem) {
      return NextResponse.json({ error: "Campos ausentes" }, { status: 400 });
    }
    const msg = mensagem.trim();
    const resposta = msg === "1" || msg === "2" ? msg : null;
    await salvar(telefone, mensagem, resposta);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    endpoint: "HertzGo Webhook Z-API",
    timestamp: new Date().toISOString(),
  });
}
