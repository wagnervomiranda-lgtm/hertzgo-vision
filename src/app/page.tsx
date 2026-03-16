"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, PieChart, Pie, Cell } from "recharts";

function useFonts() {
  useEffect(() => {
    const id = "hz-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700&display=swap";
    document.head.appendChild(l);
  }, []);
}

interface Session {
  date: Date; hub: string; user: string; charger: string;
  energy: number; value: number; duration: string;
  durMin: number | null; overstayMin: number | null;
  startHour: number | null; status: string; cancelled: boolean;
}
interface UserData {
  user: string; sess: number; kwh: number; rev: number;
  dates: Date[]; hubs: string[]; values: number[];
  isParceiro: boolean; isMotorista: boolean; isHeavy: boolean;
  perfil: string; perfilCor: string; localFreq: string;
}
interface DREConfig {
  modelo: "investidor" | "propria"; pctEspaco: number; pctImposto: number;
  pctApp: number; fixoInternet: number; fixoAluguel: number;
  energiaTipo: "incluido" | "kwh" | "usina"; energiaKwh: number; usinaFixo: number;
  invNome: string; invPct: number; invTotal: number; invPago: number;
  invDividaPrio: number; invAmort: number;
  propriaInstalacao: number; propriaAmort: number; solarProprio: boolean;
}
type Tab = "dash" | "dre" | "usuarios" | "acoes" | "config";

const T = {
  bg:"#080a0f", bg1:"#0d1017", bg2:"#121620", bg3:"#181d28",
  border:"rgba(255,255,255,0.07)", border2:"rgba(255,255,255,0.12)",
  green:"#00e5a0", greenDim:"rgba(0,229,160,0.15)",
  amber:"#f59e0b", red:"#ef4444", blue:"#3b82f6",
  text:"#e8edf5", text2:"#6b7fa3", text3:"#2d3a52",
  mono:"'JetBrains Mono', monospace", sans:"'Space Grotesk', sans-serif",
} as const;

function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}
function parseDate(s: string): Date | null {
  const m = s.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function parseHour(s: string): number | null {
  const ms = s.match(/(\d{1,2}):(\d{2})/g);
  if (!ms) return null;
  const last = ms[ms.length - 1].match(/(\d{1,2})/);
  return last ? +last[1] : null;
}
function parseDurMin(s: string): number | null {
  if (!s) return null;
  const m1 = s.match(/(\d+)h\s*(\d+)\s*min/i);
  if (m1) return +m1[1] * 60 + +m1[2];
  const m2 = s.match(/^(\d+):(\d{2})$/);
  if (m2) return +m2[1] * 60 + +m2[2];
  return null;
}
function parseLine(line: string): string[] {
  const r: string[] = []; let cur = "", inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { r.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  r.push(cur.trim()); return r;
}
function parseCSV(text: string): Session[] {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Arquivo vazio");
  const hdr = parseLine(lines[0]);
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  const iData=idx(/^data$/), iLocal=idx(/^local$/), iUser=idx(/usu/), iChrg=idx(/carregador/);
  const iEn=idx(/^energia$/), iVal=idx(/^valor$/), iStart=idx(/inicio|in.cio/);
  const iEndC=idx(/fim do car/), iEndT=idx(/fim da trans/), iDur=idx(/dura/), iSt=idx(/recarga/);
  const sessions: Session[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const g = (j: number) => j >= 0 && cols[j] ? cols[j].trim() : "";
    const date = parseDate(g(iData));
    if (!date) continue;
    const energy = parseNum(g(iEn));
    const value = parseNum(g(iVal));
    const cancelled = /cancel/i.test(g(iSt)) || (energy === 0 && value === 0);
    const endCStr = g(iEndC), endTStr = g(iEndT);
    let overstayMin: number | null = null;
    const toMOD = (s: string) => { const ms2 = s.match(/(\d{1,2}):(\d{2})/g); if (!ms2) return null; const x = ms2[ms2.length-1].match(/(\d+):(\d+)/); return x ? +x[1]*60 + +x[2] : null; };
    const ec = toMOD(endCStr), et = toMOD(endTStr);
    if (ec !== null && et !== null && et > ec) overstayMin = et - ec;
    sessions.push({ date, hub: g(iLocal)||"Desconhecida", user: g(iUser)||"—", charger: g(iChrg), energy, value, duration: g(iDur), durMin: parseDurMin(g(iDur)), overstayMin, startHour: parseHour(g(iStart)), status: g(iSt), cancelled });
  }
  if (!sessions.length) throw new Error("Nenhuma sessão encontrada");
  return sessions;
}

const brl = (n: number) => "R$\u00a0" + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n-1) + "…" : s; }

function heatColor(val: number, max: number): string {
  if (val === 0) return "rgba(15,17,23,0.9)";
  const t = val / max;
  if (t < 0.33) return `rgba(0,${Math.round(100 + t/0.33*80)},${Math.round(100 + t/0.33*60)},0.8)`;
  if (t < 0.66) return `rgba(${Math.round((t-0.33)/0.33*200)},200,80,0.8)`;
  return `rgba(255,${Math.round(200-(t-0.66)/0.34*160)},${Math.round(80-(t-0.66)/0.34*60)},0.9)`;
}

function classificarUsuarios(sessions: Session[]): UserData[] {
  const datas = sessions.map(s => s.date.getTime());
  const periodDays = Math.max(1, Math.round((Math.max(...datas) - Math.min(...datas)) / 86400000) + 1);
  const periodWeeks = periodDays / 7;
  const userMap: Record<string, UserData> = {};
  sessions.forEach(s => {
    if (!userMap[s.user]) userMap[s.user] = { user: s.user, sess: 0, kwh: 0, rev: 0, dates: [], hubs: [], values: [], isParceiro: false, isMotorista: false, isHeavy: false, perfil: "", perfilCor: "", localFreq: "" };
    const u = userMap[s.user];
    u.sess++; u.kwh += s.energy; u.rev += s.value; u.dates.push(s.date); u.hubs.push(s.hub); u.values.push(s.value);
  });
  return Object.values(userMap).map(u => {
    const temGratis = u.values.some(v => v === 0);
    const mediaKwh = u.kwh > 0 ? u.rev / u.kwh : 999;
    const isParceiro = temGratis || mediaKwh < 1.00;
    const recPorSemana = u.sess / Math.max(1, periodWeeks);
    const isMotorista = !isParceiro && (recPorSemana > 2.5 || u.kwh > 150);
    const isHeavy = !isParceiro && !isMotorista && (u.kwh > 80 || u.sess >= 4);
    const stCount: Record<string, number> = {};
    u.hubs.forEach(h => { stCount[h] = (stCount[h] || 0) + 1; });
    const localFreq = Object.entries(stCount).sort((a, b) => b[1]-a[1])[0]?.[0] || "—";
    let perfil = "🟢 Shopper", perfilCor = "#22c55e";
    if (isParceiro) { perfil = "🔵 Parceiro"; perfilCor = "#3b82f6"; }
    else if (isMotorista) { perfil = "🔴 Motorista"; perfilCor = "#ef4444"; }
    else if (isHeavy) { perfil = "🟡 Heavy User"; perfilCor = "#eab308"; }
    return { ...u, isParceiro, isMotorista, isHeavy, perfil, perfilCor, localFreq };
  });
}

