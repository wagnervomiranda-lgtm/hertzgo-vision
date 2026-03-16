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
  date: Date; hub: string; hubKey: string; user: string; charger: string;
  energy: number; value: number; duration: string;
  durMin: number | null; overstayMin: number | null;
  startHour: number | null; status: string; cancelled: boolean;
  source: "spott" | "move";
}
interface UserData {
  user: string; sess: number; kwh: number; rev: number;
  dates: Date[]; hubs: string[]; hubKeys: string[]; values: number[];
  isParceiro: boolean; isMotorista: boolean; isHeavy: boolean;
  perfil: string; perfilCor: string; localFreq: string; localFreqKey: string;
}
interface DREConfig {
  modelo: "investidor" | "propria"; pctEspaco: number; pctImposto: number;
  pctApp: number; fixoInternet: number; fixoAluguel: number;
  energiaTipo: "incluido" | "kwh" | "usina"; energiaKwh: number; usinaFixo: number;
  invNome: string; invPct: number; invTotal: number; invPago: number;
  invDividaPrio: number; invAmort: number;
  propriaInstalacao: number; propriaAmort: number; solarProprio: boolean;
}
interface ZAPIConfig { instanceId: string; token: string; clientToken: string; }
interface Contatos {
  [estacaoKey: string]: {
    importadoEm: string; total: number; comTelefone: number;
    dados: { nome: string; telefone: string; email?: string }[];
  };
}
interface Mensagens {
  msg1: string; msg2a_parkway: string; msg2a_cidadeauto: string;
  msg2a_vip_parkway: string; msg2a_vip_cidadeauto: string;
  msg2b_costa: string; msg2b_parkway: string; msg2b_cidadeauto: string;
  msg_risco: string; msg_churn: string;
  cupom_parkway: string; cupom_cidadeauto: string; cupom_costa: string; cupom_vip: string;
}
interface AppState {
  metas: Record<string, number>;
  dreConfigs: Record<string, DREConfig>;
  contatos: Contatos;
  mensagens: Mensagens;
  disparos: { ts: string; nome: string; msgId: string; status: "ok" | "err"; msg?: string }[];
  zapi: ZAPIConfig;
}
type Tab = "dash" | "dre" | "usuarios" | "acoes" | "config";

const ESTACAO_MAP: Record<string, string> = {
  "costa atacadão aguas claras": "costa", "hertzgo - costa atacadão": "costa",
  "hertz go 2": "costa", "costa atacadão": "costa", "costa atacadao": "costa",
  "park way": "parkway", "cidade do automóvel": "cidadeauto", "cidade do automovel": "cidadeauto",
  "lava jato do mamute": "mamute", "madeiro & jerônimo": "madeiro",
  "madeiro e gerônimo sia brasília": "madeiro", "madeiro e geronimo sia brasilia": "madeiro",
  "madeiro & geronimo": "madeiro",
};
const ESTACAO_NOME: Record<string, string> = {
  costa: "Costa Atacadão", parkway: "Park Way",
  cidadeauto: "Cidade do Automóvel", mamute: "Lava Jato do Mamute", madeiro: "Madeiro & Jerônimo",
};
const ESTACAO_PROPRIA = ["parkway", "cidadeauto"];
const ESTACAO_PARCERIA = ["costa"];

function hubKey(nome: string): string {
  const n = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const [k, v] of Object.entries(ESTACAO_MAP)) {
    if (n.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return v;
  }
  return n.replace(/\s+/g, "_");
}
function hubNome(key: string): string { return ESTACAO_NOME[key] || key; }

const MSG_DEFAULT: Mensagens = {
  msg1: "Olá [nome]! Sou o Wagner, da HertzGo ⚡\n\nVi que você carregou no [local] — obrigado pela preferência!\n\nVocê é motorista de app? Responde 1 pra SIM ou 2 pra NÃO 🚗",
  msg2a_parkway: "Perfeito [nome]! 🎉\n\nTenho uma condição especial para motoristas de app no Park Way.\n\nLá você carrega mais rápido com nosso DC 80kW, sem fila e com prioridade. Use o cupom [cupom] na sua próxima recarga.\n\nQuer o endereço completo?",
  msg2a_cidadeauto: "Perfeito [nome]! 🎉\n\nTemos uma condição especial para motoristas de app na Cidade do Automóvel.\n\nDC 40kW disponível, rápido e sem fila. Use o cupom [cupom].\n\nQuer o endereço?",
  msg2a_vip_parkway: "Ei [nome], você é um dos nossos motoristas VIP no Park Way! 🏆\n\nComo reconhecimento: [beneficio]\n\nCupom exclusivo: [cupom]",
  msg2a_vip_cidadeauto: "Ei [nome], você é um dos nossos motoristas VIP na Cidade do Automóvel! 🏆\n\nComo reconhecimento: [beneficio]\n\nCupom exclusivo: [cupom]",
  msg2b_costa: "[nome], que bom ter você como cliente do Costa Atacadão! 😊\n\nComo presente: na sua próxima compra no supermercado, apresente o código [cupom] no caixa e ganhe um desconto especial.\n\nAté a próxima recarga! ⚡",
  msg2b_parkway: "[nome], você já é um cliente frequente no Park Way! 🙏\n\nCupom de fidelidade: [cupom]\n\nUse na próxima recarga!",
  msg2b_cidadeauto: "[nome], obrigado por carregar na Cidade do Automóvel! ⚡\n\nCupom de fidelidade: [cupom]\n\nUse na próxima recarga!",
  msg_risco: "[nome], sumiu! Tudo bem com o carro? 😄\n\nFaz uns dias que não te vejo no [local]. Quando quiser carregar, estamos aqui.\n\nSe tiver algum problema com o app, me fala que resolvo pessoalmente.",
  msg_churn: "[nome], saudades! 😊\n\nFaz um tempo que não carrega no [local]. Temos novidades que acho que você vai gostar.\n\nQuer saber?",
  cupom_parkway: "PWVIP10", cupom_cidadeauto: "CAVIP10", cupom_costa: "COSTA10", cupom_vip: "HZVIP",
};

const T = {
  bg: "#080a0f", bg1: "#0d1017", bg2: "#121620", bg3: "#181d28",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.12)",
  green: "#00e5a0", greenDim: "rgba(0,229,160,0.15)",
  amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6",
  text: "#e8edf5", text2: "#6b7fa3", text3: "#2d3a52",
  mono: "'JetBrains Mono', monospace", sans: "'Space Grotesk', sans-serif",
} as const;

const STORAGE_KEY = "hertzgo_vision_v3";
function defaultState(): AppState {
  return {
    metas: {}, dreConfigs: {}, contatos: {}, mensagens: { ...MSG_DEFAULT }, disparos: [],
    zapi: { instanceId: "", token: "", clientToken: "" },
  };
}
function loadState(): AppState {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return { ...defaultState(), ...JSON.parse(s) }; } catch {}
  return defaultState();
}
function saveState(s: AppState) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m1 = s.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  return null;
}
function parseHour(s: string): number | null {
  const ms = s?.match(/(\d{1,2}):(\d{2})/g);
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

function parseSpott(text: string): Session[] {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Arquivo vazio");
  const hdr = parseLine(lines[0]);
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  const iData = idx(/^data$/), iLocal = idx(/^local$/), iUser = idx(/usu/), iChrg = idx(/carregador/);
  const iEn = idx(/^energia$/), iVal = idx(/^valor$/), iStart = idx(/inicio|in.cio/);
  const iEndC = idx(/fim do car/), iEndT = idx(/fim da trans/), iDur = idx(/dura/), iSt = idx(/recarga/);
  const sessions: Session[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const g = (j: number) => j >= 0 && cols[j] ? cols[j].trim() : "";
    const date = parseDate(g(iData));
    if (!date) continue;
    const energy = parseNum(g(iEn)), value = parseNum(g(iVal));
    const cancelled = /cancel/i.test(g(iSt)) || (energy === 0 && value === 0);
    const endCStr = g(iEndC), endTStr = g(iEndT);
    let overstayMin: number | null = null;
    const toMOD = (s: string) => { const ms2 = s.match(/(\d{1,2}):(\d{2})/g); if (!ms2) return null; const x = ms2[ms2.length - 1].match(/(\d+):(\d+)/); return x ? +x[1] * 60 + +x[2] : null; };
    const ec = toMOD(endCStr), et = toMOD(endTStr);
    if (ec !== null && et !== null && et > ec) overstayMin = et - ec;
    const hub = g(iLocal) || "Desconhecida";
    sessions.push({
      date, hub, hubKey: hubKey(hub), user: g(iUser) || "—", charger: g(iChrg),
      energy, value, duration: g(iDur), durMin: parseDurMin(g(iDur)),
      overstayMin, startHour: parseHour(g(iStart)), status: g(iSt), cancelled, source: "spott",
    });
  }
  if (!sessions.length) throw new Error("Nenhuma sessão encontrada");
  return sessions;
}

async function parseMove(file: File): Promise<{ sessions: Session[]; contatos: { nome: string; telefone: string }[] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const hdr: string[] = (rows[0] as unknown[]).map((h: unknown) => String(h || "").toLowerCase());
  const iNome = hdr.findIndex(h => /usu.*nome|nome/i.test(h));
  const iTel = hdr.findIndex(h => /telefone|phone/i.test(h));
  const iEstac = hdr.findIndex(h => /esta.{0,3}o|station/i.test(h));
  const iInicFim = hdr.findIndex(h => /in.cio.*fim|inicio|start/i.test(h));
  const iEn = hdr.findIndex(h => /energia|kwh|energy/i.test(h));
  const iRec = hdr.findIndex(h => /receita|valor|revenue/i.test(h));
  const iCon = hdr.findIndex(h => /conector.*tipo|tipo.*conector/i.test(h));
  const sessions: Session[] = [];
  const contatosMap: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const nome = String(r[iNome] || "").trim();
    const tel = String(r[iTel] || "").replace(/\D/g, "");
    const estac = String(r[iEstac] || "").trim();
    const inicFim = String(r[iInicFim] || "");
    const energy = parseFloat(String(r[iEn] || 0)) || 0;
    const value = parseFloat(String(r[iRec] || 0)) || 0;
    const conType = String(r[iCon] || "").toLowerCase();
    if (!nome || !estac) continue;
    if (nome && tel && tel.length >= 8) contatosMap[nome.toLowerCase()] = tel;
    const datePart = inicFim.split(" - ")[0].trim();
    const dm = datePart.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const date = dm ? new Date(+dm[3], +dm[2] - 1, +dm[1]) : null;
    if (!date) continue;
    const startHour = parseHour(datePart);
    const charger = conType.includes("ccs") ? "DC 120kW" : conType.includes("ac") ? "AC 22kW" : "Move";
    const hub = estac;
    sessions.push({
      date, hub, hubKey: hubKey(hub), user: nome, charger, energy, value,
      duration: "", durMin: null, overstayMin: null,
      startHour, status: value > 0 ? "Finalizado" : "", cancelled: energy === 0 && value === 0,
      source: "move",
    });
  }
  const contatos = Object.entries(contatosMap).map(([nome, tel]) => ({ nome, telefone: tel }));
  return { sessions, contatos };
}

