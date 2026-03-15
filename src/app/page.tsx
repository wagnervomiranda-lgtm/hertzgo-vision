"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Zap, Upload, RotateCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface Session {
  date: Date;
  hub: string;
  user: string;
  charger: string;
  energy: number;
  value: number;
  duration: string;
  status: string;
}

interface HubStat {
  name: string;
  rev: number;
  kwh: number;
  sess: number;
}

interface UserStat {
  name: string;
  rev: number;
  kwh: number;
  sess: number;
  mainHub: string;
}

type TabId = "financeiro" | "hubs" | "usuarios" | "sessoes";

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(s.toString().replace(/\./g, "").replace(",", ".")) || 0;
}

function parseDate(s: string): Date | null {
  const m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function parseLine(line: string): string[] {
  const res: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { res.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  res.push(cur.trim());
  return res;
}

function parseCSV(text: string): Session[] {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Arquivo vazio");
  const hdr = parseLine(lines[0]).map((h) =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  const idx = (test: RegExp) => hdr.findIndex((h) => test.test(h));
  const iData   = idx(/^data$/);
  const iLocal  = idx(/^local$/);
  const iUser   = idx(/usu/);
  const iChrg   = idx(/carregador/);
  const iEnergy = idx(/^energia$/);
  const iValue  = idx(/^valor$/);
  const iDur    = idx(/dura/);
  const iStatus = idx(/recarga/);
  const sessions: Session[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const get = (id: number) => (id >= 0 && cols[id]) ? cols[id].trim() : "";
    const date = parseDate(get(iData));
    if (!date) continue;
    sessions.push({
      date,
      hub:      get(iLocal)  || "Desconhecido",
      user:     get(iUser)   || "—",
      charger:  get(iChrg)   || "—",
      energy:   parseNum(get(iEnergy)),
      value:    parseNum(get(iValue)),
      duration: get(iDur)    || "—",
      status:   get(iStatus) || "—",
    });
  }
  if (!sessions.length) throw new Error("Nenhuma sessão encontrada");
  return sessions;
}

function fmtBRL(n: number): string {
  return "R$\u00a0" + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtK(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtN(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.substring(0, n - 1) + "…" : s;
}

const ChartTooltip = ({ active, payload, label, suffix = "" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#14181f", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, padding: "10px 14px",
      fontFamily: "monospace", fontSize: 12, color: "#f0f2f5",
    }}>
      <div style={{ color: "#8892a0", marginBottom: 4, fontSize: 11 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || "#00e5a0" }}>
          {suffix === "R$" ? fmtBRL(p.value) : `${fmtK(p.value)} ${suffix}`}
        </div>
      ))}
    </div>
  );
};

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{
      background: "#0f1218", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 28, padding: "22px 20px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: accent, marginBottom: 6 }}>{value}</div>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#4a5568" }}>{sub}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "monospace", fontSize: 10, color: "#4a5568", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
      {children}
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#0f1218", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 28, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", padding: "4px 10px", background: "rgba(0,229,160,0.12)", color: "#00e5a0", borderRadius: 6, letterSpacing: "0.06em" }}>
      {children}
    </span>
  );
}

