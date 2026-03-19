import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID ?? "";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN ?? "";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN ?? "";

const MSGS: Record<string, string> = {
  msg2a_parkway:
    "Perfeito [nome]! 🎉\n\nCondição especial para motoristas no Park Way: DC 80kW, sem fila, com prioridade.\n\nCupom: PWVIP10\n\nQuer o endereço?",
  msg2a_cidadeauto:
    "Perfeito [nome]! 🎉\n\nCondição especial na Cidade do Automóvel: DC 40kW rápido e sem fila.\n\nCupom: CAVIP10\n\nQuer o endereço?",
  msg2b_costa:
    "[nome], obrigado por ser cliente do Costa Atacadão! 😊\n\nPresente: apresente o código COSTA10 no caixa do supermercado e ganhe desconto especial. ⚡",
  msg2b_parkway:
    "[nome], você já é cliente frequente no Park Way! 🙏\n\nCupom fidelidade: PWVIP10",
  msg2b_cidadeauto:
    "[nome], obrigado por carregar na Cidade do Automóvel! ⚡\n\nCupom fidelidade: CAVIP10",
};

function rotearMensagem(hubKey: string, resposta: "1" | "2", nome: string): string {
  const isMotorista = resposta === "1";
  const diaImpar = new Date().getDate() % 2 !== 0;
  let msgKey: string;

  if (isMotorista) {
    if (hubKey === "parkway") msgKey = "msg2a_parkway";
    else if (hubKey === "cidadeauto") msgKey = "msg2a_cidadeauto";
    else if (hubKey === "madeiro_sia") msgKey = diaImpar ? "msg2a_parkway" : "msg2a_cidadeauto";
    else msgKey = "msg2a_parkway";
  } else {
    if (hubKey === "costa") msgKey = "msg2b_costa";
    else if (hubKey === "cidadeauto") msgKey = "msg2b_cidadeauto";
    else msgKey = "msg2b_parkway";
  }

  const template = MSGS[msgKey] ?? MSGS["msg2b_parkway"];
  return template.replace(/\[nome\]/gi, nome.split(" ")[0] || nome);
}

async function buscarUltimoHub(telefone: string): Promise<string> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/webhook_respostas?telefone=eq.${telefone}&hub_key=not.is.null&order=criado_em.desc&limit=1&select=hub_key`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return "costa";
    const data = await res.json();
    return data?.[0]?.hub_key ?? "costa";
  } catch {
    return "costa";
  }
}

async function salvar(telefone: string, mensagem: string, resposta: string | null, hubKey?: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/webhook_respostas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ telefone, mensagem, resposta, hub_key: hubKey ?? null, processado: false }),
  });
}

async function dispararWhatsApp(telefone: string, message: string): Promise<{ ok: boolean; id?: string; erro?: string }> {
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) return { ok: false, erro: "Z-API não configurada" };

  const num = telefone.replace(/\D/g, "");
  const fone = num.startsWith("55") ? num : "55" + num;

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: fone, message }),
      }
    );
    const data = await res.json();
    console.log("[Webhook→Z-API] Status:", res.status, JSON.stringify(data));
    if (res.ok && (data.zaapId || data.messageId || data.id)) {
      return { ok: true, id: data.zaapId || data.messageId || data.id };
    }
    return { ok: false, erro: data.error || data.message || JSON.stringify(data) };
  } catch (e: unknown) {
    return { ok: false, erro: (e as Error).message };
  }
}

async function marcarProcessado(telefone: string) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/webhook_respostas?telefone=eq.${telefone}&processado=eq.false`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ processado: true }),
    }
  );
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
    const resposta = msg === "1" || msg === "2" ? (msg as "1" | "2") : null;

    await salvar(telefone, mensagem, resposta);

    if (!resposta) {
      return NextResponse.json({ ok: true, action: "saved_only" });
    }

    const hubKey = await buscarUltimoHub(telefone);
    console.log(`[Webhook] Tel: ${telefone} | Resp: ${resposta} | Hub: ${hubKey}`);

    const msgTexto = rotearMensagem(hubKey, resposta, "cliente");
    const resultado = await dispararWhatsApp(telefone, msgTexto);

    console.log("[Webhook] Disparo:", JSON.stringify(resultado));

    await marcarProcessado(telefone);

    return NextResponse.json({
      ok: true,
      action: "dispatched",
      resposta,
      hubKey,
      msgDisparada: resultado.ok ? "ok" : "falhou",
      zapiErro: resultado.erro,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    endpoint: "HertzGo Webhook — v2",
    timestamp: new Date().toISOString(),
  });
}