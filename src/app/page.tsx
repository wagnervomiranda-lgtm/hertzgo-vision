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
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#f0f2f5",
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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: "28px 28px 0 0" }} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: accent, marginBottom: 6 }}>{value}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a5568" }}>{sub}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a5568",
      letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14,
    }}>
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
    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", padding: "4px 10px", background: "rgba(0,229,160,0.12)", color: "#00e5a0", borderRadius: 6, letterSpacing: "0.06em" }}>
      {children}
    </span>
  );
}

function SessPill({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", background: "rgba(0,229,160,0.12)", color: "#00e5a0", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
      {n}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, { bg: string; color: string }> = {
    1: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    2: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
    3: { bg: "rgba(180,120,60,0.12)", color: "#b47c3c" },
  };
  const s = styles[rank] ?? { bg: "#1a1f28", color: "#4a5568" };
  return (
    <span style={{ width: 24, height: 24, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", background: s.bg, color: s.color }}>
      {rank}
    </span>
  );
}

const TH: React.CSSProperties = { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 500 };
const THR: React.CSSProperties = { ...TH, textAlign: "right" };
const TD: React.CSSProperties = { padding: "11px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12, verticalAlign: "middle" };
const TDR: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" };

function UploadScreen({ onFile }: { onFile: (sessions: Session[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { onFile(parseCSV(e.target?.result as string)); }
      catch (err: any) { setError(err.message); }
    };
    reader.readAsText(file, "UTF-8");
  }, [onFile]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 52px)", fontWeight: 800, letterSpacing: "-0.04