function SessPill({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", background: "rgba(0,229,160,0.12)", color: "#00e5a0", borderRadius: 6, fontSize: 10, fontFamily: "monospace" }}>
      {n}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, { bg: string; color: string }> = {
    1: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    2: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
    3: { bg: "rgba(180,120,60,0.12)",  color: "#b47c3c" },
  };
  const s = styles[rank] ?? { bg: "#1a1f28", color: "#4a5568" };
  return (
    <span style={{ width: 24, height: 24, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "monospace", background: s.bg, color: s.color }}>
      {rank}
    </span>
  );
}

const TH: React.CSSProperties = { fontSize: 10, fontFamily: "monospace", color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 500 };
const THR: React.CSSProperties = { ...TH, textAlign: "right" };
const TD: React.CSSProperties = { padding: "11px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12, verticalAlign: "middle" };
const TDR: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "monospace" };

function UploadScreen({ onFile }: { onFile: (sessions: Session[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sessions = parseCSV(e.target?.result as string);
        onFile(sessions);
      } catch (err: any) {
        setError(err.message);
      }
    };
    reader.readAsText(file, "UTF-8");
  }, [onFile]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: "clamp(36px,6vw,52px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>
          Painel <span style={{ color: "#00e5a0" }}>Operacional</span>
        </h1>
        <p style={{ fontSize: 15, color: "#8892a0", fontFamily: "monospace" }}>
          Carregue o CSV do Spott para visualizar os dados em tempo real
        </p>
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        style={{
          width: "100%", maxWidth: 560,
          background: dragging ? "rgba(0,229,160,0.06)" : "#0f1218",
          border: `1.5px dashed ${dragging ? "#00e5a0" : "rgba(255,255,255,0.10)"}`,
          borderRadius: 40, padding: "52px 40px", textAlign: "center", cursor: "pointer", transition: "all 0.25s",
        }}
      >
        <div style={{ width: 56, height: 56, background: "rgba(0,229,160,0.12)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Upload size={26} color="#00e5a0" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Carregar CSV Spott</h3>
        <p style={{ fontSize: 12, color: "#8892a0", fontFamily: "monospace", lineHeight: 1.8 }}>
          Arraste ou clique para selecionar<br />Formato: Data · Local · Usuário · Energia · Valor
        </p>
        <div style={{ display: "inline-block", marginTop: 24, padding: "11px 28px", background: "#00e5a0", color: "#050608", borderRadius: 12, fontWeight: 700, fontSize: 13 }}>
          Selecionar arquivo
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {["📅 Qualquer período", "📍 Multi-hub", "🔵 Formato Spott"].map((c) => (
            <span key={c} style={{ background: "#14181f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontFamily: "monospace", color: "#8892a0" }}>{c}</span>
          ))}
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
      {error && (
        <div style={{ marginTop: 16, padding: "12px 20px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#ef4444", fontSize: 13, fontFamily: "monospace" }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}

function TabFinanceiro({ sessions }: { sessions: Session[] }) {
  const ok        = sessions.filter((s) => s.energy > 0);
  const totalRev  = ok.reduce((a, s) => a + s.value, 0);
  const totalKwh  = ok.reduce((a, s) => a + s.energy, 0);
  const totalSess = ok.length;
  const ticket    = totalSess > 0 ? totalRev / totalSess : 0;
  const priceKwh  = totalKwh  > 0 ? totalRev / totalKwh  : 0;
  const datesArr  = sessions.map((s) => s.date.getTime());
  const days      = Math.max(1, Math.round((Math.max(...datesArr) - Math.min(...datesArr)) / 86400000) + 1);
  const minDt     = new Date(Math.min(...datesArr));
  const maxDt     = new Date(Math.max(...datesArr));

  const hubMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach((s) => {
    if (!hubMap[s.hub]) hubMap[s.hub] = { rev: 0, kwh: 0, sess: 0 };
    hubMap[s.hub].rev += s.value; hubMap[s.hub].kwh += s.energy; hubMap[s.hub].sess++;
  });
  const hubData = Object.entries(hubMap).sort((a, b) => b[1].rev - a[1].rev)
    .map(([name, d]) => ({ name: truncate(name, 18), rev: parseFloat(d.rev.toFixed(2)) }));

  const userMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach((s) => {
    if (!userMap[s.user]) userMap[s.user] = { rev: 0, kwh: 0, sess: 0 };
    userMap[s.user].rev += s.value; userMap[s.user].kwh += s.energy; userMap[s.user].sess++;
  });
  const top5 = Object.entries(userMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);

  const dayMap: Record<string, number> = {};
  ok.forEach((s) => { const k = fmtDate(s.date); dayMap[k] = (dayMap[k] || 0) + s.value; });
  const dayData = Object.entries(dayMap)
    .sort((a, b) => { const [da,ma] = a[0].split("/").map(Number); const [db,mb] = b[0].split("/").map(Number); return (ma*100+da)-(mb*100+db); })
    .map(([date, rev]) => ({ date, rev: parseFloat(rev.toFixed(2)) }));
  const avgRev = dayData.length > 0 ? dayData.reduce((a, d) => a + d.rev, 0) / dayData.length : 0;

  return (
    <div style={{ padding: "24px 28px" }}>
      <SectionLabel>Resumo Financeiro</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Faturamento Total" value={fmtBRL(totalRev)}            sub={`Média: ${fmtBRL(totalRev/days)}/dia`}       accent="#00e5a0" />
        <KpiCard label="Energia Entregue"  value={fmtK(totalKwh) + " kWh"}     sub={`${fmtK(totalKwh/days)} kWh/dia`}            accent="#f59e0b" />
        <KpiCard label="Total de Sessões"  value={fmtN(totalSess)}              sub={`${(totalSess/days).toFixed(1)} sessões/dia`} accent="#3b82f6" />
        <KpiCard label="Preço Médio / kWh" value={"R$\u00a0"+priceKwh.toFixed(2).replace(".",",")} sub={`Ticket: ${fmtBRL(ticket)}`} accent="#ef4444" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 28 }}>
        <Panel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Faturamento por Hub</span>
            <Badge>{`${fmtDate(minDt)} → ${fmtDate(maxDt)} · ${days}d`}</Badge>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hubData} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => "R$"+(v/1000).toFixed(0)+"k"} tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<ChartTooltip suffix="R$" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="rev" fill="rgba(0,229,160,0.7)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Top 5 Motoristas</span>
            <Badge>Receita</Badge>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>#</th><th style={TH}>Usuário</th>
                <th style={THR}>Sess.</th><th style={THR}>kWh</th><th style={THR}>Total</th>
              </tr>
            </thead>
            <tbody>
              {top5.map(([name, d], i) => (
                <tr key={name}>
                  <td style={TD}><RankBadge rank={i+1} /></td>
                  <td style={TD}><span style={{ fontSize: 12, fontWeight: 600 }}>{truncate(name,18)}</span></td>
                  <td style={TDR}><SessPill n={d.sess} /></td>
                  <td style={TDR}>{fmtK(d.kwh)}</td>
                  <td style={{ ...TDR, color: "#00e5a0", fontWeight: 600 }}>{fmtBRL(d.rev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <SectionLabel>Evolução Diária</SectionLabel>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Receita Diária</span>
          <Badge>Média {fmtBRL(avgRev)}</Badge>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dayData}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => "R$"+v.toLocaleString("pt-BR",{minimumFractionDigits:0})} tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTooltip suffix="R$" />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
            <ReferenceLine y={avgRev} stroke="rgba(245,158,11,0.4)" strokeDasharray="5 4" strokeWidth={1.5} />
            <Line dataKey="rev" stroke="#00e5a0" strokeWidth={2} dot={{ r: 3, fill: "#00e5a0" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function TabHubs({ sessions }: { sessions: Session[] }) {
  const ok = sessions.filter((s) => s.energy > 0);
  const hubMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach((s) => {
    if (!hubMap[s.hub]) hubMap[s.hub] = { rev: 0, kwh: 0, sess: 0 };
    hubMap[s.hub].rev += s.value; hubMap[s.hub].kwh += s.energy; hubMap[s.hub].sess++;
  });
  const hubs: HubStat[] = Object.entries(hubMap).sort((a,b) => b[1].rev-a[1].rev).map(([name,d]) => ({ name,...d }));
  const maxRev = Math.max(...hubs.map((h) => h.rev), 1);
  const kwhData = hubs.map((h) => ({ name: truncate(h.name,20), kwh: parseFloat(h.kwh.toFixed(1)) }));

  return (
    <div style={{ padding: "24px 28px" }}>
      <SectionLabel>Performance por Estação</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14, marginBottom: 24 }}>
        {hubs.map((h) => (
          <div key={h.name} style={{ background: "#0f1218", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 28, padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4a5568", marginBottom: 18 }}>{h.sess} sessões · {fmtK(h.kwh)} kWh</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[{ l:"Receita", v:fmtBRL(h.rev) },{ l:"Ticket", v:fmtBRL(h.rev/h.sess) },{ l:"R$/kWh", v:(h.rev/h.kwh).toFixed(2).replace(".",",") }].map((kpi) => (
                <div key={kpi.l} style={{ background: "#14181f", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4a5568", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.l}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#00e5a0" }}>{kpi.v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, height: 4, background: "#1a1f28", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(h.rev/maxRev*100).toFixed(1)}%`, background: "#00e5a0", borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
      <SectionLabel>kWh por Hub</SectionLabel>
      <Panel>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Distribuição de Energia</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={kwhData} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => v.toFixed(0)+" kWh"} tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTooltip suffix="kWh" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="kwh" fill="rgba(59,130,246,0.7)" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function TabUsuarios({ sessions }: { sessions: Session[] }) {
  const ok = sessions.filter((s) => s.energy > 0);
  const totalRev = ok.reduce((a,s) => a+s.value, 0);
  const userMap: Record<string, { rev:number; kwh:number; sess:number; hubs:Record<string,number> }> = {};
  ok.forEach((s) => {
    if (!userMap[s.user]) userMap[s.user] = { rev:0, kwh:0, sess:0, hubs:{} };
    userMap[s.user].rev += s.value; userMap[s.user].kwh += s.energy; userMap[s.user].sess++;
    userMap[s.user].hubs[s.hub] = (userMap[s.user].hubs[s.hub]||0)+1;
  });
  const users: UserStat[] = Object.entries(userMap).sort((a,b) => b[1].rev-a[1].rev)
    .map(([name,d]) => ({ name, rev:d.rev, kwh:d.kwh, sess:d.sess, mainHub: Object.entries(d.hubs).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—" }));
  const maxRev2 = users.length ? users[0].rev : 1;

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Gestão de Usuários</div>
        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#4a5568" }}>{users.length} usuários únicos · {ok.length} sessões</div>
      </div>
      <SectionLabel>Ranking Completo</SectionLabel>
      <div style={{ background: "#0f1218", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 28, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>#</th><th style={TH}>Usuário</th><th style={TH}>Hub Principal</th>
              <th style={THR}>Sessões</th><th style={THR}>kWh</th><th style={THR}>Total (R$)</th>
              <th style={THR}>Ticket Médio</th><th style={THR}>Participação</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u,i) => {
              const pct  = totalRev > 0 ? (u.rev/totalRev*100).toFixed(1) : "0.0";
              const barW = maxRev2  > 0 ? (u.rev/maxRev2*100).toFixed(1)  : "0";
              return (
                <tr key={u.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={TD}><RankBadge rank={i+1} /></td>
                  <td style={TD}><span style={{ fontSize:12, fontWeight:600 }}>{u.name}</span></td>
                  <td style={{ ...TD, fontSize:11, color:"#8892a0" }}>{truncate(u.mainHub,22)}</td>
                  <td style={TDR}><SessPill n={u.sess} /></td>
                  <td style={{ ...TDR, color:"#8892a0" }}>{fmtK(u.kwh)}</td>
                  <td style={{ ...TDR, color:"#00e5a0", fontWeight:600 }}>{fmtBRL(u.rev)}</td>
                  <td style={{ ...TDR, color:"#8892a0" }}>{fmtBRL(u.rev/u.sess)}</td>
                  <td style={TDR}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                      <span style={{ fontSize:10, color:"#4a5568", fontFamily:"monospace" }}>{pct}%</span>
                      <div style={{ width:80, height:4, background:"#1a1f28", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${barW}%`, background:"#00e5a0", borderRadius:2 }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabSessoes({ sessions }: { sessions: Session[] }) {
  const ok        = sessions.filter((s) => s.energy > 0);
  const totalRev  = ok.reduce((a,s) => a+s.value, 0);
  const totalKwh  = ok.reduce((a,s) => a+s.energy, 0);
  const cancelled = sessions.filter((s) => s.energy === 0).length;
  const cancelRate = sessions.length > 0 ? (cancelled/sessions.length*100).toFixed(1) : "0.0";
  const uniqueHubs = new Set(ok.map((s) => s.hub)).size;
  const recent    = [...sessions].reverse().slice(0,100);
  const kpis = [
    { label:"Sessões Válidas",   value:fmtN(ok.length),    sub:`de ${sessions.length} totais`,  accent:"#00e5a0" },
    { label:"Cancelamentos",      value:fmtN(cancelled),    sub:`${cancelRate}% do total`,        accent:"#f59e0b" },
    { label:"Hubs Ativos",        value:String(uniqueHubs), sub:"estações operando",              accent:"#3b82f6" },
    { label:"kWh Total",          value:fmtK(totalKwh),     sub:`= ${fmtBRL(totalRev)}`,          accent:"#00e5a0" },
    { label:"Média kWh / Sessão", value:ok.length>0?fmtK(totalKwh/ok.length):"—", sub:"por carregamento", accent:"#f59e0b" },
    { label:"R$ / kWh Médio",     value:totalKwh>0?(totalRev/totalKwh).toFixed(2).replace(".",","):"—", sub:"tarifa realizada", accent:"#3b82f6" },
  ];

  return (
    <div style={{ padding: "24px 28px" }}>
      <SectionLabel>Métricas de Sessão</SectionLabel>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12, marginBottom:20 }}>
        {kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} />)}
      </div>
      <SectionLabel>Sessões Recentes</SectionLabel>
      <div style={{ background:"#0f1218", border:"1px solid rgba(255,255,255,0.06)", borderRadius:28, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Data</th><th style={TH}>Usuário</th><th style={TH}>Hub</th>
              <th style={TH}>Carregador</th><th style={THR}>Duração</th>
              <th style={THR}>kWh</th><th style={THR}>Valor</th><th style={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s,i) => {
              const isOk = s.energy > 0;
              return (
                <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ ...TD, fontFamily:"monospace", fontSize:11, color:"#4a5568" }}>{fmtDate(s.date)}</td>
                  <td style={TD}><span style={{ fontSize:12, fontWeight:600 }}>{truncate(s.user,20)}</span></td>
                  <td style={{ ...TD, fontSize:11, color:"#8892a0" }}>{truncate(s.hub,22)}</td>
                  <td style={{ ...TD, fontSize:11, color:"#4a5568", fontFamily:"monospace" }}>{truncate(s.charger,18)}</td>
                  <td style={{ ...TDR, fontSize:11 }}>{s.duration}</td>
                  <td style={{ ...TDR, color:"#8892a0" }}>{s.energy.toFixed(1)}</td>
                  <td style={{ ...TDR, color:isOk?"#00e5a0":"#4a5568", fontWeight:isOk?600:400 }}>{isOk?fmtBRL(s.value):"—"}</td>
                  <td style={{ ...TD, fontSize:10, fontFamily:"monospace", color:isOk?"#00e5a0":"#4a5568" }}>{s.status||(isOk?"Finalizado":"Cancelado")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HertzGoDashboard() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("financeiro");

  useEffect(() => {
    const id = "hertzgo-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  const datesArr    = sessions ? sessions.map((s) => s.date.getTime()) : [];
  const totalSess   = sessions ? sessions.filter((s) => s.energy > 0).length : 0;
  const uniqueUsers = sessions ? new Set(sessions.filter((s) => s.energy > 0).map((s) => s.user)).size : 0;

  const tabs: { id: TabId; label: string }[] = [
    { id: "financeiro", label: "DRE" },
    { id: "hubs",       label: "Hubs" },
    { id: "usuarios",   label: "Usuários" },
    { id: "sessoes",    label: "Sessões" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:"#050608", color:"#f0f2f5", fontFamily:"'Syne', sans-serif", fontSize:14 }}>

      {/* TOPBAR */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", height:64, background:"#0a0c10", borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, zIndex:100, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, background:"#00e5a0", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Zap size={18} color="#050608" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.03em" }}>HertzGo</div>
            <div style={{ fontSize:10, fontFamily:"monospace", color:"#4a5568", letterSpacing:"0.12em", textTransform:"uppercase", marginTop:1 }}>Painel · Rede EV</div>
          </div>
        </div>
        {sessions && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding:"7px 16px", borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer",
                border: activeTab===t.id ? "1px solid #00e5a0" : "1px solid rgba(255,255,255,0.10)",
                background: activeTab===t.id ? "#00e5a0" : "transparent",
                color: activeTab===t.id ? "#050608" : "#8892a0",
                fontFamily:"'Syne', sans-serif", transition:"all 0.2s",
                boxShadow: activeTab===t.id ? "0 0 20px rgba(0,229,160,0.3)" : "none",
              }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      {!sessions ? (
        <UploadScreen onFile={setSessions} />
      ) : (
        <>
          {activeTab==="financeiro" && <TabFinanceiro sessions={sessions} />}
          {activeTab==="hubs"       && <TabHubs       sessions={sessions} />}
          {activeTab==="usuarios"   && <TabUsuarios   sessions={sessions} />}
          {activeTab==="sessoes"    && <TabSessoes    sessions={sessions} />}
        </>
      )}

      {/* STATUS BAR */}
      {sessions && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 28px", background:"#0a0c10", borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:11, fontFamily:"monospace", color:"#4a5568", flexShrink:0, marginTop:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#00e5a0", boxShadow:"0 0 6px #00e5a0", display:"inline-block" }} />
            {sessions.length} registros · {totalSess} sessões · {uniqueUsers} usuários
          </div>
          <button onClick={() => { setSessions(null); setActiveTab("financeiro"); }} style={{ padding:"5px 14px", borderRadius:8, fontSize:11, fontFamily:"monospace", cursor:"pointer", border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.06)", color:"#ef4444", display:"flex", alignItems:"center", gap:6 }}>
            <RotateCcw size={11} /> Novo CSV
          </button>
        </div>
      )}
    </div>
  );
}