function parseContatos(text: string): { nome: string; telefone: string; email: string; estacaoKey?: string }[] {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const hdr = parseLine(lines[0]).map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const iNome = hdr.findIndex(h => /^usu.rios?$|^nome$/.test(h));
  const iTel = hdr.findIndex(h => /^telefone$|^celular$/.test(h));
  const iEmail = hdr.findIndex(h => /^e?-?mail$/.test(h));
  const iEstac = hdr.findIndex(h => /esta.{0,3}o|local|station/.test(h));
  const iNomeF = iNome >= 0 ? iNome : hdr.findIndex(h => /nom|usu/.test(h));
  const iTelF = iTel >= 0 ? iTel : hdr.findIndex(h => /tel|fone|cel/.test(h));
  if (iTelF < 0) return [];
  const result: { nome: string; telefone: string; email: string; estacaoKey?: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const g = (j: number) => j >= 0 && cols[j] ? cols[j].trim() : "";
    const nome = g(iNomeF), tel = g(iTelF).replace(/\D/g, ""), email = g(iEmail);
    const estacNome = iEstac >= 0 ? g(iEstac) : "";
    if (!nome || tel.length < 8) continue;
    result.push({ nome, telefone: tel, email, estacaoKey: estacNome ? hubKey(estacNome) : undefined });
  }
  return result;
}

// Detecta estação pelo nome do arquivo ou conteúdo
function detectEstacao(filename: string, rows: { estacaoKey?: string }[]): string {
  const fname = filename.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, v] of Object.entries(ESTACAO_MAP)) {
    if (fname.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return v;
  }
  // Tenta pelo conteúdo
  const keys = rows.map(r => r.estacaoKey).filter(Boolean) as string[];
  if (keys.length > 0) {
    const counts: Record<string, number> = {};
    keys.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  return "desconhecida";
}

function calcVipScore(user: string, allOk: Session[]): { score: number; status: "ativo" | "regular" | "em_risco" | "churned"; freqAtual: number; freqAnterior: number; diasSemRecarga: number } {
  const uSess = allOk.filter(s => s.user === user);
  if (!uSess.length) return { score: 0, status: "churned", freqAtual: 0, freqAnterior: 0, diasSemRecarga: 999 };
  const datas = uSess.map(s => s.date.getTime());
  const maxDt = Math.max(...datas), hoje = Date.now();
  const diasSemRecarga = Math.round((hoje - maxDt) / 86400000);
  const semAtualStart = hoje - 7 * 86400000, semAntStart = hoje - 14 * 86400000;
  const freqAtual = uSess.filter(s => s.date.getTime() >= semAtualStart).length;
  const freqAnterior = uSess.filter(s => s.date.getTime() >= semAntStart && s.date.getTime() < semAtualStart).length;
  let score = 0;
  if (diasSemRecarga <= 7) score += 40; else if (diasSemRecarga <= 14) score += 20;
  if (freqAtual >= 2) score += 35; else if (freqAtual >= 1) score += 20;
  const diasCliente = Math.round((hoje - Math.min(...datas)) / 86400000);
  if (diasCliente >= 30) score += 25; else if (diasCliente >= 14) score += 12;
  const status = score >= 76 ? "ativo" : score >= 51 ? "regular" : score >= 26 ? "em_risco" : "churned";
  return { score, status, freqAtual, freqAnterior, diasSemRecarga };
}

const brl = (n: number) => "R$\u00a0" + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlK = (n: number) => n >= 1000 ? `R$\u00a0${(n / 1000).toFixed(1)}k` : brl(n);
const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function heatColor(val: number, max: number): string {
  if (val === 0) return "rgba(15,17,23,0.9)";
  const t = val / max;
  if (t < 0.33) return `rgba(0,${Math.round(100 + t / 0.33 * 80)},${Math.round(100 + t / 0.33 * 60)},0.8)`;
  if (t < 0.66) return `rgba(${Math.round((t - 0.33) / 0.33 * 200)},200,80,0.8)`;
  return `rgba(255,${Math.round(200 - (t - 0.66) / 0.34 * 160)},${Math.round(80 - (t - 0.66) / 0.34 * 60)},0.9)`;
}

function classificarUsuarios(sessions: Session[]): UserData[] {
  const datas = sessions.map(s => s.date.getTime());
  const periodDays = Math.max(1, Math.round((Math.max(...datas) - Math.min(...datas)) / 86400000) + 1);
  const periodWeeks = periodDays / 7;
  const userMap: Record<string, UserData> = {};
  sessions.forEach(s => {
    if (!userMap[s.user]) userMap[s.user] = { user: s.user, sess: 0, kwh: 0, rev: 0, dates: [], hubs: [], hubKeys: [], values: [], isParceiro: false, isMotorista: false, isHeavy: false, perfil: "", perfilCor: "", localFreq: "", localFreqKey: "" };
    const u = userMap[s.user];
    u.sess++; u.kwh += s.energy; u.rev += s.value; u.dates.push(s.date); u.hubs.push(s.hub); u.hubKeys.push(s.hubKey); u.values.push(s.value);
  });
  return Object.values(userMap).map(u => {
    const temGratis = u.values.some(v => v === 0);
    const mediaKwh = u.kwh > 0 ? u.rev / u.kwh : 999;
    const isParceiro = temGratis || mediaKwh < 1.00;
    const recPorSemana = u.sess / Math.max(1, periodWeeks);
    const isMotorista = !isParceiro && (recPorSemana > 2.5 || u.kwh > 150);
    const isHeavy = !isParceiro && !isMotorista && (u.kwh > 80 || u.sess >= 4);
    const stCount: Record<string, number> = {};
    u.hubKeys.forEach(h => { stCount[h] = (stCount[h] || 0) + 1; });
    const localFreqKey = Object.entries(stCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const localFreq = hubNome(localFreqKey) || u.hubs[0] || "—";
    let perfil = "🟢 Shopper", perfilCor = "#22c55e";
    if (isParceiro) { perfil = "🔵 Parceiro"; perfilCor = "#3b82f6"; }
    else if (isMotorista) { perfil = "🔴 Motorista"; perfilCor = "#ef4444"; }
    else if (isHeavy) { perfil = "🟡 Heavy User"; perfilCor = "#eab308"; }
    return { ...u, isParceiro, isMotorista, isHeavy, perfil, perfilCor, localFreq, localFreqKey };
  });
}

function dreSimples(anual: number): number {
  if (anual <= 180000) return 6.0; if (anual <= 360000) return 11.2; if (anual <= 720000) return 13.5;
  if (anual <= 1800000) return 16.0; if (anual <= 3600000) return 21.0; return 33.0;
}

interface Alerta { tipo: "crit" | "warn" | "ok"; icon: string; titulo: string; desc: string; }
function calcAlertas(sessions: Session[]): { semaforo: "verde" | "amarelo" | "vermelho"; alertas: Alerta[] } {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const cancelled = sessions.filter(s => s.cancelled);
  if (!ok.length) return { semaforo: "vermelho", alertas: [] };
  const days = new Set(ok.map(s => s.date.toDateString())).size || 1;
  const totalRev = ok.reduce((a, s) => a + s.value, 0);
  const totalKwh = ok.reduce((a, s) => a + s.energy, 0);
  const avgSessDay = ok.length / days, avgRevDay = totalRev / days, avgKwhDay = totalKwh / days;
  const cancelRate = sessions.length > 0 ? cancelled.length / sessions.length : 0;
  const withOv = ok.filter(s => s.overstayMin !== null && s.overstayMin > 0);
  const avgOv = withOv.length > 0 ? withOv.reduce((a, s) => a + (s.overstayMin || 0), 0) / withOv.length : 0;
  const ticket = ok.length > 0 ? totalRev / ok.length : 0;
  const alertas: Alerta[] = [];
  if (avgSessDay >= 12) alertas.push({ tipo: "ok", icon: "✅", titulo: "Sessões no alvo", desc: `${avgSessDay.toFixed(1)} sess/dia` });
  else if (avgSessDay >= 8) alertas.push({ tipo: "warn", icon: "⚠️", titulo: "Sessões abaixo da meta", desc: `${avgSessDay.toFixed(1)}/dia — meta 12` });
  else alertas.push({ tipo: "crit", icon: "🔴", titulo: "Volume crítico", desc: `${avgSessDay.toFixed(1)}/dia` });
  if (avgRevDay >= 350) alertas.push({ tipo: "ok", icon: "✅", titulo: "Receita no alvo", desc: `R$\u00a0${avgRevDay.toFixed(0)}/dia` });
  else if (avgRevDay >= 250) alertas.push({ tipo: "warn", icon: "⚠️", titulo: "Receita abaixo da meta", desc: `R$\u00a0${avgRevDay.toFixed(0)}/dia` });
  else alertas.push({ tipo: "crit", icon: "🔴", titulo: "Receita crítica", desc: `R$\u00a0${avgRevDay.toFixed(0)}/dia` });
  if (cancelRate <= 0.08) alertas.push({ tipo: "ok", icon: "✅", titulo: "Cancelamentos ok", desc: `${(cancelRate * 100).toFixed(1)}%` });
  else if (cancelRate <= 0.15) alertas.push({ tipo: "warn", icon: "⚠️", titulo: "Cancelamentos elevados", desc: `${(cancelRate * 100).toFixed(1)}%` });
  else alertas.push({ tipo: "crit", icon: "🔴", titulo: "Cancelamentos críticos", desc: `${(cancelRate * 100).toFixed(1)}%` });
  if (avgOv === 0 || avgOv <= 5) alertas.push({ tipo: "ok", icon: "✅", titulo: "Overstay ok", desc: avgOv === 0 ? "Sem overstay" : `${avgOv.toFixed(1)} min` });
  else if (avgOv <= 15) alertas.push({ tipo: "warn", icon: "⚠️", titulo: "Overstay elevado", desc: `${avgOv.toFixed(1)} min` });
  else alertas.push({ tipo: "crit", icon: "🔴", titulo: "Overstay crítico", desc: `${avgOv.toFixed(1)} min` });
  if (avgKwhDay < 100) alertas.push({ tipo: "crit", icon: "🔴", titulo: "Energia crítica", desc: `${avgKwhDay.toFixed(0)} kWh/dia` });
  else if (avgKwhDay < 180) alertas.push({ tipo: "warn", icon: "⚠️", titulo: "Energia baixa", desc: `${avgKwhDay.toFixed(0)} kWh/dia` });
  if (ticket < 20) alertas.push({ tipo: "warn", icon: "⚠️", titulo: "Ticket baixo", desc: `R$\u00a0${ticket.toFixed(2).replace(".", ",")}` });
  const crits = alertas.filter(a => a.tipo === "crit").length;
  const warns = alertas.filter(a => a.tipo === "warn").length;
  return { semaforo: crits > 0 ? "vermelho" : warns >= 1 ? "amarelo" : "verde", alertas };
}

function KpiCard({ label, value, sub, accent = "#00e5a0", small }: { label: string; value: string; sub?: string; accent?: string; small?: boolean }) {
  return (
    <div style={{ background: "#121620", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ fontFamily: T.mono, fontSize: 10, color: "#6b7fa3", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: small ? 20 : 26, fontWeight: 700, color: accent, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.mono, fontSize: 10, color: "#2d3a52" }}>{sub}</div>}
    </div>
  );
}
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.mono, fontSize: 9, color: "#2d3a52", letterSpacing: "0.18em", textTransform: "uppercase" as const, margin: "28px 0 14px" }}>
      {children}<div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#121620", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px", ...style }}>{children}</div>;
}
const TH: React.CSSProperties = { fontFamily: T.mono, fontSize: 9, color: "#2d3a52", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.07)", fontWeight: 500 };
const THR: React.CSSProperties = { ...TH, textAlign: "right" };
const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12, verticalAlign: "middle", color: "#e8edf5" };
const TDR: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: T.mono };
function CustomTooltip({ active, payload, label, suffix = "" }: { active?: boolean; payload?: { value: number; color: string }[]; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#181d28", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", fontFamily: T.mono, fontSize: 11 }}>
      <div style={{ color: "#6b7fa3", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || "#00e5a0" }}>{suffix === "R$" ? "R$\u00a0" + p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : `${p.value.toFixed(1)} ${suffix}`}</div>)}
    </div>
  );
}

