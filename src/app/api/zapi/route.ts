import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, message } = body;
  const instanceId  = process.env.ZAPI_INSTANCE_ID;
  const token       = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token || !clientToken) {
    return NextResponse.json({ ok: false, erro: "Z-API não configurada no servidor." }, { status: 500 });
  }
  if (!phone || !message) {
    return NextResponse.json({ ok: false, erro: "phone e message são obrigatórios." }, { status: 400 });
  }
  const num  = phone.replace(/\D/g, "");
  const fone = num.startsWith("55") ? num : "55" + num;
  try {
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: fone, message }),
    });
    const data = await res.json();
    if (res.ok && (data.zaapId || data.messageId || data.id)) {
      return NextResponse.json({ ok: true, id: data.zaapId || data.messageId || data.id });
    }
    return NextResponse.json({ ok: false, erro: data.error || data.message || JSON.stringify(data) }, { status: 422 });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const instanceId  = process.env.ZAPI_INSTANCE_ID;
  const token       = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token || !clientToken) {
    return NextResponse.json({ configured: false });
  }
  try {
    const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
      headers: { "Client-Token": clientToken },
    });
    const data = await res.json();
    return NextResponse.json({ configured: true, ...data });
  } catch (e: unknown) {
    return NextResponse.json({ configured: true, erro: (e as Error).message });
  }
}