function dreSimples(anual: number): number {
  if (anual <= 180000) return 6.0;
  if (anual <= 360000) return 11.2;
  if (anual <= 720000) return 13.5;
  if (anual <= 1800000) return 16.0;
  if (anual <= 3600000) return 21.0;
  return 33.0;
}

// ─── ALERTAS ──────────────────────────────────────────────────────────────────
interface Alerta {
  tipo: "crit" | "warn" | "ok";
  icon: string;
  titulo: string;
  desc: string;
}

function calcAlertas(sessions: Session[]): { semaforo: "verde"|"amarelo"|"vermelho"; alertas: Alerta[] } {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const cancelled = sessions.filter(s => s.cancelled);
  if (!ok.length) return { semaforo: "vermelho", alertas: [] };

  const days = new Set(ok.map(s => s.date.toDateString())).size || 1;
  const totalRev = ok.reduce((a, s) => a + s.value, 0);
  const totalKwh = ok.reduce((a, s) => a + s.energy, 0);
  const avgSessDay = ok.length / days;
  const avgRevDay = totalRev / days;
  const avgKwhDay = totalKwh / days;
  const cancelRate = sessions.length > 0 ? cancelled.length / sessions.length : 0;
  const withOv = ok.filter(s => s.overstayMin !== null && s.overstayMin > 0);
  const avgOv = withOv.length > 0 ? withOv.reduce((a, s) => a + (s.overstayMin||0), 0) / withOv.length : 0;
  const ticket = ok.length > 0 ? totalRev / ok.length : 0;

  const alertas: Alerta[] = [];

  // Sessões/dia
  if (avgSessDay >= 12) alertas.push({ tipo:"ok", icon:"✅", titulo:"Sessões no alvo", desc:`${avgSessDay.toFixed(1)} sess/dia — acima da meta de 12/dia` });
  else if (avgSessDay >= 8) alertas.push({ tipo:"warn", icon:"⚠️", titulo:"Sessões abaixo da meta", desc:`${avgSessDay.toFixed(1)} sess/dia — meta é 12/dia` });
  else alertas.push({ tipo:"crit", icon:"🔴", titulo:"Volume crítico de sessões", desc:`${avgSessDay.toFixed(1)} sess/dia — muito abaixo da meta` });

  // Receita/dia
  if (avgRevDay >= 350) alertas.push({ tipo:"ok", icon:"✅", titulo:"Receita no alvo", desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia — acima da meta de R$\u00a0350` });
  else if (avgRevDay >= 250) alertas.push({ tipo:"warn", icon:"⚠️", titulo:"Receita abaixo da meta", desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia — meta é R$\u00a0350/dia` });
  else alertas.push({ tipo:"crit", icon:"🔴", titulo:"Receita crítica", desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia — investigar tarifação` });

  // Cancelamentos
  if (cancelRate <= 0.08) alertas.push({ tipo:"ok", icon:"✅", titulo:"Cancelamentos sob controle", desc:`${(cancelRate*100).toFixed(1)}% — dentro do limite de 8%` });
  else if (cancelRate <= 0.15) alertas.push({ tipo:"warn", icon:"⚠️", titulo:"Cancelamentos elevados", desc:`${(cancelRate*100).toFixed(1)}% — acima de 8%, investigar` });
  else alertas.push({ tipo:"crit", icon:"🔴", titulo:"Cancelamentos críticos", desc:`${(cancelRate*100).toFixed(1)}% — verificar OCPP e autenticação` });

  // Overstay
  if (avgOv === 0) alertas.push({ tipo:"ok", icon:"✅", titulo:"Sem overstay registrado", desc:"Nenhum veículo parado após fim da carga" });
  else if (avgOv <= 5) alertas.push({ tipo:"ok", icon:"✅", titulo:"Overstay dentro do limite", desc:`Média de ${avgOv.toFixed(1)} min — abaixo de 5 min` });
  else if (avgOv <= 15) alertas.push({ tipo:"warn", icon:"⚠️", titulo:"Overstay elevado", desc:`Média de ${avgOv.toFixed(1)} min — meta é < 5 min` });
  else alertas.push({ tipo:"crit", icon:"🔴", titulo:"Overstay crítico", desc:`Média de ${avgOv.toFixed(1)} min — implementar taxa de ocupação` });

  // kWh/dia
  if (avgKwhDay < 100) alertas.push({ tipo:"crit", icon:"🔴", titulo:"Energia crítica", desc:`${avgKwhDay.toFixed(0)} kWh/dia — possível falha de equipamento` });
  else if (avgKwhDay < 180) alertas.push({ tipo:"warn", icon:"⚠️", titulo:"Energia abaixo do esperado", desc:`${avgKwhDay.toFixed(0)} kWh/dia — meta é ≥ 300 kWh/dia` });

  // Ticket médio
  if (ticket < 20) alertas.push({ tipo:"warn", icon:"⚠️", titulo:"Ticket médio baixo", desc:`R$\u00a0${ticket.toFixed(2).replace(".",",")} por sessão — meta é R$\u00a030+` });

  const crits = alertas.filter(a => a.tipo === "crit").length;
  const warns = alertas.filter(a => a.tipo === "warn").length;
  const semaforo = crits > 0 ? "vermelho" : warns >= 2 ? "amarelo" : warns === 1 ? "amarelo" : "verde";

  return { semaforo, alertas };
}

function Semaforo({ sessions }: { sessions: Session[] }) {
  const { semaforo, alertas } = useMemo(() => calcAlertas(sessions), [sessions]);

  const cores = {
    verde:    { bg: "rgba(0,229,160,0.08)",  border: "rgba(0,229,160,0.25)",  dot: "#00e5a0", label: "Operação Normal",    sub: "Todos os indicadores dentro das metas" },
    amarelo:  { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", dot: "#f59e0b", label: "Atenção",            sub: "Alguns indicadores fora da meta" },
    vermelho: { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  dot: "#ef4444", label: "Alertas Críticos",  sub: "Indicadores críticos detectados" },
  };
  const c = cores[semaforo];
  const emoji = semaforo === "verde" ? "🟢" : semaforo === "amarelo" ? "🟡" : "🔴";

  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Semáforo principal */}
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, cursor: "pointer", marginBottom: expanded ? 10 : 0, transition: "all 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</div>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 700, color: c.dot }}>{c.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text2, marginTop: 3 }}>{c.sub}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["crit","warn","ok"].map(tipo => {
              const count = alertas.filter(a => a.tipo === tipo).length;
              if (!count) return null;
              const color = tipo === "crit" ? T.red : tipo === "warn" ? T.amber : T.green;
              return (
                <span key={tipo} style={{ fontFamily: T.mono, fontSize: 10, padding: "2px 9px", borderRadius: 20, background: `${color}20`, color, border: `1px solid ${color}40` }}>
                  {tipo === "crit" ? "🔴" : tipo === "warn" ? "⚠️" : "✅"} {count}
                </span>
              );
            })}
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.text3 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Lista de alertas */}
      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
          {alertas.map((a, i) => {
            const color = a.tipo === "crit" ? T.red : a.tipo === "warn" ? T.amber : T.green;
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{a.icon}</span>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, color, marginBottom: 2 }}>{a.titulo}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, lineHeight: 1.5 }}>{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, accent = "#00e5a0", small }: { label: string; value: string; sub?: string; accent?: string; small?: boolean }) {
  return (
    <div style={{ background: "#121620", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6b7fa3", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: small ? 20 : 26, fontWeight: 700, color: accent, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2d3a52" }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2d3a52", letterSpacing: "0.18em", textTransform: "uppercase" as const, margin: "28px 0 14px" }}>
      {children}
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#121620", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px", ...style }}>
      {children}
    </div>
  );
}

const TH: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2d3a52", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.07)", fontWeight: 500 };
const THR: React.CSSProperties = { ...TH, textAlign: "right" };
const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12, verticalAlign: "middle", color: "#e8edf5" };
const TDR: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" };

function CustomTooltip({ active, payload, label, suffix = "" }: { active?: boolean; payload?: {value: number; color: string}[]; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#181d28", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
      <div style={{ color: "#6b7fa3", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#00e5a0" }}>
          {suffix === "R$" ? "R$\u00a0" + p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : `${p.value.toFixed(1)} ${suffix}`}
        </div>
      ))}
    </div>
  );
}

function UploadScreen({ onFile }: { onFile: (s: Session[]) => void }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const process = useCallback((file: File) => {
    const r = new FileReader();
    r.onload = e => { try { onFile(parseCSV(e.target?.result as string)); } catch (ex: unknown) { setErr((ex as Error).message); } };
    r.readAsText(file, "UTF-8");
  }, [onFile]);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, background: "#00e5a0", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⚡</div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", color: "#e8edf5" }}>HertzGo</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6b7fa3", letterSpacing: "0.18em", textTransform: "uppercase" }}>Vision · Painel Operacional</div>
          </div>
        </div>
      </div>
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) process(f); }}
        onClick={() => inputRef.current?.click()}
        style={{ width: "100%", maxWidth: 520, background: drag ? "rgba(0,229,160,0.06)" : "#0d1017", border: `1.5px dashed ${drag ? "#00e5a0" : "rgba(255,255,255,0.12)"}`, borderRadius: 24, padding: "48px 40px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#e8edf5" }}>Carregar CSV do Spott</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7fa3", lineHeight: 1.8, marginBottom: 24 }}>
          Arraste ou clique para selecionar<br />
          <span style={{ color: "#00e5a0" }}>Multi-estação · Qualquer período · Formato Spott</span>
        </div>
        <div style={{ display: "inline-block", padding: "10px 28px", background: "#00e5a0", color: "#080a0f", borderRadius: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 }}>Selecionar arquivo</div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) process(e.target.files[0]); }} />
      {err && <div style={{ marginTop: 16, padding: "10px 18px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>❌ {err}</div>}
    </div>
  );
}

function TabDashboard({ sessions }: { sessions: Session[] }) {
  const [activeHub, setActiveHub] = useState("__all__");
  const hubs = useMemo(() => Array.from(new Set(sessions.map(s => s.hub))).sort(), [sessions]);
  const filtered = useMemo(() => activeHub === "__all__" ? sessions : sessions.filter(s => s.hub === activeHub), [sessions, activeHub]);
  const ok = filtered.filter(s => !s.cancelled && s.energy > 0);
  const totalRev = ok.reduce((a, s) => a + s.value, 0);
  const totalKwh = ok.reduce((a, s) => a + s.energy, 0);
  const totalSess = ok.length;
  const days = new Set(ok.map(s => s.date.toDateString())).size || 1;
  const ticket = totalSess > 0 ? totalRev / totalSess : 0;
  const priceKwh = totalKwh > 0 ? totalRev / totalKwh : 0;
  const dts = ok.map(s => s.date.getTime());
  const minDate = dts.length ? new Date(Math.min(...dts)) : new Date();
  const maxDate = dts.length ? new Date(Math.max(...dts)) : new Date();
  const byDay: Record<string, { date: Date; rev: number; kwh: number; sess: number }> = {};
  ok.forEach(s => { const k = s.date.toDateString(); if (!byDay[k]) byDay[k] = { date: s.date, rev: 0, kwh: 0, sess: 0 }; byDay[k].rev += s.value; byDay[k].kwh += s.energy; byDay[k].sess++; });
  const dayArr = Object.values(byDay).sort((a, b) => a.date.getTime() - b.date.getTime());
  const dayData = dayArr.map(d => ({ date: fmtDate(d.date), rev: +d.rev.toFixed(2), kwh: +d.kwh.toFixed(0) }));
  const avgRev = totalRev / days;
  const hubMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach(s => { if (!hubMap[s.hub]) hubMap[s.hub] = { rev: 0, kwh: 0, sess: 0 }; hubMap[s.hub].rev += s.value; hubMap[s.hub].kwh += s.energy; hubMap[s.hub].sess++; });
  const hubData = Object.entries(hubMap).sort((a, b) => b[1].rev - a[1].rev).map(([name, d]) => ({ name: trunc(name, 20), rev: +d.rev.toFixed(0) }));
  const userMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach(s => { if (!userMap[s.user]) userMap[s.user] = { rev: 0, kwh: 0, sess: 0 }; userMap[s.user].rev += s.value; userMap[s.user].kwh += s.energy; userMap[s.user].sess++; });
  const top5 = Object.entries(userMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
  const hourData = Array(24).fill(0).map(() => ({ sess: 0, kwh: 0 }));
  ok.forEach(s => { if (s.startHour !== null) { hourData[s.startHour].sess++; hourData[s.startHour].kwh += s.energy; } });
  const maxHour = Math.max(...hourData.map(h => h.sess), 1);
  return (
    <div style={{ padding: "24px 28px" }}>
      {hubs.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {["__all__", ...hubs].map(h => (
            <button key={h} onClick={() => setActiveHub(h)} style={{ padding: "5px 14px", borderRadius: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, cursor: "pointer", border: `1px solid ${activeHub === h ? "#00e5a0" : "rgba(255,255,255,0.12)"}`, background: activeHub === h ? "rgba(0,229,160,0.15)" : "transparent", color: activeHub === h ? "#00e5a0" : "#6b7fa3", transition: "all 0.18s" }}>
              {h === "__all__" ? `🌐 Todas (${hubs.length})` : `📍 ${trunc(h, 22)}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6b7fa3", marginBottom: 16 }}>📅 {fmtDate(minDate)} → {fmtDate(maxDate)} · {days} dias · {totalSess} sessões</div>

      {/* SEMÁFORO — aparece aqui, antes dos KPIs */}
      <Semaforo sessions={filtered} />

      <SectionLabel>KPIs do Período</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Faturamento Bruto" value={brl(totalRev)} sub={`R$\u00a0${(totalRev/days).toFixed(0)}/dia`} accent="#00e5a0" />
        <KpiCard label="Energia Entregue" value={`${totalKwh.toFixed(0)} kWh`} sub={`${(totalKwh/days).toFixed(0)} kWh/dia`} accent="#f59e0b" />
        <KpiCard label="Total Sessões" value={`${totalSess}`} sub={`${(totalSess/days).toFixed(1)} sess/dia`} accent="#3b82f6" />
        <KpiCard label="Preço Médio / kWh" value={`R$\u00a0${priceKwh.toFixed(2).replace(".",",")}`} sub={`Ticket: ${brl(ticket)}`} accent="#ef4444" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 28 }}>
        <Panel>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 18, color: "#e8edf5" }}>Faturamento por Hub</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hubData} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#2d3a52", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: "#2d3a52", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<CustomTooltip suffix="R$" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="rev" fill="rgba(0,229,160,0.65)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 18, color: "#e8edf5" }}>Top 5 Usuários</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH}>#</th><th style={TH}>Usuário</th><th style={THR}>Sess.</th><th style={THR}>Total</th></tr></thead>
            <tbody>
              {top5.map(([name, d], i) => {
                const rc = ["#f59e0b","#94a3b8","#b47c3c"][i] || "#2d3a52";
                return (
                  <tr key={name}>
                    <td style={TD}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: rc, fontSize: 11 }}>{i+1}</span></td>
                    <td style={TD}><span style={{ fontSize: 12, fontWeight: 500 }}>{trunc(name, 16)}</span></td>
                    <td style={TDR}><span style={{ background: "rgba(0,229,160,0.15)", color: "#00e5a0", padding: "2px 7px", borderRadius: 5, fontSize: 10 }}>{d.sess}</span></td>
                    <td style={{ ...TDR, color: "#00e5a0", fontWeight: 600 }}>{brl(d.rev)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
      <SectionLabel>Receita Diária</SectionLabel>
      <Panel style={{ marginBottom: 28 }}>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={dayData}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: "#2d3a52", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `R$${v.toLocaleString("pt-BR",{minimumFractionDigits:0})}`} tick={{ fill: "#2d3a52", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip suffix="R$" />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
            <ReferenceLine y={avgRev} stroke="rgba(245,158,11,0.4)" strokeDasharray="5 4" strokeWidth={1.5} />
            <Line dataKey="rev" stroke="#00e5a0" strokeWidth={2} dot={{ r: 3, fill: "#00e5a0" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <SectionLabel>Heatmap de Atividade por Hora</SectionLabel>
      <Panel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 3 }}>
          {hourData.map((h, hr) => (
            <div key={hr} title={`${hr}h: ${h.sess} sessões`} style={{ height: 36, borderRadius: 4, background: heatColor(h.sess, maxHour), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "rgba(255,255,255,0.8)", cursor: "default" }}>
              {h.sess > 0 ? h.sess : ""}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 3, marginTop: 4 }}>
          {Array.from({ length: 24 }, (_, hr) => (
            <div key={hr} style={{ fontSize: 8, color: "#2d3a52", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>{hr}h</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TabUsuarios({ sessions }: { sessions: Session[] }) {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const users = useMemo(() => classificarUsuarios(ok), [ok]);
  const sorted = [...users].sort((a, b) => b.rev - a.rev);
  const totalRev = ok.reduce((a, s) => a + s.value, 0);
  const parceiros = users.filter(u => u.isParceiro);
  const motoristas = users.filter(u => u.isMotorista);
  const heavys = users.filter(u => u.isHeavy);
  const shoppers = users.filter(u => !u.isParceiro && !u.isMotorista && !u.isHeavy);
  const pieData = [
    { name: "Motoristas", value: motoristas.length, color: "#ef4444" },
    { name: "Heavy", value: heavys.length, color: "#f59e0b" },
    { name: "Shoppers", value: shoppers.length, color: "#22c55e" },
    { name: "Parceiros", value: parceiros.length, color: "#3b82f6" },
  ].filter(d => d.value > 0);
  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Total Usuários" value={`${users.length}`} sub="únicos no período" accent="#00e5a0" />
        <KpiCard label="Motoristas App" value={`${motoristas.length}`} sub="alvos prioritários" accent="#ef4444" />
        <KpiCard label="Heavy Users" value={`${heavys.length}`} sub="potencial upgrade" accent="#f59e0b" />
        <KpiCard label="Parceiros" value={`${parceiros.length}`} sub="blindados" accent="#3b82f6" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 28 }}>
        <Panel>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#e8edf5" }}>Segmentação</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} usuários`, n]} contentStyle={{ background: "#181d28", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
            {pieData.map(d => <span key={d.name} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: d.color }}>■ {d.name}</span>)}
          </div>
        </Panel>
        <Panel>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#e8edf5" }}>Receita por Segmento</div>
          {[
            { label: "🔴 Motoristas", rev: motoristas.reduce((a,u)=>a+u.rev,0), color: "#ef4444" },
            { label: "🟡 Heavy Users", rev: heavys.reduce((a,u)=>a+u.rev,0), color: "#f59e0b" },
            { label: "🟢 Shoppers", rev: shoppers.reduce((a,u)=>a+u.rev,0), color: "#22c55e" },
            { label: "🔵 Parceiros", rev: parceiros.reduce((a,u)=>a+u.rev,0), color: "#3b82f6" },
          ].map(seg => {
            const pct = totalRev > 0 ? (seg.rev/totalRev)*100 : 0;
            return (
              <div key={seg.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginBottom: 5 }}>
                  <span style={{ color: "#6b7fa3" }}>{seg.label}</span>
                  <span style={{ color: seg.color, fontWeight: 600 }}>{brl(seg.rev)} <span style={{ color: "#2d3a52" }}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div style={{ height: 4, background: "#181d28", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: seg.color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </Panel>
      </div>
      <SectionLabel>Torre de Controle — Todos os Usuários</SectionLabel>
      <Panel style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={TH}>#</th><th style={TH}>Perfil</th><th style={TH}>Usuário</th>
            <th style={TH}>Hub Principal</th><th style={THR}>Sess.</th>
            <th style={THR}>kWh</th><th style={THR}>Receita</th><th style={THR}>Part. %</th>
          </tr></thead>
          <tbody>
            {sorted.map((u, i) => {
              const pct = totalRev > 0 ? (u.rev/totalRev*100).toFixed(1) : "0.0";
              const maxRev = sorted[0]?.rev || 1;
              const barW = (u.rev/maxRev*100).toFixed(1);
              const bgRow = u.isParceiro ? "rgba(59,130,246,0.04)" : u.isMotorista ? "rgba(239,68,68,0.04)" : u.isHeavy ? "rgba(234,179,8,0.03)" : "";
              return (
                <tr key={u.user} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", background: bgRow }}>
                  <td style={{ ...TD, color: "#2d3a52", width: 32, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{i+1}</td>
                  <td style={TD}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${u.perfilCor}20`, color: u.perfilCor, fontFamily: "'JetBrains Mono', monospace" }}>{u.perfil}</span></td>
                  <td style={TD}><span style={{ fontWeight: 500, fontSize: 12 }}>{trunc(u.user, 20)}</span>{u.isParceiro && <span style={{ fontSize: 9, marginLeft: 6, color: "#3b82f6" }}>🔒</span>}</td>
                  <td style={{ ...TD, fontSize: 11, color: "#6b7fa3" }}>{trunc(u.localFreq, 22)}</td>
                  <td style={TDR}><span style={{ background: "rgba(0,229,160,0.15)", color: "#00e5a0", padding: "2px 7px", borderRadius: 5, fontSize: 10 }}>{u.sess}</span></td>
                  <td style={{ ...TDR, color: "#6b7fa3" }}>{u.kwh.toFixed(1)}</td>
                  <td style={{ ...TDR, color: "#00e5a0", fontWeight: 600 }}>{brl(u.rev)}</td>
                  <td style={TDR}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 9, color: "#2d3a52" }}>{pct}%</span>
                      <div style={{ width: 60, height: 3, background: "#181d28", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barW}%`, background: "#00e5a0", borderRadius: 2 }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function TabDRE({ sessions }: { sessions: Session[] }) {
  const hubs = useMemo(() => Array.from(new Set(sessions.map(s => s.hub))).sort(), [sessions]);
  const [station, setStation] = useState(hubs[0] || "");
  const [cfg, setCfg] = useState<DREConfig>({
    modelo: "investidor", pctEspaco: 50, pctImposto: 7, pctApp: 7,
    fixoInternet: 260, fixoAluguel: 0, energiaTipo: "incluido",
    energiaKwh: 0, usinaFixo: 208.37,
    invNome: "FL BR SOLUÇÕES SUSTENTÁVEIS LTDA", invPct: 50,
    invTotal: 150000, invPago: 100000, invDividaPrio: 14705.39,
    invAmort: 1846.49, propriaInstalacao: 100000, propriaAmort: 0, solarProprio: false,
  });
  const stF = (s: Session) => s.hub === station || s.hub.toLowerCase().includes((station||"").toLowerCase().split(" ").pop()||"");
  const sessoes = sessions.filter(s => !s.cancelled && s.energy > 0 && stF(s));
  const datas = sessoes.map(s => s.date.getTime());
  const dtMin = datas.length ? new Date(Math.min(...datas)) : new Date();
  const dtMax = datas.length ? new Date(Math.max(...datas)) : new Date();
  const periodDays = Math.max(1, Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const bruto = sessoes.reduce((a,s)=>a+s.value,0);
  const totalKwh = sessoes.reduce((a,s)=>a+s.energy,0);
  const diasNoMes = 30;
  const faturMensal = bruto/periodDays*diasNoMes;
  const faturAnual = faturMensal*12;
  const aliq = cfg.modelo==="propria" ? dreSimples(faturAnual) : cfg.pctImposto;
  const impostoVal = bruto*(aliq/100);
  const custoEspaco = bruto*(cfg.pctEspaco/100);
  const custoApp = bruto*(cfg.pctApp/100);
  let custoEnergia = 0;
  if (!cfg.solarProprio) { if (cfg.energiaTipo==="kwh") custoEnergia=totalKwh*cfg.energiaKwh; if (cfg.energiaTipo==="usina") custoEnergia=cfg.usinaFixo; }
  const fixos = cfg.fixoInternet+cfg.fixoAluguel;
  const ll = bruto-custoEspaco-impostoVal-custoApp-custoEnergia-fixos;
  const margem = bruto>0?(ll/bruto)*100:0;
  const repInv = cfg.modelo==="investidor"?ll*(cfg.invPct/100):0;
  const repHz = cfg.modelo==="investidor"?ll*((100-cfg.invPct)/100):ll;
  const retMensalInv = repInv/periodDays*diasNoMes;
  const rentAnual = cfg.invTotal>0?(repInv/cfg.invTotal)*100*(diasNoMes/periodDays)*12:0;
  const restPrio = Math.max(0,cfg.invDividaPrio-cfg.invAmort);
  const restInv = Math.max(0,(cfg.invTotal-cfg.invPago)-Math.max(0,cfg.invAmort-cfg.invDividaPrio));
  let amPrio=0,amInv=0,disp=repInv;
  if (cfg.modelo==="investidor") { if(restPrio>0){amPrio=Math.min(disp,restPrio);disp-=amPrio;} if(restInv>0){amInv=Math.min(disp,restInv);disp-=amInv;} }
  const faltaAmort = Math.max(0,cfg.invTotal-(cfg.invAmort+amPrio+amInv));
  const mesesPay = retMensalInv>0?faltaAmort/retMensalInv:Infinity;
  const tot = cfg.invDividaPrio+(cfg.invTotal-cfg.invPago);
  const pMat = tot>0?Math.min(100,(Math.min(cfg.invAmort,cfg.invDividaPrio)/tot)*100):0;
  const pPrev = tot>0?Math.min(100,(Math.max(0,cfg.invAmort-cfg.invDividaPrio)/tot)*100):0;
  const pCur = tot>0?Math.min(100,((amPrio+amInv)/tot)*100):0;
  const inp = (id: keyof DREConfig, label: string, type: "number"|"text"|"select", opts?: string[]) => (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6b7fa3", marginBottom: 4 }}>{label}</div>
      {type==="select" ? (
        <select value={cfg[id] as string} onChange={e=>setCfg(p=>({...p,[id]:e.target.value}))} style={{ width:"100%",background:"#181d28",border:"1px solid rgba(255,255,255,0.07)",color:"#e8edf5",padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono', monospace" }}>
          {opts?.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} min={0} value={cfg[id] as string|number} onChange={e=>setCfg(p=>({...p,[id]:type==="number"?+e.target.value:e.target.value}))} style={{ width:"100%",background:"#181d28",border:"1px solid rgba(255,255,255,0.07)",color:"#e8edf5",padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono', monospace" }} />
      )}
    </div>
  );
  const dreRows = [
    { label:"(+) Receita Bruta", val:bruto, bold:true },
    cfg.pctEspaco>0?{ label:`(−) Parceiro Espaço (${cfg.pctEspaco}%)`, val:-custoEspaco }:null,
    { label:`(−) Imposto (${aliq.toFixed(1)}%${cfg.modelo==="propria"?" Simples":" bruto"})`, val:-impostoVal },
    { label:`(−) App/Plataforma (${cfg.pctApp}%)`, val:-custoApp },
    cfg.energiaTipo!=="incluido"?{ label:"(−) Energia", val:-custoEnergia }:null,
    cfg.fixoAluguel>0?{ label:"(−) Aluguel", val:-cfg.fixoAluguel }:null,
    cfg.fixoInternet>0?{ label:"(−) Internet / Adm", val:-cfg.fixoInternet }:null,
    { label:"= Lucro Líquido", val:ll, bold:true, sep:true },
    cfg.modelo==="investidor"?{ label:`→ ${cfg.invNome||"Investidor"} (${cfg.invPct}%)`, val:repInv, accent:"#f59e0b" }:null,
    { label:`→ HertzGo (${cfg.modelo==="investidor"?100-cfg.invPct:100}%)`, val:repHz, accent:"#00e5a0" },
  ].filter(Boolean) as { label:string; val:number; bold?:boolean; sep?:boolean; accent?:string }[];
  return (
    <div style={{ padding:"24px 28px" }}>
      {sessoes.length>0&&(
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28 }}>
          <KpiCard label="Receita Bruta" value={brl(bruto)} sub={`${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`} accent="#00e5a0" />
          <KpiCard label="Lucro Líquido" value={brl(ll)} sub={`Margem ${margem.toFixed(1)}%`} accent={ll>=0?"#00e5a0":"#ef4444"} />
          <KpiCard label="Proj. Mensal" value={brl(faturMensal)} sub="base 30 dias" accent="#f59e0b" />
          <KpiCard label="Proj. Anual" value={brl(faturAnual)} sub="receita bruta" accent="#3b82f6" />
        </div>
      )}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>
        <Panel>
          <div style={{ fontFamily:"'Space Grotesk', sans-serif",fontSize:15,fontWeight:600,marginBottom:20,color:"#e8edf5" }}>⚙️ Configuração</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",marginBottom:4 }}>Estação</div>
              <select value={station} onChange={e=>setStation(e.target.value)} style={{ width:"100%",background:"#181d28",border:"1px solid rgba(255,255,255,0.07)",color:"#e8edf5",padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono', monospace" }}>
                {hubs.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            {inp("modelo","Modelo","select",["investidor","propria"])}
            {inp("pctEspaco","% Parceiro Espaço","number")}
            {inp("pctImposto","% Imposto","number")}
            {inp("pctApp","% App/Plataforma","number")}
            {inp("fixoInternet","Internet / Adm (R$)","number")}
            {inp("fixoAluguel","Aluguel (R$)","number")}
            {inp("energiaTipo","Custo Energia","select",["incluido","kwh","usina"])}
            {cfg.energiaTipo==="kwh"&&inp("energiaKwh","R$ / kWh","number")}
            {cfg.energiaTipo==="usina"&&inp("usinaFixo","Custo Usina (R$)","number")}
          </div>
          {cfg.modelo==="investidor"&&(
            <>
              <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52",letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"16px 0 10px",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:14 }}>Investidor / Split</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                {inp("invNome","Nome Investidor","text")}
                {inp("invPct","% Investidor do LL","number")}
                {inp("invTotal","Investimento Total","number")}
                {inp("invPago","Já Investido","number")}
                {inp("invDividaPrio","Dívida Prioritária","number")}
                {inp("invAmort","Já Amortizado","number")}
              </div>
            </>
          )}
          {cfg.modelo==="propria"&&(
            <>
              <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52",letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"16px 0 10px",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:14 }}>Loja Própria</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                {inp("propriaInstalacao","Custo Instalação","number")}
                {inp("propriaAmort","Já Amortizado","number")}
              </div>
            </>
          )}
          <label style={{ display:"flex",alignItems:"center",gap:8,marginTop:14,cursor:"pointer",fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:"#6b7fa3" }}>
            <input type="checkbox" checked={cfg.solarProprio} onChange={e=>setCfg(p=>({...p,solarProprio:e.target.checked}))} style={{ accentColor:"#ffd600",width:14,height:14 }} />
            ☀️ Investidor com Usina Solar Própria (energia = R$0)
          </label>
        </Panel>
        <div>
          <Panel style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"'Space Grotesk', sans-serif",fontSize:15,fontWeight:600,marginBottom:16,color:"#e8edf5" }}>📋 DRE — {trunc(station,24)}</div>
            {sessoes.length===0?(
              <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:12,color:"#2d3a52",padding:"24px 0",textAlign:"center" }}>Nenhuma sessão encontrada para esta estação.</div>
            ):(
              <table style={{ width:"100%",borderCollapse:"collapse",fontFamily:"'JetBrains Mono', monospace",fontSize:12 }}>
                <thead><tr><th style={TH}>Item</th><th style={THR}>Período</th><th style={THR}>Proj. Mensal</th><th style={THR}>%</th></tr></thead>
                <tbody>
                  {dreRows.map((r,i)=>(
                    <tr key={i} style={{ borderTop:r.sep?"1px solid rgba(255,255,255,0.07)":"none",borderBottom:"1px solid rgba(255,255,255,0.02)" }}>
                      <td style={{ ...TD,fontWeight:r.bold?700:400,color:r.accent||(r.val>=0?"#e8edf5":"#ef4444") }}>{r.label}</td>
                      <td style={{ ...TDR,color:r.accent||(r.val>=0?"#00e5a0":"#ef4444"),fontWeight:r.bold?700:400 }}>{brl(r.val)}</td>
                      <td style={{ ...TDR,color:"#6b7fa3" }}>{brl(r.val*(diasNoMes/periodDays))}</td>
                      <td style={{ ...TDR,color:"#2d3a52" }}>{bruto>0?`${(Math.abs(r.val)/bruto*100).toFixed(1)}%`:"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          {cfg.modelo==="investidor"&&sessoes.length>0&&(
            <Panel>
              <div style={{ fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:14,color:"#e8edf5" }}>👤 Painel do Investidor</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
                <KpiCard label="Retorno Período" value={brl(repInv)} sub={`${brl(retMensalInv)}/mês proj.`} accent="#f59e0b" small />
                <KpiCard label="Rentabilidade Anual" value={`${rentAnual.toFixed(1)}%`} sub="sobre capital total" accent={rentAnual>=12?"#00e5a0":"#f59e0b"} small />
                <KpiCard label="Payback Estimado" value={mesesPay===Infinity?"—":mesesPay<12?`${Math.ceil(mesesPay)} meses`:`${(mesesPay/12).toFixed(1)} anos`} sub="para amortizar saldo" accent={mesesPay<=36?"#00e5a0":"#f59e0b"} small />
                <KpiCard label="Saldo Devedor" value={faltaAmort<=0?"✅ Quitado":brl(faltaAmort)} sub={faltaAmort<=0?"Payback completo!":"restante"} accent={faltaAmort<=0?"#00e5a0":"#ef4444"} small />
              </div>
              <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",marginBottom:8 }}>📊 Progresso do Payback</div>
              <div style={{ background:"#181d28",borderRadius:6,height:22,overflow:"hidden",position:"relative",border:"1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${pMat}%`,background:"rgba(239,68,68,0.7)" }} />
                <div style={{ position:"absolute",left:`${pMat}%`,top:0,height:"100%",width:`${pPrev}%`,background:"rgba(245,158,11,0.6)" }} />
                <div style={{ position:"absolute",left:`${pMat+pPrev}%`,top:0,height:"100%",width:`${pCur}%`,background:"rgba(0,229,160,0.8)" }} />
                <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontFamily:"'JetBrains Mono', monospace",color:"#fff",fontWeight:600 }}>{(pMat+pPrev+pCur).toFixed(1)}% amortizado</div>
              </div>
              <div style={{ display:"flex",gap:12,marginTop:6,fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52" }}>
                <span><span style={{ color:"#ef4444" }}>■</span> Materiais</span>
                <span><span style={{ color:"#f59e0b" }}>■</span> Anterior</span>
                <span><span style={{ color:"#00e5a0" }}>■</span> Este período</span>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function TabAcoes({ sessions }: { sessions: Session[] }) {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const users = useMemo(() => classificarUsuarios(ok), [ok]);
  const [zapiStatus, setZapiStatus] = useState<"unknown"|"ok"|"err">("unknown");
  const [log, setLog] = useState<{ts:string;nome:string;status:"ok"|"err";msg?:string}[]>([]);
  const [sending, setSending] = useState<Record<string,boolean>>({});
  useEffect(() => {
    fetch("/api/zapi").then(r=>r.json()).then(d=>{ setZapiStatus(d.configured&&d.connected?"ok":"err"); }).catch(()=>setZapiStatus("err"));
  }, []);
  const leads = users.filter(u => !u.isParceiro);
  const enviar = async (user: string, nome: string, hub: string) => {
    setSending(p=>({...p,[user]:true}));
    const local = hub.toLowerCase().includes("costa")?"Costa Atacadão":hub.toLowerCase().includes("park")?"Park Way":hub.toLowerCase().includes("cidade")?"Cidade do Automóvel":hub;
    const msg = `Olá ${nome}! 👋\n\nSomos da HertzGo (app iVCharge). Vi que você carrega muito no ${local}.\n\nVocê é motorista de app? 🚗⚡`;
    try {
      const r = await fetch("/api/zapi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:user,message:msg})});
      const d = await r.json();
      setLog(p=>[{ts:new Date().toLocaleTimeString("pt-BR"),nome,status:d.ok?"ok":"err",msg:d.erro},...p.slice(0,49)]);
    } catch { setLog(p=>[{ts:new Date().toLocaleTimeString("pt-BR"),nome,status:"err",msg:"Erro de rede"},...p.slice(0,49)]); }
    setSending(p=>({...p,[user]:false}));
  };
  return (
    <div style={{ padding:"24px 28px" }}>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28 }}>
        <KpiCard label="Z-API Status" value={zapiStatus==="ok"?"✅ Conectada":zapiStatus==="err"?"⚠️ Verificar":"⏳ Testando"} sub="via API Route Vercel" accent={zapiStatus==="ok"?"#00e5a0":"#f59e0b"} small />
        <KpiCard label="Total Leads" value={`${leads.length}`} sub="não parceiros" accent="#ef4444" small />
        <KpiCard label="Motoristas" value={`${users.filter(u=>u.isMotorista).length}`} sub="alta prioridade" accent="#ef4444" small />
        <KpiCard label="Enviados (sessão)" value={`${log.filter(l=>l.status==="ok").length}`} sub="confirmados hoje" accent="#00e5a0" small />
      </div>
      {zapiStatus==="err"&&(
        <div style={{ background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"14px 18px",marginBottom:20,fontFamily:"'JetBrains Mono', monospace",fontSize:12,color:"#f59e0b" }}>
          ⚠️ Configure no Vercel: <strong>ZAPI_INSTANCE_ID</strong> · <strong>ZAPI_TOKEN</strong> · <strong>ZAPI_CLIENT_TOKEN</strong>
        </div>
      )}
      <SectionLabel>Leads — Disparo via Z-API</SectionLabel>
      <Panel style={{ padding:0,overflow:"hidden" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr>
            <th style={TH}>Perfil</th><th style={TH}>Usuário</th><th style={TH}>Hub</th>
            <th style={THR}>kWh</th><th style={THR}>Receita</th><th style={THR}>Ação</th>
          </tr></thead>
          <tbody>
            {leads.slice(0,50).map(u=>(
              <tr key={u.user} style={{ borderBottom:"1px solid rgba(255,255,255,0.02)" }}>
                <td style={TD}><span style={{ fontSize:10,padding:"2px 8px",borderRadius:4,background:`${u.perfilCor}20`,color:u.perfilCor,fontFamily:"'JetBrains Mono', monospace" }}>{u.perfil}</span></td>
                <td style={TD}><span style={{ fontWeight:500 }}>{trunc(u.user,22)}</span></td>
                <td style={{ ...TD,fontSize:11,color:"#6b7fa3" }}>{trunc(u.localFreq,20)}</td>
                <td style={{ ...TDR,color:"#6b7fa3" }}>{u.kwh.toFixed(1)}</td>
                <td style={{ ...TDR,color:"#00e5a0",fontWeight:600 }}>{brl(u.rev)}</td>
                <td style={TDR}>
                  <button onClick={()=>enviar(u.user,u.user.split(" ")[0],u.localFreq)} disabled={sending[u.user]}
                    style={{ padding:"4px 12px",borderRadius:6,fontFamily:"'JetBrains Mono', monospace",fontSize:10,cursor:sending[u.user]?"not-allowed":"pointer",background:sending[u.user]?"rgba(255,255,255,0.05)":"rgba(0,229,160,0.15)",border:`1px solid ${sending[u.user]?"rgba(255,255,255,0.07)":"rgba(0,229,160,0.3)"}`,color:sending[u.user]?"#2d3a52":"#00e5a0",transition:"all 0.2s" }}>
                    {sending[u.user]?"⏳":"📤 Enviar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {log.length>0&&(
        <>
          <SectionLabel>Histórico de Disparos</SectionLabel>
          <Panel style={{ maxHeight:200,overflowY:"auto" }}>
            {log.map((l,i)=>(
              <div key={i} style={{ display:"flex",gap:12,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontFamily:"'JetBrains Mono', monospace",fontSize:11 }}>
                <span style={{ color:"#2d3a52" }}>{l.ts}</span>
                <span style={{ color:l.status==="ok"?"#00e5a0":"#ef4444" }}>{l.status==="ok"?"✅":"❌"}</span>
                <span style={{ color:"#e8edf5" }}>{l.nome}</span>
                {l.msg&&<span style={{ color:"#ef4444",fontSize:10 }}>{l.msg}</span>}
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}

function TabConfig() {
  return (
    <div style={{ padding:"24px 28px" }}>
      <SectionLabel>Variáveis de Ambiente — Vercel</SectionLabel>
      <Panel style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:16,color:"#e8edf5" }}>📱 Z-API — WhatsApp</div>
        <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:12,color:"#6b7fa3",lineHeight:1.8,marginBottom:16 }}>
          Acesse: <strong style={{ color:"#e8edf5" }}>hertzgo-vision.vercel.app → Settings → Environment Variables</strong>
        </div>
        {[
          { key:"ZAPI_INSTANCE_ID", desc:"Z-API → Instâncias → ID" },
          { key:"ZAPI_TOKEN", desc:"Z-API → Instâncias → Token" },
          { key:"ZAPI_CLIENT_TOKEN", desc:"Z-API → Conta → Security → Client-Token" },
        ].map(v=>(
          <div key={v.key} style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,alignItems:"center",marginBottom:10,padding:"10px 14px",background:"#181d28",borderRadius:10,border:"1px solid rgba(255,255,255,0.07)" }}>
            <code style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:12,color:"#00e5a0",fontWeight:600 }}>{v.key}</code>
            <span style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3" }}>{v.desc}</span>
          </div>
        ))}
        <div style={{ background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 14px",fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:"#93c5fd",marginTop:12 }}>
          ℹ️ Credenciais seguras no servidor. O browser nunca vê o token. Disparos passam pela API Route <code style={{ color:"#00e5a0" }}>/api/zapi</code>.
        </div>
      </Panel>
      <SectionLabel>Versão</SectionLabel>
      <Panel>
        <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:"#6b7fa3",lineHeight:2 }}>
          <div>⚡ <strong style={{ color:"#e8edf5" }}>HertzGo Vision v2.1</strong></div>
          <div>🏗️ Next.js 14 · React · Recharts · Z-API proxy seguro via Vercel</div>
          <div>📊 Dashboard · Alertas Semáforo · DRE · Usuários · Ações · Config</div>
        </div>
      </Panel>
    </div>
  );
}

export default function HertzGo() {
  useFonts();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [tab, setTab] = useState<Tab>("dash");
  const dts = sessions ? sessions.map(s => s.date.getTime()) : [];
  const okSess = sessions ? sessions.filter(s => !s.cancelled && s.energy > 0).length : 0;
  const uniqHubs = sessions ? new Set(sessions.map(s => s.hub)).size : 0;
  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id:"dash", label:"Dashboard", icon:"📊" },
    { id:"usuarios", label:"Usuários", icon:"👥" },
    { id:"dre", label:"DRE", icon:"💼" },
    { id:"acoes", label:"Ações", icon:"🎯" },
    { id:"config", label:"Config", icon:"⚙️" },
  ];
  if (!sessions) {
    return (
      <div style={{ minHeight:"100vh",background:"#080a0f",color:"#e8edf5",fontFamily:"'Space Grotesk', sans-serif" }}>
        <UploadScreen onFile={setSessions} />
      </div>
    );
  }
  return (
    <div style={{ display:"flex",flexDirection:"column",minHeight:"100vh",background:"#080a0f",color:"#e8edf5",fontFamily:"'Space Grotesk', sans-serif" }}>
      <header style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",height:60,background:"rgba(8,10,15,0.97)",borderBottom:"1px solid rgba(255,255,255,0.07)",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(16px)",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,background:"#00e5a0",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>⚡</div>
          <div>
            <div style={{ fontFamily:"'Space Grotesk', sans-serif",fontSize:16,fontWeight:700,letterSpacing:"-0.03em" }}>HertzGo</div>
            <div style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#6b7fa3",letterSpacing:"0.12em",textTransform:"uppercase" }}>Vision · Rede EV</div>
          </div>
        </div>
        <nav style={{ display:"flex",gap:4 }}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{ padding:"6px 14px",borderRadius:10,fontFamily:"'Space Grotesk', sans-serif",fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${tab===n.id?"#00e5a0":"rgba(255,255,255,0.07)"}`,background:tab===n.id?"rgba(0,229,160,0.15)":"transparent",color:tab===n.id?"#00e5a0":"#6b7fa3",transition:"all 0.2s",boxShadow:tab===n.id?"0 0 16px rgba(0,229,160,0.2)":"none" }}>
              <span style={{ marginRight:5 }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:10,padding:"3px 10px",borderRadius:20,background:"rgba(0,229,160,0.15)",color:"#00e5a0",border:"1px solid rgba(0,229,160,0.2)" }}>{okSess} sessões</span>
          <span style={{ fontFamily:"'JetBrains Mono', monospace",fontSize:10,padding:"3px 10px",borderRadius:20,background:"rgba(59,130,246,0.1)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)" }}>{uniqHubs} hubs</span>
          <button onClick={()=>{setSessions(null);setTab("dash");}} style={{ padding:"4px 12px",borderRadius:20,fontFamily:"'JetBrains Mono', monospace",fontSize:10,cursor:"pointer",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444" }}>↩ Novo CSV</button>
        </div>
      </header>
      <main style={{ flex:1 }}>
        {tab==="dash"&&<TabDashboard sessions={sessions} />}
        {tab==="usuarios"&&<TabUsuarios sessions={sessions} />}
        {tab==="dre"&&<TabDRE sessions={sessions} />}
        {tab==="acoes"&&<TabAcoes sessions={sessions} />}
        {tab==="config"&&<TabConfig />}
      </main>
      <footer style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 28px",background:"rgba(8,10,15,0.97)",borderTop:"1px solid rgba(255,255,255,0.07)",fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#2d3a52",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ width:6,height:6,borderRadius:"50%",background:"#00e5a0",boxShadow:"0 0 6px #00e5a0",display:"inline-block" }} />
          {sessions.length} registros · {okSess} válidos · {uniqHubs} estações
          {dts.length>0&&` · ${new Date(Math.min(...dts)).toLocaleDateString("pt-BR")} → ${new Date(Math.max(...dts)).toLocaleDateString("pt-BR")}`}
        </div>
        <div>⚡ HertzGo Vision v2.1</div>
      </footer>
    </div>
  );
}