function Semaforo({ sessions }: { sessions: Session[] }) {
  const { semaforo, alertas } = useMemo(() => calcAlertas(sessions), [sessions]);
  const cores = {
    verde: { bg: "rgba(0,229,160,0.08)", border: "rgba(0,229,160,0.25)", dot: "#00e5a0", label: "Operação Normal", sub: "Todos os indicadores dentro das metas" },
    amarelo: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", dot: "#f59e0b", label: "Atenção", sub: "Alguns indicadores fora da meta" },
    vermelho: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", dot: "#ef4444", label: "Alertas Críticos", sub: "Indicadores críticos detectados" },
  };
  const c = cores[semaforo];
  const emoji = semaforo === "verde" ? "🟢" : semaforo === "amarelo" ? "🟡" : "🔴";
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ marginBottom: 20 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, cursor: "pointer", marginBottom: expanded ? 10 : 0, transition: "all 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</div>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 700, color: c.dot }}>{c.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginTop: 2 }}>{c.sub}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {["crit", "warn", "ok"].map(tipo => {
            const count = alertas.filter(a => a.tipo === tipo).length;
            if (!count) return null;
            const color = tipo === "crit" ? T.red : tipo === "warn" ? T.amber : T.green;
            return <span key={tipo} style={{ fontFamily: T.mono, fontSize: 10, padding: "2px 9px", borderRadius: 20, background: `${color}20`, color, border: `1px solid ${color}40` }}>{tipo === "crit" ? "🔴" : tipo === "warn" ? "⚠️" : "✅"} {count}</span>;
          })}
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.text3 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
          {alertas.map((a, i) => {
            const color = a.tipo === "crit" ? T.red : a.tipo === "warn" ? T.amber : T.green;
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 10 }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{a.icon}</span>
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

function ProjecaoMensal({ sessions, meta, onMetaChange }: { sessions: Session[]; meta: number; onMetaChange: (v: number) => void }) {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  if (!ok.length) return null;
  const days = new Set(ok.map(s => s.date.toDateString())).size || 1;
  const totalRev = ok.reduce((a, s) => a + s.value, 0);
  const totalKwh = ok.reduce((a, s) => a + s.energy, 0);
  const totalSess = ok.length;
  const avgRevDay = totalRev / days, avgKwhDay = totalKwh / days, avgSessDay = totalSess / days;
  const diasNoMes = 30;
  const projRev = avgRevDay * diasNoMes, projKwh = avgKwhDay * diasNoMes, projSess = Math.round(avgSessDay * diasNoMes);
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = ultimoDia - hoje.getDate();
  const diasDecorridos = hoje.getDate();
  const metaDia = meta / diasNoMes;
  const pacingEsperado = metaDia * diasDecorridos;
  const pacingReal = totalRev;
  const pacingDiff = pacingReal - pacingEsperado;
  const pacingPct = pacingEsperado > 0 ? (pacingReal / pacingEsperado) * 100 : 0;
  const faltaMeta = Math.max(0, meta - totalRev);
  const ritmoNecessario = diasRestantes > 0 ? faltaMeta / diasRestantes : 0;
  const ritmoDiff = ritmoNecessario - avgRevDay;
  const pctMeta = meta > 0 ? Math.min(150, (projRev / meta) * 100) : 0;
  const metaColor = pctMeta >= 100 ? T.green : pctMeta >= 75 ? T.amber : T.red;
  const gerarInsight = (): string => {
    if (meta === 0) return "Configure uma meta mensal para ativar o pacing inteligente.";
    if (pctMeta >= 110) return `🚀 Ritmo excelente — projeção ${pctMeta.toFixed(0)}% da meta. Vai superar em R$\u00a0${(projRev - meta).toFixed(0)}.`;
    if (pctMeta >= 100) return `✅ No alvo — mantenha ${avgSessDay.toFixed(1)} sessões/dia.`;
    if (pctMeta >= 75) {
      if (ritmoDiff > 0) return `⚠️ Para bater a meta, precisa de R$\u00a0${ritmoNecessario.toFixed(0)}/dia nos próximos ${diasRestantes} dias — R$\u00a0${ritmoDiff.toFixed(0)}/dia a mais.`;
      return `⚠️ Projeção em ${pctMeta.toFixed(0)}%. Faltam R$\u00a0${faltaMeta.toFixed(0)} — ${diasRestantes} dias.`;
    }
    return `🔴 Ritmo crítico — ${pctMeta.toFixed(0)}% da meta. Precisa de +${Math.ceil(ritmoDiff > 0 ? ritmoDiff / (avgRevDay / avgSessDay) : 2)} sessões/dia.`;
  };
  const [editando, setEditando] = useState(false);
  const [metaInput, setMetaInput] = useState(String(meta));
  return (
    <div style={{ marginBottom: 24, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔮</span>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 700, color: T.text }}>Projeção do Mês</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginTop: 1 }}>base: {avgRevDay.toFixed(0)}/dia · {days} dias no CSV · {diasRestantes} dias restantes</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.text3 }}>Meta:</span>
          {editando ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input autoFocus type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { onMetaChange(+metaInput || 0); setEditando(false); } if (e.key === "Escape") setEditando(false); }}
                style={{ width: 90, background: T.bg3, border: `1px solid ${T.green}`, color: T.text, padding: "4px 8px", borderRadius: 6, fontSize: 12, fontFamily: T.mono }} />
              <button onClick={() => { onMetaChange(+metaInput || 0); setEditando(false); }} style={{ background: T.greenDim, border: `1px solid rgba(0,229,160,0.3)`, color: T.green, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: T.mono }}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setMetaInput(String(meta)); setEditando(true); }} style={{ background: "transparent", border: `1px solid ${T.border}`, color: meta > 0 ? T.amber : T.text3, padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: T.mono, transition: "all 0.2s" }}>
              {meta > 0 ? brlK(meta) : "Definir meta"} ✏️
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: T.border }}>
        {[
          { label: "Receita Projetada", value: brlK(projRev), sub: `R$\u00a0${avgRevDay.toFixed(0)}/dia × 30`, color: metaColor },
          { label: "kWh Projetados", value: `${Math.round(projKwh).toLocaleString("pt-BR")} kWh`, sub: `${avgKwhDay.toFixed(0)} kWh/dia × 30`, color: T.amber },
          { label: "Sessões Projetadas", value: `${projSess}`, sub: `${avgSessDay.toFixed(1)} sess/dia × 30`, color: T.blue },
          { label: "Pacing vs Meta", value: meta > 0 ? `${pacingPct.toFixed(0)}%` : "—", sub: meta > 0 ? (pacingDiff >= 0 ? `▲ R$\u00a0${pacingDiff.toFixed(0)} à frente` : `▼ R$\u00a0${Math.abs(pacingDiff).toFixed(0)} atrás`) : "configure uma meta", color: meta > 0 ? (pacingPct >= 100 ? T.green : pacingPct >= 75 ? T.amber : T.red) : T.text3 },
        ].map((k, i) => (
          <div key={i} style={{ background: T.bg2, padding: "14px 16px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {meta > 0 && (
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 6 }}>
            <span>Projeção vs Meta <span style={{ color: metaColor, fontWeight: 600 }}>{pctMeta.toFixed(0)}%</span></span>
            <span>{brlK(projRev)} <span style={{ color: T.text3 }}>/ meta {brlK(meta)}</span></span>
          </div>
          <div style={{ height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pctMeta)}%`, background: metaColor, borderRadius: 3, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ marginTop: 10, padding: "10px 14px", background: `${metaColor}08`, border: `1px solid ${metaColor}20`, borderRadius: 10, fontFamily: T.mono, fontSize: 11, color: T.text2, lineHeight: 1.6 }}>
            {gerarInsight()}
          </div>
        </div>
      )}
      {meta === 0 && (
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: T.text3, textAlign: "center" }}>
          👆 Clique em <strong style={{ color: T.amber }}>Definir meta</strong> para ativar o pacing inteligente
        </div>
      )}
    </div>
  );
}

function UploadScreen({ onFile }: { onFile: (s: Session[]) => void }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const process = useCallback(async (file: File) => {
    setLoading(true); setErr("");
    try {
      if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        const { sessions } = await parseMove(file);
        onFile(sessions);
      } else {
        const text = await file.text();
        onFile(parseSpott(text));
      }
    } catch (ex: unknown) { setErr((ex as Error).message); }
    setLoading(false);
  }, [onFile]);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, background: "#00e5a0", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⚡</div>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", color: T.text }}>HertzGo</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, letterSpacing: "0.18em", textTransform: "uppercase" }}>Vision · Painel Operacional</div>
          </div>
        </div>
      </div>
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) process(f); }}
        onClick={() => inputRef.current?.click()}
        style={{ width: "100%", maxWidth: 560, background: drag ? "rgba(0,229,160,0.06)" : T.bg1, border: `1.5px dashed ${drag ? T.green : T.border2}`, borderRadius: 24, padding: "48px 40px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{loading ? "⏳" : "📂"}</div>
        <div style={{ fontFamily: T.sans, fontSize: 18, fontWeight: 600, marginBottom: 8, color: T.text }}>{loading ? "Processando..." : "Carregar CSV ou Excel"}</div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text2, lineHeight: 1.8, marginBottom: 24 }}>
          Arraste ou clique para selecionar<br />
          <span style={{ color: T.green }}>Spott CSV · Move XLSX · Multi-estação · Qualquer período</span>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-block", padding: "10px 24px", background: T.green, color: T.bg, borderRadius: 10, fontFamily: T.sans, fontWeight: 700, fontSize: 13 }}>Spott CSV</div>
          <div style={{ display: "inline-block", padding: "10px 24px", background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, fontFamily: T.sans, fontWeight: 700, fontSize: 13 }}>Move XLSX</div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) process(e.target.files[0]); }} />
      {err && <div style={{ marginTop: 16, padding: "10px 18px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: T.red, fontFamily: T.mono, fontSize: 12 }}>❌ {err}</div>}
    </div>
  );
}

function TabDashboard({ sessions, meta, onMetaChange }: { sessions: Session[]; meta: number; onMetaChange: (v: number) => void }) {
  const [activeHub, setActiveHub] = useState("__all__");
  const hubs = useMemo(() => Array.from(new Set(sessions.map(s => s.hubKey))).sort(), [sessions]);
  const filtered = useMemo(() => activeHub === "__all__" ? sessions : sessions.filter(s => s.hubKey === activeHub), [sessions, activeHub]);
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

  // DC vs AC breakdown — especialmente relevante para Costa
  const dcSess = ok.filter(s => /DC/i.test(s.charger));
  const acSess = ok.filter(s => /AC/i.test(s.charger));
  const dcRev = dcSess.reduce((a, s) => a + s.value, 0);
  const acRev = acSess.reduce((a, s) => a + s.value, 0);
  const dcKwh = dcSess.reduce((a, s) => a + s.energy, 0);
  const acKwh = acSess.reduce((a, s) => a + s.energy, 0);

  const byDay: Record<string, { date: Date; rev: number; kwh: number; sess: number }> = {};
  ok.forEach(s => { const k = s.date.toDateString(); if (!byDay[k]) byDay[k] = { date: s.date, rev: 0, kwh: 0, sess: 0 }; byDay[k].rev += s.value; byDay[k].kwh += s.energy; byDay[k].sess++; });
  const dayArr = Object.values(byDay).sort((a, b) => a.date.getTime() - b.date.getTime());
  const dayData = dayArr.map(d => ({ date: fmtDate(d.date), rev: +d.rev.toFixed(2), kwh: +d.kwh.toFixed(0) }));
  const avgRev = totalRev / days;

  const hubMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach(s => { if (!hubMap[s.hubKey]) hubMap[s.hubKey] = { rev: 0, kwh: 0, sess: 0 }; hubMap[s.hubKey].rev += s.value; hubMap[s.hubKey].kwh += s.energy; hubMap[s.hubKey].sess++; });
  const hubData = Object.entries(hubMap).sort((a, b) => b[1].rev - a[1].rev).map(([key, d]) => ({ name: trunc(hubNome(key), 20), rev: +d.rev.toFixed(0) }));

  const userMap: Record<string, { rev: number; kwh: number; sess: number }> = {};
  ok.forEach(s => { if (!userMap[s.user]) userMap[s.user] = { rev: 0, kwh: 0, sess: 0 }; userMap[s.user].rev += s.value; userMap[s.user].kwh += s.energy; userMap[s.user].sess++; });
  const top5 = Object.entries(userMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);

  const hourData = Array(24).fill(0).map(() => ({ sess: 0, kwh: 0 }));
  ok.forEach(s => { if (s.startHour !== null) { hourData[s.startHour].sess++; hourData[s.startHour].kwh += s.energy; } });
  const maxHour = Math.max(...hourData.map(h => h.sess), 1);

  const hasMove = sessions.some(s => s.source === "move");
  const hasSpott = sessions.some(s => s.source === "spott");

  return (
    <div style={{ padding: "24px 28px" }}>
      {hubs.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {["__all__", ...hubs].map(h => (
            <button key={h} onClick={() => setActiveHub(h)} style={{ padding: "5px 14px", borderRadius: 20, fontFamily: T.mono, fontSize: 11, cursor: "pointer", border: `1px solid ${activeHub === h ? T.green : T.border2}`, background: activeHub === h ? T.greenDim : "transparent", color: activeHub === h ? T.green : T.text2, transition: "all 0.18s" }}>
              {h === "__all__" ? `🌐 Todas (${hubs.length})` : `📍 ${hubNome(h)}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 16 }}>
        <span>📅 {fmtDate(minDate)} → {fmtDate(maxDate)} · {days} dias · {totalSess} sessões</span>
        {hasSpott && <span style={{ background: "rgba(0,229,160,0.1)", color: T.green, padding: "2px 8px", borderRadius: 4, fontSize: 9, border: "1px solid rgba(0,229,160,0.2)" }}>Spott</span>}
        {hasMove && <span style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", padding: "2px 8px", borderRadius: 4, fontSize: 9, border: "1px solid rgba(59,130,246,0.2)" }}>Move</span>}
      </div>

      <Semaforo sessions={filtered} />
      <ProjecaoMensal sessions={filtered} meta={meta} onMetaChange={onMetaChange} />

      <SectionLabel>KPIs do Período</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <KpiCard label="Faturamento Bruto" value={brl(totalRev)} sub={`R$\u00a0${(totalRev / days).toFixed(0)}/dia`} accent={T.green} />
        <KpiCard label="Energia Entregue" value={`${totalKwh.toFixed(0)} kWh`} sub={`${(totalKwh / days).toFixed(0)} kWh/dia`} accent={T.amber} />
        <KpiCard label="Total Sessões" value={`${totalSess}`} sub={`${(totalSess / days).toFixed(1)} sess/dia`} accent={T.blue} />
        <KpiCard label="Preço Médio / kWh" value={`R$\u00a0${priceKwh.toFixed(2).replace(".", ",")}`} sub={`Ticket: ${brl(ticket)}`} accent={T.red} />
      </div>

      {/* DC vs AC — sempre visível quando há dados de ambos */}
      {dcSess.length > 0 && acSess.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>⚡ DC 120kW</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: "#a78bfa", padding: "2px 8px", borderRadius: 4, background: "rgba(139,92,246,0.15)" }}>{dcSess.length} sessões</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[{ l: "Receita", v: brl(dcRev) }, { l: "kWh", v: dcKwh.toFixed(0) }, { l: "Ticket", v: brl(dcSess.length > 0 ? dcRev / dcSess.length : 0) }].map((k, i) => (
                <div key={i}><div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginBottom: 3 }}>{k.l}</div><div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{k.v}</div></div>
              ))}
            </div>
            <div style={{ marginTop: 10, height: 3, background: T.bg3, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${totalRev > 0 ? (dcRev / totalRev * 100).toFixed(0) : 0}%`, background: "#a78bfa", borderRadius: 2 }} />
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginTop: 3 }}>{totalRev > 0 ? (dcRev / totalRev * 100).toFixed(0) : 0}% da receita total</div>
          </div>
          <div style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: T.green }}>🔌 AC 22kW</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.green, padding: "2px 8px", borderRadius: 4, background: T.greenDim }}>{acSess.length} sessões</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[{ l: "Receita", v: brl(acRev) }, { l: "kWh", v: acKwh.toFixed(0) }, { l: "Ticket", v: brl(acSess.length > 0 ? acRev / acSess.length : 0) }].map((k, i) => (
                <div key={i}><div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginBottom: 3 }}>{k.l}</div><div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 700, color: T.green }}>{k.v}</div></div>
              ))}
            </div>
            <div style={{ marginTop: 10, height: 3, background: T.bg3, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${totalRev > 0 ? (acRev / totalRev * 100).toFixed(0) : 0}%`, background: T.green, borderRadius: 2 }} />
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginTop: 3 }}>{totalRev > 0 ? (acRev / totalRev * 100).toFixed(0) : 0}% da receita total</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 28 }}>
        <Panel>
          <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, marginBottom: 18, color: T.text }}>Faturamento por Hub</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hubData} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: T.text3, fontSize: 9, fontFamily: T.mono }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: T.text3, fontSize: 9, fontFamily: T.mono }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<CustomTooltip suffix="R$" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="rev" fill="rgba(0,229,160,0.65)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, marginBottom: 18, color: T.text }}>Top 5 Usuários</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH}>#</th><th style={TH}>Usuário</th><th style={THR}>Sess.</th><th style={THR}>Total</th></tr></thead>
            <tbody>
              {top5.map(([name, d], i) => {
                const rc = ["#f59e0b", "#94a3b8", "#b47c3c"][i] || T.text3;
                return (<tr key={name}><td style={TD}><span style={{ fontFamily: T.mono, fontWeight: 700, color: rc, fontSize: 11 }}>{i + 1}</span></td><td style={TD}><span style={{ fontSize: 12, fontWeight: 500 }}>{trunc(name, 16)}</span></td><td style={TDR}><span style={{ background: T.greenDim, color: T.green, padding: "2px 7px", borderRadius: 5, fontSize: 10 }}>{d.sess}</span></td><td style={{ ...TDR, color: T.green, fontWeight: 600 }}>{brl(d.rev)}</td></tr>);
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
            <XAxis dataKey="date" tick={{ fill: T.text3, fontSize: 9, fontFamily: T.mono }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} tick={{ fill: T.text3, fontSize: 9, fontFamily: T.mono }} axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip suffix="R$" />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
            <ReferenceLine y={avgRev} stroke="rgba(245,158,11,0.4)" strokeDasharray="5 4" strokeWidth={1.5} />
            <Line dataKey="rev" stroke={T.green} strokeWidth={2} dot={{ r: 3, fill: T.green }} activeDot={{ r: 5 }} />
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
          {Array.from({ length: 24 }, (_, hr) => (<div key={hr} style={{ fontSize: 8, color: T.text3, textAlign: "center", fontFamily: T.mono }}>{hr}h</div>))}
        </div>
      </Panel>
    </div>
  );
}

function TabUsuarios({ sessions, appState }: { sessions: Session[]; appState: AppState }) {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const users = useMemo(() => classificarUsuarios(ok), [ok]);
  const sorted = [...users].sort((a, b) => b.rev - a.rev);
  const totalRev = ok.reduce((a, s) => a + s.value, 0);
  const parceiros = users.filter(u => u.isParceiro);
  const motoristas = users.filter(u => u.isMotorista);
  const heavys = users.filter(u => u.isHeavy);
  const shoppers = users.filter(u => !u.isParceiro && !u.isMotorista && !u.isHeavy);
  const pieData = [
    { name: "Motoristas", value: motoristas.length, color: T.red },
    { name: "Heavy", value: heavys.length, color: T.amber },
    { name: "Shoppers", value: shoppers.length, color: "#22c55e" },
    { name: "Parceiros", value: parceiros.length, color: T.blue },
  ].filter(d => d.value > 0);

  const telMap: Record<string, string> = {};
  Object.values(appState.contatos).forEach(c => { c.dados.forEach(d => { if (d.telefone) telMap[d.nome.trim().toLowerCase()] = d.telefone; }); });
  const getTel = (nome: string) => { const n = nome.trim().toLowerCase(); if (telMap[n]) return telMap[n]; const found = Object.keys(telMap).find(k => k.includes(n) || n.includes(k)); return found ? telMap[found] : null; };
  const totalComTel = users.filter(u => getTel(u.user)).length;
  const pctCobertura = users.length > 0 ? (totalComTel / users.length * 100).toFixed(0) : "0";

  const vipScores: Record<string, ReturnType<typeof calcVipScore>> = {};
  motoristas.forEach(u => { vipScores[u.user] = calcVipScore(u.user, ok); });

  // Ordenar motoristas: em_risco e churned primeiro
  const vipOrder = { em_risco: 0, churned: 1, regular: 2, ativo: 3 };
  const motoristasOrdenados = [...motoristas].sort((a, b) => {
    const sa = vipScores[a.user]?.status || "ativo";
    const sb = vipScores[b.user]?.status || "ativo";
    return (vipOrder[sa] ?? 3) - (vipOrder[sb] ?? 3);
  });

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Total Usuários" value={`${users.length}`} sub="únicos no período" accent={T.green} />
        <KpiCard label="Motoristas App" value={`${motoristas.length}`} sub="alvos prioritários" accent={T.red} />
        <KpiCard label="Heavy Users" value={`${heavys.length}`} sub="potencial upgrade" accent={T.amber} />
        <KpiCard label="Cobertura Telefone" value={`${pctCobertura}%`} sub={`${totalComTel} de ${users.length} com tel`} accent={+pctCobertura >= 70 ? T.green : T.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 28 }}>
        <Panel>
          <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, marginBottom: 16, color: T.text }}>Segmentação</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} usuários`, n]} contentStyle={{ background: T.bg3, border: `1px solid ${T.border2}`, borderRadius: 8, fontFamily: T.mono, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
            {pieData.map(d => <span key={d.name} style={{ fontFamily: T.mono, fontSize: 10, color: d.color }}>■ {d.name}</span>)}
          </div>
        </Panel>
        <Panel>
          <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, marginBottom: 16, color: T.text }}>Receita por Segmento</div>
          {[
            { label: "🔴 Motoristas", rev: motoristas.reduce((a, u) => a + u.rev, 0), color: T.red },
            { label: "🟡 Heavy Users", rev: heavys.reduce((a, u) => a + u.rev, 0), color: T.amber },
            { label: "🟢 Shoppers", rev: shoppers.reduce((a, u) => a + u.rev, 0), color: "#22c55e" },
            { label: "🔵 Parceiros", rev: parceiros.reduce((a, u) => a + u.rev, 0), color: T.blue },
          ].map(seg => {
            const pct = totalRev > 0 ? (seg.rev / totalRev) * 100 : 0;
            return (
              <div key={seg.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: 11, marginBottom: 5 }}>
                  <span style={{ color: T.text2 }}>{seg.label}</span>
                  <span style={{ color: seg.color, fontWeight: 600 }}>{brl(seg.rev)} <span style={{ color: T.text3 }}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div style={{ height: 4, background: T.bg3, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: seg.color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </Panel>
      </div>

      {motoristas.length > 0 && (
        <>
          <SectionLabel>🏆 VIP Score — Motoristas App</SectionLabel>

          {/* Explicação do VIP Score */}
          <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 10 }}>📊 O que é o VIP Score?</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text2, lineHeight: 1.8, marginBottom: 12 }}>
              Score de 0–100 calculado automaticamente a cada CSV carregado. Mede a saúde do relacionamento com cada motorista.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { status: "🟢 VIP Ativo", score: "76–100", acao: "Reconhecer — não interromper. Enviar MSG VIP se quiser fidelizar mais.", cor: T.green },
                { status: "🟡 Regular", score: "51–75", acao: "Monitorar. Enviar novidade ou benefício quando tiver.", cor: T.amber },
                { status: "🟠 Em Risco", score: "26–50", acao: "AGIR AGORA — frequência caindo. Enviar MSG de reengajamento.", cor: "#fb923c" },
                { status: "🔴 Churn", score: "0–25", acao: "Última tentativa de resgate. Após isso, arquivar.", cor: T.red },
              ].map((s, i) => (
                <div key={i} style={{ background: `${s.cor}08`, border: `1px solid ${s.cor}25`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, color: s.cor, marginBottom: 4 }}>{s.status}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginBottom: 6 }}>Score: {s.score}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, lineHeight: 1.5 }}>{s.acao}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text3, marginTop: 10 }}>
              Critérios: recargou nos últimos 7 dias (+40pts) · 2+ recargas/semana (+35pts) · cliente há 30+ dias (+25pts)
            </div>
          </div>

          <Panel style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: T.border, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              {[
                { label: "🟠 Em Risco", count: motoristas.filter(u => vipScores[u.user]?.status === "em_risco").length, color: "#fb923c" },
                { label: "🔴 Churn", count: motoristas.filter(u => vipScores[u.user]?.status === "churned").length, color: T.red },
                { label: "🟡 Regular", count: motoristas.filter(u => vipScores[u.user]?.status === "regular").length, color: T.amber },
                { label: "🟢 VIP Ativo", count: motoristas.filter(u => vipScores[u.user]?.status === "ativo").length, color: T.green },
              ].map((s, i) => (
                <div key={i} style={{ background: T.bg2, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: T.sans, fontSize: 24, fontWeight: 700, color: s.color }}>{s.count}</div>
                </div>
              ))}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={TH}>Motorista</th><th style={TH}>Hub</th>
                <th style={THR}>Score</th><th style={THR}>Freq/sem</th>
                <th style={THR}>Dias s/ recarga</th><th style={TH}>Status</th><th style={TH}>Telefone</th>
              </tr></thead>
              <tbody>
                {motoristasOrdenados.map(u => {
                  const v = vipScores[u.user];
                  const tel = getTel(u.user);
                  const statusColor = v?.status === "ativo" ? T.green : v?.status === "regular" ? T.amber : v?.status === "em_risco" ? "#fb923c" : T.red;
                  const statusEmoji = v?.status === "ativo" ? "🟢" : v?.status === "regular" ? "🟡" : v?.status === "em_risco" ? "🟠" : "🔴";
                  const bgRow = v?.status === "em_risco" ? "rgba(251,146,60,0.04)" : v?.status === "churned" ? "rgba(239,68,68,0.05)" : "";
                  return (
                    <tr key={u.user} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", background: bgRow }}>
                      <td style={TD}><span style={{ fontWeight: 500 }}>{trunc(u.user, 20)}</span></td>
                      <td style={{ ...TD, fontSize: 11, color: T.text2 }}>{hubNome(u.localFreqKey)}</td>
                      <td style={TDR}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <div style={{ width: 40, height: 4, background: T.bg3, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${v?.score || 0}%`, background: statusColor, borderRadius: 2 }} />
                          </div>
                          <span style={{ color: statusColor, fontWeight: 600, fontSize: 11 }}>{v?.score || 0}</span>
                        </div>
                      </td>
                      <td style={{ ...TDR, color: T.text2 }}>{v?.freqAtual || 0}x</td>
                      <td style={{ ...TDR, color: v && v.diasSemRecarga > 14 ? T.red : v && v.diasSemRecarga > 7 ? T.amber : T.text2 }}>{v?.diasSemRecarga || 0}d</td>
                      <td style={TD}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${statusColor}20`, color: statusColor, fontFamily: T.mono }}>{statusEmoji} {v?.status || "—"}</span></td>
                      <td style={{ ...TD, fontSize: 11, color: tel ? T.green : T.text3 }}>{tel ? `📞 ${tel}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      <SectionLabel>Torre de Controle — Todos os Usuários</SectionLabel>
      <Panel style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={TH}>#</th><th style={TH}>Perfil</th><th style={TH}>Usuário</th>
            <th style={TH}>Hub</th><th style={THR}>Sess.</th>
            <th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Telefone</th>
          </tr></thead>
          <tbody>
            {sorted.map((u, i) => {
              const tel = getTel(u.user);
              const bgRow = u.isParceiro ? "rgba(59,130,246,0.04)" : u.isMotorista ? "rgba(239,68,68,0.04)" : u.isHeavy ? "rgba(234,179,8,0.03)" : "";
              return (
                <tr key={u.user} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", background: bgRow }}>
                  <td style={{ ...TD, color: T.text3, width: 32, fontFamily: T.mono, fontSize: 10 }}>{i + 1}</td>
                  <td style={TD}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${u.perfilCor}20`, color: u.perfilCor, fontFamily: T.mono }}>{u.perfil}</span></td>
                  <td style={TD}><span style={{ fontWeight: 500, fontSize: 12 }}>{trunc(u.user, 20)}</span>{u.isParceiro && <span style={{ fontSize: 9, marginLeft: 6, color: T.blue }}>🔒</span>}</td>
                  <td style={{ ...TD, fontSize: 11, color: T.text2 }}>{hubNome(u.localFreqKey) || u.localFreq}</td>
                  <td style={TDR}><span style={{ background: T.greenDim, color: T.green, padding: "2px 7px", borderRadius: 5, fontSize: 10 }}>{u.sess}</span></td>
                  <td style={{ ...TDR, color: T.text2 }}>{u.kwh.toFixed(1)}</td>
                  <td style={{ ...TDR, color: T.green, fontWeight: 600 }}>{brl(u.rev)}</td>
                  <td style={{ ...TD, fontSize: 11, color: tel ? T.green : T.text3 }}>{tel || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function TabDRE({ sessions, appState, onSaveDRE }: { sessions: Session[]; appState: AppState; onSaveDRE: (key: string, cfg: DREConfig) => void }) {
  const hubs = useMemo(() => Array.from(new Set(sessions.map(s => s.hubKey))).sort(), [sessions]);
  const [station, setStation] = useState(hubs[0] || "");
  const defaultCFG: DREConfig = { modelo: "investidor", pctEspaco: 50, pctImposto: 7, pctApp: 7, fixoInternet: 260, fixoAluguel: 0, energiaTipo: "incluido", energiaKwh: 0, usinaFixo: 208.37, invNome: "FL BR SOLUÇÕES SUSTENTÁVEIS LTDA", invPct: 50, invTotal: 150000, invPago: 100000, invDividaPrio: 14705.39, invAmort: 1846.49, propriaInstalacao: 100000, propriaAmort: 0, solarProprio: false };
  const [cfg, setCfg] = useState<DREConfig>(appState.dreConfigs[station] || defaultCFG);
  useEffect(() => { setCfg(appState.dreConfigs[station] || defaultCFG); }, [station]);

  const stF = (s: Session) => s.hubKey === station;
  const sessoes = sessions.filter(s => !s.cancelled && s.energy > 0 && stF(s));
  const datas = sessoes.map(s => s.date.getTime());
  const dtMin = datas.length ? new Date(Math.min(...datas)) : new Date();
  const dtMax = datas.length ? new Date(Math.max(...datas)) : new Date();
  const periodDays = Math.max(1, Math.round((dtMax.getTime() - dtMin.getTime()) / 86400000) + 1);
  const bruto = sessoes.reduce((a, s) => a + s.value, 0);
  const totalKwh = sessoes.reduce((a, s) => a + s.energy, 0);
  const diasNoMes = 30;
  const faturMensal = bruto / periodDays * diasNoMes, faturAnual = faturMensal * 12;
  const aliq = cfg.modelo === "propria" ? dreSimples(faturAnual) : cfg.pctImposto;
  const impostoVal = bruto * (aliq / 100), custoEspaco = bruto * (cfg.pctEspaco / 100), custoApp = bruto * (cfg.pctApp / 100);
  let custoEnergia = 0;
  if (!cfg.solarProprio) { if (cfg.energiaTipo === "kwh") custoEnergia = totalKwh * cfg.energiaKwh; if (cfg.energiaTipo === "usina") custoEnergia = cfg.usinaFixo; }
  const fixos = cfg.fixoInternet + cfg.fixoAluguel;
  const ll = bruto - custoEspaco - impostoVal - custoApp - custoEnergia - fixos;
  const margem = bruto > 0 ? (ll / bruto) * 100 : 0;
  const repInv = cfg.modelo === "investidor" ? ll * (cfg.invPct / 100) : 0;
  const repHz = cfg.modelo === "investidor" ? ll * ((100 - cfg.invPct) / 100) : ll;
  const retMensalInv = repInv / periodDays * diasNoMes;
  const rentAnual = cfg.invTotal > 0 ? (repInv / cfg.invTotal) * 100 * (diasNoMes / periodDays) * 12 : 0;
  const restPrio = Math.max(0, cfg.invDividaPrio - cfg.invAmort);
  const restInv = Math.max(0, (cfg.invTotal - cfg.invPago) - Math.max(0, cfg.invAmort - cfg.invDividaPrio));
  let amPrio = 0, amInv = 0, disp = repInv;
  if (cfg.modelo === "investidor") { if (restPrio > 0) { amPrio = Math.min(disp, restPrio); disp -= amPrio; } if (restInv > 0) { amInv = Math.min(disp, restInv); disp -= amInv; } }
  const faltaAmort = Math.max(0, cfg.invTotal - (cfg.invAmort + amPrio + amInv));
  const mesesPay = retMensalInv > 0 ? faltaAmort / retMensalInv : Infinity;
  const tot = cfg.invDividaPrio + (cfg.invTotal - cfg.invPago);
  const pMat = tot > 0 ? Math.min(100, (Math.min(cfg.invAmort, cfg.invDividaPrio) / tot) * 100) : 0;
  const pPrev = tot > 0 ? Math.min(100, (Math.max(0, cfg.invAmort - cfg.invDividaPrio) / tot) * 100) : 0;
  const pCur = tot > 0 ? Math.min(100, ((amPrio + amInv) / tot) * 100) : 0;
  const [saved, setSaved] = useState(false);
  const inp = (id: keyof DREConfig, label: string, type: "number" | "text" | "select", opts?: string[]) => (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 4 }}>{label}</div>
      {type === "select" ? (<select value={cfg[id] as string} onChange={e => setCfg(p => ({ ...p, [id]: e.target.value }))} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, color: T.text, padding: "6px 8px", borderRadius: 8, fontSize: 12, fontFamily: T.mono }}>{opts?.map(o => <option key={o} value={o}>{o}</option>)}</select>)
        : (<input type={type} min={0} value={cfg[id] as string | number} onChange={e => setCfg(p => ({ ...p, [id]: type === "number" ? +e.target.value : e.target.value }))} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, color: T.text, padding: "6px 8px", borderRadius: 8, fontSize: 12, fontFamily: T.mono }} />)}
    </div>
  );
  const dreRows = [
    { label: "(+) Receita Bruta", val: bruto, bold: true },
    cfg.pctEspaco > 0 ? { label: `(−) Parceiro Espaço (${cfg.pctEspaco}%)`, val: -custoEspaco } : null,
    { label: `(−) Imposto (${aliq.toFixed(1)}%${cfg.modelo === "propria" ? " Simples" : " bruto"})`, val: -impostoVal },
    { label: `(−) App/Plataforma (${cfg.pctApp}%)`, val: -custoApp },
    cfg.energiaTipo !== "incluido" ? { label: "(−) Energia", val: -custoEnergia } : null,
    cfg.fixoAluguel > 0 ? { label: "(−) Aluguel", val: -cfg.fixoAluguel } : null,
    cfg.fixoInternet > 0 ? { label: "(−) Internet / Adm", val: -cfg.fixoInternet } : null,
    { label: "= Lucro Líquido", val: ll, bold: true, sep: true },
    cfg.modelo === "investidor" ? { label: `→ ${cfg.invNome || "Investidor"} (${cfg.invPct}%)`, val: repInv, accent: T.amber } : null,
    { label: `→ HertzGo (${cfg.modelo === "investidor" ? 100 - cfg.invPct : 100}%)`, val: repHz, accent: T.green },
  ].filter(Boolean) as { label: string; val: number; bold?: boolean; sep?: boolean; accent?: string }[];

  return (
    <div style={{ padding: "24px 28px" }}>
      {sessoes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          <KpiCard label="Receita Bruta" value={brl(bruto)} sub={`${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`} accent={T.green} />
          <KpiCard label="Lucro Líquido" value={brl(ll)} sub={`Margem ${margem.toFixed(1)}%`} accent={ll >= 0 ? T.green : T.red} />
          <KpiCard label="Proj. Mensal" value={brl(faturMensal)} sub="base 30 dias" accent={T.amber} />
          <KpiCard label="Proj. Anual" value={brl(faturAnual)} sub="receita bruta" accent={T.blue} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Panel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 600, color: T.text }}>⚙️ Configuração</div>
            <button onClick={() => { onSaveDRE(station, cfg); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ background: saved ? "rgba(0,229,160,0.2)" : T.greenDim, border: `1px solid ${saved ? T.green : "rgba(0,229,160,0.2)"}`, color: T.green, padding: "5px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: T.mono, transition: "all 0.3s" }}>
              {saved ? "✅ Salvo" : "💾 Salvar"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 4 }}>Estação</div>
              <select value={station} onChange={e => setStation(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, color: T.text, padding: "6px 8px", borderRadius: 8, fontSize: 12, fontFamily: T.mono }}>
                {hubs.map(h => <option key={h} value={h}>{hubNome(h)}</option>)}
              </select>
            </div>
            {inp("modelo", "Modelo", "select", ["investidor", "propria"])}
            {inp("pctEspaco", "% Parceiro Espaço", "number")} {inp("pctImposto", "% Imposto", "number")}
            {inp("pctApp", "% App/Plataforma", "number")} {inp("fixoInternet", "Internet / Adm (R$)", "number")}
            {inp("fixoAluguel", "Aluguel (R$)", "number")} {inp("energiaTipo", "Custo Energia", "select", ["incluido", "kwh", "usina"])}
            {cfg.energiaTipo === "kwh" && inp("energiaKwh", "R$ / kWh", "number")}
            {cfg.energiaTipo === "usina" && inp("usinaFixo", "Custo Usina (R$)", "number")}
          </div>
          {cfg.modelo === "investidor" && (<><div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: "16px 0 10px", borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>Investidor / Split</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{inp("invNome", "Nome Investidor", "text")}{inp("invPct", "% Investidor do LL", "number")}{inp("invTotal", "Investimento Total", "number")}{inp("invPago", "Já Investido", "number")}{inp("invDividaPrio", "Dívida Prioritária", "number")}{inp("invAmort", "Já Amortizado", "number")}</div></>)}
          {cfg.modelo === "propria" && (<><div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: "16px 0 10px", borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>Loja Própria</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{inp("propriaInstalacao", "Custo Instalação", "number")}{inp("propriaAmort", "Já Amortizado", "number")}</div></>)}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer", fontFamily: T.mono, fontSize: 11, color: T.text2 }}>
            <input type="checkbox" checked={cfg.solarProprio} onChange={e => setCfg(p => ({ ...p, solarProprio: e.target.checked }))} style={{ accentColor: "#ffd600", width: 14, height: 14 }} />
            ☀️ Investidor com Usina Solar Própria (energia = R$0)
          </label>
        </Panel>
        <div>
          <Panel style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 600, marginBottom: 16, color: T.text }}>📋 DRE — {hubNome(station)}</div>
            {sessoes.length === 0 ? (<div style={{ fontFamily: T.mono, fontSize: 12, color: T.text3, padding: "24px 0", textAlign: "center" }}>Nenhuma sessão encontrada.</div>) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.mono, fontSize: 12 }}>
                <thead><tr><th style={TH}>Item</th><th style={THR}>Período</th><th style={THR}>Proj. Mensal</th><th style={THR}>%</th></tr></thead>
                <tbody>{dreRows.map((r, i) => (<tr key={i} style={{ borderTop: r.sep ? `1px solid ${T.border}` : "none", borderBottom: "1px solid rgba(255,255,255,0.02)" }}><td style={{ ...TD, fontWeight: r.bold ? 700 : 400, color: r.accent || (r.val >= 0 ? T.text : T.red) }}>{r.label}</td><td style={{ ...TDR, color: r.accent || (r.val >= 0 ? T.green : T.red), fontWeight: r.bold ? 700 : 400 }}>{brl(r.val)}</td><td style={{ ...TDR, color: T.text2 }}>{brl(r.val * (diasNoMes / periodDays))}</td><td style={{ ...TDR, color: T.text3 }}>{bruto > 0 ? `${(Math.abs(r.val) / bruto * 100).toFixed(1)}%` : "—"}</td></tr>))}</tbody>
              </table>
            )}
          </Panel>
          {cfg.modelo === "investidor" && sessoes.length > 0 && (
            <Panel>
              <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, marginBottom: 14, color: T.text }}>👤 Painel do Investidor</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <KpiCard label="Retorno Período" value={brl(repInv)} sub={`${brl(retMensalInv)}/mês proj.`} accent={T.amber} small />
                <KpiCard label="Rentabilidade Anual" value={`${rentAnual.toFixed(1)}%`} sub="sobre capital total" accent={rentAnual >= 12 ? T.green : T.amber} small />
                <KpiCard label="Payback Estimado" value={mesesPay === Infinity ? "—" : mesesPay < 12 ? `${Math.ceil(mesesPay)} meses` : `${(mesesPay / 12).toFixed(1)} anos`} sub="para amortizar saldo" accent={mesesPay <= 36 ? T.green : T.amber} small />
                <KpiCard label="Saldo Devedor" value={faltaAmort <= 0 ? "✅ Quitado" : brl(faltaAmort)} sub={faltaAmort <= 0 ? "Payback completo!" : "restante"} accent={faltaAmort <= 0 ? T.green : T.red} small />
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 8 }}>📊 Progresso do Payback</div>
              <div style={{ background: T.bg3, borderRadius: 6, height: 22, overflow: "hidden", position: "relative", border: `1px solid ${T.border}` }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pMat}%`, background: "rgba(239,68,68,0.7)" }} />
                <div style={{ position: "absolute", left: `${pMat}%`, top: 0, height: "100%", width: `${pPrev}%`, background: "rgba(245,158,11,0.6)" }} />
                <div style={{ position: "absolute", left: `${pMat + pPrev}%`, top: 0, height: "100%", width: `${pCur}%`, background: "rgba(0,229,160,0.8)" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: T.mono, color: "#fff", fontWeight: 600 }}>{(pMat + pPrev + pCur).toFixed(1)}% amortizado</div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontFamily: T.mono, fontSize: 9, color: T.text3 }}>
                <span><span style={{ color: T.red }}>■</span> Materiais</span>
                <span><span style={{ color: T.amber }}>■</span> Anterior</span>
                <span><span style={{ color: T.green }}>■</span> Este período</span>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function TabAcoes({ sessions, appState, onSaveDisparos }: { sessions: Session[]; appState: AppState; onSaveDisparos: (d: AppState["disparos"]) => void }) {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const users = useMemo(() => classificarUsuarios(ok), [ok]);
  const [zapiStatus, setZapiStatus] = useState<"unknown" | "ok" | "err">("unknown");
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [localDisparos, setLocalDisparos] = useState(appState.disparos);

  useEffect(() => { fetch("/api/zapi").then(r => r.json()).then(d => { setZapiStatus(d.configured && d.connected ? "ok" : "err"); }).catch(() => setZapiStatus("err")); }, []);

  const telMap: Record<string, string> = {};
  Object.values(appState.contatos).forEach(c => { c.dados.forEach(d => { if (d.telefone) telMap[d.nome.trim().toLowerCase()] = d.telefone; }); });
  const getTel = (nome: string) => { const n = nome.trim().toLowerCase(); if (telMap[n]) return telMap[n]; const found = Object.keys(telMap).find(k => k.includes(n) || n.includes(k)); return found ? telMap[found] : null; };
  const jaContatado = (nome: string) => localDisparos.some(d => d.nome === nome && d.status === "ok" && (Date.now() - new Date(d.ts).getTime()) < 30 * 86400000);
  const leads = users.filter(u => !u.isParceiro && !jaContatado(u.user));

  const montarMsg = (template: string, nome: string, hubK: string) => template.replace(/\[nome\]/gi, nome.split(" ")[0]).replace(/\[local\]/gi, hubNome(hubK)).replace(/\[cupom\]/gi, "").replace(/\[beneficio\]/gi, "prioridade e desconto exclusivo");

  const enviarUm = async (user: string, hubK: string) => {
    const tel = getTel(user);
    if (!tel) return;
    setSending(p => ({ ...p, [user]: true }));
    const msg = montarMsg(appState.mensagens.msg1, user, hubK);
    try {
      const r = await fetch("/api/zapi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: tel, message: msg }) });
      const d = await r.json();
      const entry = { ts: new Date().toISOString(), nome: user, msgId: "msg1", status: d.ok ? "ok" as const : "err" as const, msg: d.erro };
      const updated = [entry, ...localDisparos.slice(0, 199)];
      setLocalDisparos(updated); onSaveDisparos(updated);
    } catch {
      const entry = { ts: new Date().toISOString(), nome: user, msgId: "msg1", status: "err" as const, msg: "Erro de rede" };
      const updated = [entry, ...localDisparos.slice(0, 199)];
      setLocalDisparos(updated); onSaveDisparos(updated);
    }
    setSending(p => ({ ...p, [user]: false }));
  };

  const enviarLote = async () => {
    const lista = leads.filter(u => selecionados.has(u.user) && getTel(u.user));
    if (!lista.length) { alert("Nenhum usuário selecionado com telefone disponível."); return; }
    if (!confirm(`Disparar MSG 1 para ${lista.length} usuários?\n\nDelay de 3s entre envios.`)) return;
    setEnviandoLote(true);
    for (let i = 0; i < lista.length; i++) {
      await enviarUm(lista[i].user, lista[i].localFreqKey);
      if (i < lista.length - 1) await new Promise(r => setTimeout(r, 3000));
    }
    setSelecionados(new Set());
    setEnviandoLote(false);
  };

  const toggleSel = (user: string) => setSelecionados(prev => { const n = new Set(prev); n.has(user) ? n.delete(user) : n.add(user); return n; });
  const toggleTodos = () => {
    const comTel = leads.filter(u => getTel(u.user)).map(u => u.user);
    setSelecionados(prev => prev.size === comTel.length ? new Set() : new Set(comTel));
  };
  const comTelCount = leads.filter(u => getTel(u.user)).length;

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Z-API Status" value={zapiStatus === "ok" ? "✅ Conectada" : zapiStatus === "err" ? "⚠️ Verificar" : "⏳ Testando"} sub="via API Route Vercel" accent={zapiStatus === "ok" ? T.green : T.amber} small />
        <KpiCard label="Leads p/ MSG 1" value={`${leads.length}`} sub={`${comTelCount} com telefone`} accent={T.red} small />
        <KpiCard label="Gap Zero Ativo" value={`${localDisparos.filter(d => d.status === "ok" && (Date.now() - new Date(d.ts).getTime()) < 30 * 86400000).length}`} sub="contatados 30d" accent={T.amber} small />
        <KpiCard label="Total Enviados" value={`${localDisparos.filter(d => d.status === "ok").length}`} sub="confirmados Z-API" accent={T.green} small />
      </div>

      {zapiStatus === "err" && (<div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontFamily: T.mono, fontSize: 12, color: T.amber }}>⚠️ Configure no Vercel: <strong>ZAPI_INSTANCE_ID</strong> · <strong>ZAPI_TOKEN</strong> · <strong>ZAPI_CLIENT_TOKEN</strong></div>)}

      <SectionLabel>🔴 Fila MSG 1 — Novos Usuários</SectionLabel>

      {/* Barra de ações em lote */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "10px 14px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: T.mono, fontSize: 11, color: T.text2 }}>
          <input type="checkbox" checked={selecionados.size === comTelCount && comTelCount > 0} onChange={toggleTodos} style={{ accentColor: T.green, width: 14, height: 14 }} />
          Selecionar todos com telefone ({comTelCount})
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {selecionados.size > 0 && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.text2 }}>{selecionados.size} selecionado(s)</span>}
          <button onClick={enviarLote} disabled={enviandoLote || selecionados.size === 0}
            style={{ padding: "6px 16px", borderRadius: 8, fontFamily: T.mono, fontSize: 11, cursor: selecionados.size === 0 ? "not-allowed" : "pointer", background: selecionados.size > 0 ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${selecionados.size > 0 ? "rgba(0,229,160,0.3)" : T.border}`, color: selecionados.size > 0 ? T.green : T.text3, transition: "all 0.2s", opacity: enviandoLote ? 0.6 : 1 }}>
            {enviandoLote ? "⏳ Enviando..." : `🚀 Disparar Lote (${selecionados.size})`}
          </button>
        </div>
      </div>

      <Panel style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...TH, width: 20 }}></th>
            <th style={TH}>Perfil</th><th style={TH}>Usuário</th><th style={TH}>Hub</th>
            <th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Telefone</th><th style={THR}>Ação</th>
          </tr></thead>
          <tbody>
            {leads.length === 0 && (<tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: T.text3, padding: "24px" }}>✅ Todos os usuários já foram contatados nos últimos 30 dias</td></tr>)}
            {leads.slice(0, 50).map(u => {
              const tel = getTel(u.user);
              const sel = selecionados.has(u.user);
              return (
                <tr key={u.user} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", background: sel ? "rgba(0,229,160,0.04)" : "" }}>
                  <td style={{ ...TD, width: 20, textAlign: "center" }}>
                    {tel && <input type="checkbox" checked={sel} onChange={() => toggleSel(u.user)} style={{ accentColor: T.green, width: 13, height: 13, cursor: "pointer" }} />}
                  </td>
                  <td style={TD}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${u.perfilCor}20`, color: u.perfilCor, fontFamily: T.mono }}>{u.perfil}</span></td>
                  <td style={TD}><span style={{ fontWeight: 500 }}>{trunc(u.user, 22)}</span></td>
                  <td style={{ ...TD, fontSize: 11, color: T.text2 }}>{hubNome(u.localFreqKey)}</td>
                  <td style={{ ...TDR, color: T.text2 }}>{u.kwh.toFixed(1)}</td>
                  <td style={{ ...TDR, color: T.green, fontWeight: 600 }}>{brl(u.rev)}</td>
                  <td style={{ ...TD, fontSize: 11, color: tel ? T.green : T.text3 }}>{tel || "⚠️ sem telefone"}</td>
                  <td style={TDR}>
                    {tel ? (
                      <button onClick={() => enviarUm(u.user, u.localFreqKey)} disabled={sending[u.user]}
                        style={{ padding: "4px 12px", borderRadius: 6, fontFamily: T.mono, fontSize: 10, cursor: sending[u.user] ? "not-allowed" : "pointer", background: sending[u.user] ? "rgba(255,255,255,0.05)" : T.greenDim, border: `1px solid ${sending[u.user] ? T.border : "rgba(0,229,160,0.3)"}`, color: sending[u.user] ? T.text3 : T.green, transition: "all 0.2s" }}>
                        {sending[u.user] ? "⏳" : "📤 MSG 1"}
                      </button>
                    ) : <span style={{ color: T.text3, fontSize: 10, fontFamily: T.mono }}>sem tel</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {localDisparos.length > 0 && (
        <>
          <SectionLabel>📋 Histórico de Disparos</SectionLabel>
          <Panel style={{ maxHeight: 200, overflowY: "auto" }}>
            {localDisparos.slice(0, 50).map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontFamily: T.mono, fontSize: 11 }}>
                <span style={{ color: T.text3 }}>{new Date(l.ts).toLocaleString("pt-BR")}</span>
                <span style={{ color: l.status === "ok" ? T.green : T.red }}>{l.status === "ok" ? "✅" : "❌"}</span>
                <span style={{ color: T.text }}>{l.nome}</span>
                {l.msg && <span style={{ color: T.red, fontSize: 10 }}>{l.msg}</span>}
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}

function TabConfig({ appState, onSave }: { appState: AppState; onSave: (partial: Partial<AppState>) => void }) {
  const [activeSection, setActiveSection] = useState<"contatos" | "mensagens" | "zapi">("contatos");
  const [msgs, setMsgs] = useState<Mensagens>(appState.mensagens);
  const [msgSaved, setMsgSaved] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [zapi, setZapi] = useState<ZAPIConfig>(appState.zapi || { instanceId: "", token: "", clientToken: "" });
  const [zapiSaved, setZapiSaved] = useState(false);
  const [zapiTesting, setZapiTesting] = useState(false);
  const [zapiTestResult, setZapiTestResult] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleContactUpload = async (file: File) => {
    try {
      const text = await file.text();
      const dados = parseContatos(text);
      const estacaoKey = detectEstacao(file.name, dados);
      const comTel = dados.filter(d => d.telefone).length;
      const updated: Contatos = {
        ...appState.contatos,
        [estacaoKey]: { importadoEm: new Date().toISOString(), total: dados.length, comTelefone: comTel, dados }
      };
      onSave({ contatos: updated });
      setUploadStatus(`✅ ${dados.length} usuários importados · ${comTel} com telefone · Estação detectada: ${hubNome(estacaoKey)}`);
    } catch (e) { setUploadStatus(`❌ Erro: ${(e as Error).message}`); }
  };

  const testarZapi = async () => {
    setZapiTesting(true); setZapiTestResult("");
    try {
      const r = await fetch("/api/zapi");
      const d = await r.json();
      setZapiTestResult(d.connected ? "✅ Conectada e funcionando" : d.configured ? "⚠️ Configurada mas desconectada — verifique o celular" : "❌ Não configurada");
    } catch { setZapiTestResult("❌ Erro de conexão"); }
    setZapiTesting(false);
  };

  const exportarBackup = () => {
    const data = JSON.stringify(appState, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hertzgo-backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const msgFields: [keyof Mensagens, string][] = [
    ["msg1", "📤 MSG 1 — Qualificação (todos os novos)"],
    ["msg2a_parkway", "🟢 MSG 2A — Motorista → Park Way"],
    ["msg2a_cidadeauto", "🟢 MSG 2A — Motorista → Cidade do Automóvel"],
    ["msg2a_vip_parkway", "🏆 MSG VIP — Motorista fidelizado Park Way"],
    ["msg2a_vip_cidadeauto", "🏆 MSG VIP — Motorista fidelizado Cidade Auto"],
    ["msg2b_costa", "🛒 MSG 2B — Não motorista Costa (desconto supermercado)"],
    ["msg2b_parkway", "💚 MSG 2B — Não motorista Park Way"],
    ["msg2b_cidadeauto", "💚 MSG 2B — Não motorista Cidade Auto"],
    ["msg_risco", "🟠 MSG Risco — VIP em queda de frequência"],
    ["msg_churn", "🔴 MSG Churn — Sumiu há 14+ dias"],
    ["cupom_parkway", "🎟️ Cupom Park Way"],
    ["cupom_cidadeauto", "🎟️ Cupom Cidade do Automóvel"],
    ["cupom_costa", "🎟️ Cupom Costa Atacadão"],
    ["cupom_vip", "🎟️ Cupom VIP"],
  ];

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {([["contatos", "📱 Contatos"], ["mensagens", "✉️ Mensagens"], ["zapi", "🔌 Z-API"]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id as typeof activeSection)} style={{ padding: "7px 16px", borderRadius: 10, fontFamily: T.mono, fontSize: 11, cursor: "pointer", border: `1px solid ${activeSection === id ? T.green : T.border}`, background: activeSection === id ? T.greenDim : "transparent", color: activeSection === id ? T.green : T.text2, transition: "all 0.2s" }}>
            {label}
          </button>
        ))}
        <button onClick={exportarBackup} style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 10, fontFamily: T.mono, fontSize: 11, cursor: "pointer", border: `1px solid rgba(59,130,246,0.3)`, background: "rgba(59,130,246,0.08)", color: "#60a5fa" }}>
          ⬇️ Exportar Backup
        </button>
      </div>

      {/* CONTATOS */}
      {activeSection === "contatos" && (
        <>
          <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 16px", fontFamily: T.mono, fontSize: 11, color: "#93c5fd", marginBottom: 20 }}>
            ℹ️ Importe o CSV de usuários de qualquer estação. O sistema detecta automaticamente a estação pelo nome do arquivo ou pelo conteúdo. Faça 1x por semana.
          </div>

          {/* Upload único */}
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>Importar CSV de Usuários</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text2, marginBottom: 20 }}>
              A estação é detectada automaticamente pelo nome do arquivo ou conteúdo
            </div>
            <input ref={inputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleContactUpload(e.target.files[0]); }} />
            <button onClick={() => inputRef.current?.click()} style={{ background: T.greenDim, border: "1px solid rgba(0,229,160,0.3)", color: T.green, padding: "10px 28px", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: T.sans, fontWeight: 600 }}>
              Selecionar CSV
            </button>
            {uploadStatus && (
              <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 11, color: uploadStatus.startsWith("✅") ? T.green : T.red }}>
                {uploadStatus}
              </div>
            )}
          </div>

          {/* Status por estação */}
          {Object.keys(appState.contatos).length > 0 && (
            <>
              <SectionLabel>Contatos Importados</SectionLabel>
              <div style={{ display: "grid", gap: 10 }}>
                {Object.entries(appState.contatos).map(([key, c]) => (
                  <div key={key} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3 }}>{hubNome(key)}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2 }}>{c.total} usuários · {c.comTelefone} com telefone · {new Date(c.importadoEm).toLocaleDateString("pt-BR")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 6, width: 80, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${c.total > 0 ? (c.comTelefone / c.total * 100).toFixed(0) : 0}%`, background: T.green, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.green }}>{c.total > 0 ? (c.comTelefone / c.total * 100).toFixed(0) : 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* MENSAGENS */}
      {activeSection === "mensagens" && (
        <>
          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px", fontFamily: T.mono, fontSize: 11, color: "#fcd34d", marginBottom: 20 }}>
            ℹ️ Use [nome], [local], [cupom] e [beneficio] — substituídos automaticamente no envio.
          </div>
          {msgFields.map(([key, label]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 6 }}>{label}</div>
              <textarea value={msgs[key]} onChange={e => setMsgs(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, color: T.text, padding: "10px 12px", borderRadius: 10, fontSize: 12, fontFamily: T.mono, resize: "vertical", minHeight: key.startsWith("cupom") ? 40 : 90, lineHeight: 1.6 }} />
            </div>
          ))}
          <button onClick={() => { onSave({ mensagens: msgs }); setMsgSaved(true); setTimeout(() => setMsgSaved(false), 2000); }} style={{ background: msgSaved ? "rgba(0,229,160,0.2)" : T.greenDim, border: `1px solid ${msgSaved ? T.green : "rgba(0,229,160,0.3)"}`, color: T.green, padding: "8px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: T.mono, transition: "all 0.3s" }}>
            {msgSaved ? "✅ Mensagens salvas!" : "💾 Salvar Mensagens"}
          </button>
        </>
      )}

      {/* Z-API */}
      {activeSection === "zapi" && (
        <Panel>
          <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, marginBottom: 16, color: T.text }}>📱 Z-API — Configuração WhatsApp</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {([
              { id: "instanceId" as keyof ZAPIConfig, label: "ID da Instância", placeholder: "Ex: 3DF217DC18D...", desc: "Z-API → Instâncias → ID" },
              { id: "token" as keyof ZAPIConfig, label: "Token da Instância", placeholder: "Token...", desc: "Z-API → Instâncias → Token" },
              { id: "clientToken" as keyof ZAPIConfig, label: "Client-Token *obrigatório", placeholder: "Client-Token...", desc: "Z-API → Conta → Security" },
            ] as { id: keyof ZAPIConfig; label: string; placeholder: string; desc: string }[]).map(f => (
              <div key={f.id}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text2, marginBottom: 4 }}>{f.label}</div>
                <input type={f.id === "instanceId" ? "text" : "password"} value={zapi[f.id]} placeholder={f.placeholder}
                  onChange={e => setZapi(p => ({ ...p, [f.id]: e.target.value }))}
                  style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, color: T.text, padding: "8px 10
px", borderRadius: 8, fontSize: 12, fontFamily: T.mono }} />
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, marginTop: 4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => { onSave({ zapi }); setZapiSaved(true); setTimeout(() => setZapiSaved(false), 2000); }} style={{ background: zapiSaved ? "rgba(0,229,160,0.2)" : T.greenDim, border: `1px solid ${zapiSaved ? T.green : "rgba(0,229,160,0.3)"}`, color: T.green, padding: "8px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: T.mono, transition: "all 0.3s" }}>
              {zapiSaved ? "✅ Credenciais salvas!" : "💾 Salvar Credenciais"}
            </button>
            <button onClick={testarZapi} disabled={zapiTesting} style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", padding: "8px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: T.mono }}>
              {zapiTesting ? "⏳ Testando..." : "🔌 Testar Conexão"}
            </button>
          </div>
          {zapiTestResult && (
            <div style={{ fontFamily: T.mono, fontSize: 12, color: zapiTestResult.startsWith("✅") ? T.green : zapiTestResult.startsWith("⚠️") ? T.amber : T.red, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 16 }}>
              {zapiTestResult}
            </div>
          )}
          <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 14px", fontFamily: T.mono, fontSize: 11, color: "#93c5fd" }}>
            ℹ️ As credenciais ficam salvas no browser. Para segurança máxima, configure também as variáveis de ambiente no Vercel.
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: T.text2, lineHeight: 2 }}>
            <div>⚡ <strong style={{ color: T.text }}>HertzGo Vision v3.1</strong></div>
            <div>📊 Dashboard · DC/AC · Semáforo · Projeção · DRE · VIP Score · CRM · Mensagens · Move XLSX</div>
          </div>
        </Panel>
      )}
    </div>
  );
}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => { onSave({ zapi }); setZapiSaved(true); setTimeout(() => setZapiSaved(false), 2000); }} style={{ background: zapiSaved ? "rgba(0,229,160,0.2)" : T.greenDim, border: `1px solid ${zapiSaved ? T.green : "rgba(0,229,160,0.3)"}`, color: T.green, padding: "8px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: T.mono, transition: "all 0.3s" }}>
              {zapiSaved ? "✅ Credenciais salvas!" : "💾 Salvar Credenciais"}
            </button>
            <button onClick={testarZapi} disabled={zapiTesting} style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", padding: "8px 20px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: T.mono }}>
              {zapiTesting ? "⏳ Testando..." : "🔌 Testar Conexão"}
            </button>
          </div>
          {zapiTestResult && (
            <div style={{ fontFamily: T.mono, fontSize: 12, color: zapiTestResult.startsWith("✅") ? T.green : zapiTestResult.startsWith("⚠️") ? T.amber : T.red, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 16 }}>
              {zapiTestResult}
            </div>
          )}
          <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 14px", fontFamily: T.mono, fontSize: 11, color: "#93c5fd" }}>
            ℹ️ As credenciais ficam salvas no browser. Para segurança máxima no futuro, configure também as variáveis de ambiente no Vercel.
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: T.text2, lineHeight: 2 }}>
            <div>⚡ <strong style={{ color: T.text }}>HertzGo Vision v3.1</strong></div>
            <div>📊 Dashboard · DC/AC · Semáforo · Projeção · DRE · VIP Score · CRM · Mensagens · Move XLSX</div>
          </div>
        </Panel>
      )}
    </div>
  );
}

export default function HertzGo() {
  useFonts();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [tab, setTab] = useState<Tab>("dash");
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [activeHub, setActiveHub] = useState("__all__");

  const savePartial = (partial: Partial<AppState>) => {
    setAppState(prev => { const next = { ...prev, ...partial }; saveState(next); return next; });
  };
  const currentMeta = activeHub === "__all__" ? 0 : (appState.metas[activeHub] || 0);
  const setCurrentMeta = (v: number) => { if (activeHub !== "__all__") savePartial({ metas: { ...appState.metas, [activeHub]: v } }); };
  const saveDRE = (key: string, cfg: DREConfig) => savePartial({ dreConfigs: { ...appState.dreConfigs, [key]: cfg } });
  const saveDisparos = (d: AppState["disparos"]) => savePartial({ disparos: d });

  const dts = sessions ? sessions.map(s => s.date.getTime()) : [];
  const okSess = sessions ? sessions.filter(s => !s.cancelled && s.energy > 0).length : 0;
  const uniqHubs = sessions ? new Set(sessions.map(s => s.hubKey)).size : 0;
  const hasMove = sessions ? sessions.some(s => s.source === "move") : false;
  const hasSpott = sessions ? sessions.some(s => s.source === "spott") : false;

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: "dash", label: "Dashboard", icon: "📊" },
    { id: "usuarios", label: "Usuários", icon: "👥" },
    { id: "dre", label: "DRE", icon: "💼" },
    { id: "acoes", label: "Ações", icon: "🎯" },
    { id: "config", label: "Config", icon: "⚙️" },
  ];

  if (!sessions) return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>
      <UploadScreen onFile={setSessions} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 60, background: "rgba(8,10,15,0.97)", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(16px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: T.green, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>⚡</div>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em" }}>HertzGo</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text2, letterSpacing: "0.12em", textTransform: "uppercase" }}>Vision · Rede EV</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ padding: "6px 14px", borderRadius: 10, fontFamily: T.sans, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1px solid ${tab === n.id ? T.green : T.border}`, background: tab === n.id ? T.greenDim : "transparent", color: tab === n.id ? T.green : T.text2, transition: "all 0.2s", boxShadow: tab === n.id ? "0 0 16px rgba(0,229,160,0.2)" : "none" }}>
              <span style={{ marginRight: 5 }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasSpott && <span style={{ fontFamily: T.mono, fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "rgba(0,229,160,0.1)", color: T.green, border: "1px solid rgba(0,229,160,0.2)" }}>Spott</span>}
          {hasMove && <span style={{ fontFamily: T.mono, fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>Move</span>}
          <span style={{ fontFamily: T.mono, fontSize: 10, padding: "3px 10px", borderRadius: 20, background: T.greenDim, color: T.green, border: "1px solid rgba(0,229,160,0.2)" }}>{okSess} sessões</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>{uniqHubs} hubs</span>
          <button onClick={() => { setSessions(null); setTab("dash"); }} style={{ padding: "4px 12px", borderRadius: 20, fontFamily: T.mono, fontSize: 10, cursor: "pointer", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: T.red }}>↩ Novo CSV</button>
        </div>
      </header>
      <main style={{ flex: 1 }}>
        {tab === "dash" && <TabDashboard sessions={sessions} meta={currentMeta} onMetaChange={setCurrentMeta} />}
        {tab === "usuarios" && <TabUsuarios sessions={sessions} appState={appState} />}
        {tab === "dre" && <TabDRE sessions={sessions} appState={appState} onSaveDRE={saveDRE} />}
        {tab === "acoes" && <TabAcoes sessions={sessions} appState={appState} onSaveDisparos={saveDisparos} />}
        {tab === "config" && <TabConfig appState={appState} onSave={savePartial} />}
      </main>
      <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 28px", background: "rgba(8,10,15,0.97)", borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 10, color: T.text3, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}`, display: "inline-block" }} />
          {sessions.length} registros · {okSess} válidos · {uniqHubs} estações
          {dts.length > 0 && ` · ${new Date(Math.min(...dts)).toLocaleDateString("pt-BR")} → ${new Date(Math.max(...dts)).toLocaleDateString("pt-BR")}`}
        </div>
        <div>⚡ HertzGo Vision v3.1</div>
      </footer>
    </div>
  );
}