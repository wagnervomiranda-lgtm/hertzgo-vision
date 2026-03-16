"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, PieChart, Pie, Cell } from "recharts";

// ─── FONTS ───────────────────────────────────────────────────────────────────
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

// ─── TYPES ───────────────────────────────────────────────────────────────────
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
interface CRMUser {
  nome: string;
  telefone: string;
  estacaoOrigem: string;
  estacaoOrigemKey: string;
  tipo: "desconhecido" | "motorista" | "nao_motorista";
  status: "novo" | "msg1_enviada" | "respondeu" | "msg2_enviada" | "fidelizado" | "em_risco" | "churned";
  vipScore: number;
  vipStatus: "ativo" | "regular" | "em_risco" | "churned";
  freqSemanaAtual: number;
  freqSemanaAnterior: number;
  ultimaRecarga: string | null;
  diasSemRecarga: number;
  msg1EnviadaEm: string | null;
  msg2EnviadaEm: string | null;
  respondidoEm: string | null;
  source: "spott" | "move" | "manual";
}
interface Contatos {
  [estacaoKey: string]: {
    importadoEm: string;
    total: number;
    comTelefone: number;
    dados: { nome: string; telefone: string; email?: string }[];
  };
}
interface Mensagens {
  msg1:          string;
  msg2a_parkway: string;
  msg2a_cidadeauto: string;
  msg2a_vip_parkway: string;
  msg2a_vip_cidadeauto: string;
  msg2b_costa:   string;
  msg2b_parkway: string;
  msg2b_cidadeauto: string;
  msg_risco:     string;
  msg_churn:     string;
  cupom_parkway: string;
  cupom_cidadeauto: string;
  cupom_costa:   string;
  cupom_vip:     string;
}
interface AppState {
  metas: Record<string, number>;
  dreConfigs: Record<string, DREConfig>;
  crmUsers: Record<string, CRMUser>;
  contatos: Contatos;
  mensagens: Mensagens;
  disparos: { ts: string; nome: string; msgId: string; status: "ok" | "err"; msg?: string }[];
}
type Tab = "dash" | "dre" | "usuarios" | "acoes" | "config";

// ─── ESTAÇÕES ────────────────────────────────────────────────────────────────
const ESTACAO_MAP: Record<string, string> = {
  "costa atacadão aguas claras": "costa",
  "hertzgo - costa atacadão":    "costa",
  "hertz go 2":                  "costa",
  "costa atacadão":              "costa",
  "park way":                    "parkway",
  "cidade do automóvel":         "cidadeauto",
  "cidade do automovel":         "cidadeauto",
  "lava jato do mamute":         "mamute",
  "madeiro & jerônimo":          "madeiro",
  "madeiro e gerônimo sia brasília": "madeiro",
  "madeiro e geronimo sia brasilia": "madeiro",
  "madeiro & geronimo":          "madeiro",
};
const ESTACAO_NOME: Record<string, string> = {
  costa:       "Costa Atacadão",
  parkway:     "Park Way",
  cidadeauto:  "Cidade do Automóvel",
  mamute:      "Lava Jato do Mamute",
  madeiro:     "Madeiro & Jerônimo",
};
const ESTACAO_PROPRIA = ["parkway","cidadeauto"];
const ESTACAO_PARCERIA = ["costa"];
const ESTACAO_CONTRATUAL = ["mamute","madeiro"];

function hubKey(nome: string): string {
  const n = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  for (const [k,v] of Object.entries(ESTACAO_MAP)) {
    if (n.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g,""))) return v;
  }
  return n.replace(/\s+/g,"_");
}
function hubNome(key: string): string {
  return ESTACAO_NOME[key] || key;
}

// ─── MENSAGENS PADRÃO ────────────────────────────────────────────────────────
const MSG_DEFAULT: Mensagens = {
  msg1: "Olá [nome]! Sou o Wagner, da HertzGo ⚡\n\nVi que você carregou no [local] — obrigado pela preferência!\n\nVocê é motorista de app? Responde 1 pra SIM ou 2 pra NÃO 🚗",
  msg2a_parkway: "Perfeito [nome]! 🎉\n\nTenho uma condição especial para motoristas de app no Park Way (SGAS 915 Sul).\n\nLá você carrega mais rápido com nosso DC 80kW, sem fila e com prioridade. Use o cupom [cupom] na sua próxima recarga.\n\nQuer o endereço completo?",
  msg2a_cidadeauto: "Perfeito [nome]! 🎉\n\nTemos uma condição especial para motoristas de app na Cidade do Automóvel.\n\nDC 40kW disponível, rápido e sem fila. Use o cupom [cupom] na sua próxima recarga.\n\nQuer o endereço?",
  msg2a_vip_parkway: "Ei [nome], você é um dos nossos motoristas VIP no Park Way! 🏆\n\nNossa forma de reconhecer quem mais confia na HertzGo: [beneficio]\n\nCupom exclusivo: [cupom]",
  msg2a_vip_cidadeauto: "Ei [nome], você é um dos nossos motoristas VIP na Cidade do Automóvel! 🏆\n\nComo reconhecimento: [beneficio]\n\nCupom exclusivo: [cupom]",
  msg2b_costa: "[nome], que bom ter você como cliente do Costa Atacadão! 😊\n\nComo presente: na sua próxima compra no supermercado, apresente o código [cupom] no caixa e ganhe um desconto especial.\n\nAté a próxima recarga! ⚡",
  msg2b_parkway: "[nome], você já é um cliente frequente no Park Way! 🙏\n\nPreparo sempre algo especial para quem é fiel. Na próxima visita, me avisa — tenho uma novidade pra você.\n\nCupom: [cupom]",
  msg2b_cidadeauto: "[nome], obrigado por carregar na Cidade do Automóvel! ⚡\n\nVocê é importante pra nós. Cupom de fidelidade: [cupom]\n\nUse na próxima recarga!",
  msg_risco: "[nome], sumiu! Tudo bem com o carro? 😄\n\nFaz uns dias que não te vejo no [local]. Quando quiser carregar, estamos aqui.\n\nSe tiver algum problema com o app, me fala que resolvo pessoalmente.",
  msg_churn: "[nome], saudades! 😊\n\nFaz um tempo que não carrega no [local]. Temos novidades que acho que você vai gostar.\n\nQuer saber?",
  cupom_parkway:    "PWVIP10",
  cupom_cidadeauto: "CAVIP10",
  cupom_costa:      "COSTA10",
  cupom_vip:        "HZVIP",
};

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg:"#080a0f", bg1:"#0d1017", bg2:"#121620", bg3:"#181d28",
  border:"rgba(255,255,255,0.07)", border2:"rgba(255,255,255,0.12)",
  green:"#00e5a0", greenDim:"rgba(0,229,160,0.15)",
  amber:"#f59e0b", red:"#ef4444", blue:"#3b82f6",
  text:"#e8edf5", text2:"#6b7fa3", text3:"#2d3a52",
  mono:"'JetBrains Mono', monospace", sans:"'Space Grotesk', sans-serif",
} as const;

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "hertzgo_vision_v3";
function loadState(): AppState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return { ...defaultState(), ...JSON.parse(s) };
  } catch {}
  return defaultState();
}
function saveState(s: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}
function defaultState(): AppState {
  return {
    metas: {},
    dreConfigs: {},
    crmUsers: {},
    contatos: {},
    mensagens: { ...MSG_DEFAULT },
    disparos: [],
  };
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────
function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g,"").replace(",",".")) || 0;
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m1 = s.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1]);
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
  return null;
}
function parseHour(s: string): number | null {
  const ms = s?.match(/(\d{1,2}):(\d{2})/g);
  if (!ms) return null;
  const last = ms[ms.length-1].match(/(\d{1,2})/);
  return last ? +last[1] : null;
}
function parseDurMin(s: string): number | null {
  if (!s) return null;
  const m1 = s.match(/(\d+)h\s*(\d+)\s*min/i);
  if (m1) return +m1[1]*60 + +m1[2];
  const m2 = s.match(/^(\d+):(\d{2})$/);
  if (m2) return +m2[1]*60 + +m2[2];
  return null;
}
function parseLine(line: string): string[] {
  const r: string[] = []; let cur = "", inQ = false;
  for (const c of line) {
    if (c==='"') { inQ=!inQ; continue; }
    if (c==="," && !inQ) { r.push(cur.trim()); cur=""; continue; }
    cur += c;
  }
  r.push(cur.trim()); return r;
}

// ─── PARSER SPOTT ────────────────────────────────────────────────────────────
function parseSpott(text: string): Session[] {
  text = text.replace(/^\uFEFF/,"");
  const lines = text.split("\n").map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Arquivo vazio");
  const hdr = parseLine(lines[0]);
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")));
  const iData=idx(/^data$/), iLocal=idx(/^local$/), iUser=idx(/usu/), iChrg=idx(/carregador/);
  const iEn=idx(/^energia$/), iVal=idx(/^valor$/), iStart=idx(/inicio|in.cio/);
  const iEndC=idx(/fim do car/), iEndT=idx(/fim da trans/), iDur=idx(/dura/), iSt=idx(/recarga/);
  const sessions: Session[] = [];
  for (let i=1; i<lines.length; i++) {
    const cols = parseLine(lines[i]);
    const g = (j:number) => j>=0 && cols[j] ? cols[j].trim() : "";
    const date = parseDate(g(iData));
    if (!date) continue;
    const energy = parseNum(g(iEn));
    const value  = parseNum(g(iVal));
    const cancelled = /cancel/i.test(g(iSt)) || (energy===0 && value===0);
    const endCStr=g(iEndC), endTStr=g(iEndT);
    let overstayMin: number|null = null;
    const toMOD=(s:string)=>{const ms2=s.match(/(\d{1,2}):(\d{2})/g);if(!ms2)return null;const x=ms2[ms2.length-1].match(/(\d+):(\d+)/);return x?+x[1]*60+ +x[2]:null;};
    const ec=toMOD(endCStr), et=toMOD(endTStr);
    if (ec!==null && et!==null && et>ec) overstayMin=et-ec;
    const hub = g(iLocal)||"Desconhecida";
    sessions.push({
      date, hub, hubKey: hubKey(hub),
      user: g(iUser)||"—", charger: g(iChrg), energy, value,
      duration: g(iDur), durMin: parseDurMin(g(iDur)),
      overstayMin, startHour: parseHour(g(iStart)),
      status: g(iSt), cancelled, source: "spott",
    });
  }
  if (!sessions.length) throw new Error("Nenhuma sessão encontrada");
  return sessions;
}

// ─── PARSER MOVE (Excel via SheetJS) ─────────────────────────────────────────
async function parseMove(file: File): Promise<{ sessions: Session[]; contatos: {nome:string;telefone:string}[] }> {
  const XLSX = await import("xlsx") as any;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header:1 });
  const hdr: string[] = rows[0].map((h:any) => String(h||"").toLowerCase());
  const iNome  = hdr.findIndex(h=>/usu.rio.*nome|nome/i.test(h));
  const iTel   = hdr.findIndex(h=>/telefone|phone/i.test(h));
  const iEstac = hdr.findIndex(h=>/esta.{0,3}o|station/i.test(h));
  const iInicFim = hdr.findIndex(h=>/in.cio.*fim|inicio|start/i.test(h));
  const iEn    = hdr.findIndex(h=>/energia|kwh|energy/i.test(h));
  const iRec   = hdr.findIndex(h=>/receita|valor|revenue/i.test(h));
  const iCon   = hdr.findIndex(h=>/conector.*tipo|tipo.*conector/i.test(h));
  const sessions: Session[] = [];
  const contatosMap: Record<string,string> = {};
  for (let i=1; i<rows.length; i++) {
    const r = rows[i];
    const nome  = String(r[iNome]||"").trim();
    const tel   = String(r[iTel]||"").replace(/\D/g,"");
    const estac = String(r[iEstac]||"").trim();
    const inicFim = String(r[iInicFim]||"");
    const energy = parseFloat(String(r[iEn]||0)) || 0;
    const value  = parseFloat(String(r[iRec]||0)) || 0;
    const conType= String(r[iCon]||"").toLowerCase();
    if (!nome || !estac) continue;
    // Telefone
    if (nome && tel && tel.length >= 8) contatosMap[nome.toLowerCase()] = tel;
    // Data: pega a parte antes do " - " ou a string inteira
    const datePart = inicFim.split(" - ")[0].trim();
    // Move usa DD/MM/YYYY HH:MM
    const dm = datePart.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const date = dm ? new Date(+dm[3], +dm[2]-1, +dm[1]) : null;
    if (!date) continue;
    const startHour = parseHour(datePart);
    // Charger type
    const charger = conType.includes("ccs") ? "DC 120kW - Move" : conType.includes("ac") ? "AC 22kW - Move" : "Move";
    const hub = estac;
    sessions.push({
      date, hub, hubKey: hubKey(hub),
      user: nome, charger, energy, value,
      duration: "", durMin: null, overstayMin: null,
      startHour, status: value>0?"Finalizado":"", cancelled: energy===0&&value===0,
      source: "move",
    });
  }
  const contatos = Object.entries(contatosMap).map(([nome,tel])=>({nome,telefone:tel}));
  return { sessions, contatos };
}

// ─── PARSER CONTATOS (CSV usuários Spott) ────────────────────────────────────
function parseContatos(text: string): {nome:string;telefone:string;email:string}[] {
  text = text.replace(/^\uFEFF/,"");
  const lines = text.split("\n").map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const hdr = parseLine(lines[0]).map(h=>h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""));
  const iNome = hdr.findIndex(h=>/^usu.rios?$|^nome$/.test(h));
  const iTel  = hdr.findIndex(h=>/^telefone$|^celular$/.test(h));
  const iEmail= hdr.findIndex(h=>/^e?-?mail$/.test(h));
  const iNomeF = iNome>=0 ? iNome : hdr.findIndex(h=>/nom|usu/.test(h));
  const iTelF  = iTel>=0  ? iTel  : hdr.findIndex(h=>/tel|fone|cel/.test(h));
  if (iTelF<0) return [];
  const result: {nome:string;telefone:string;email:string}[] = [];
  for (let i=1; i<lines.length; i++) {
    const cols = parseLine(lines[i]);
    const g = (j:number) => j>=0&&cols[j] ? cols[j].trim() : "";
    const nome = g(iNomeF);
    const tel  = g(iTelF).replace(/\D/g,"");
    const email= g(iEmail);
    if (!nome || tel.length < 8) continue;
    result.push({ nome, telefone: tel, email });
  }
  return result;
}

// ─── VIP SCORE ───────────────────────────────────────────────────────────────
function calcVipScore(user: string, allOk: Session[]): { score:number; status:"ativo"|"regular"|"em_risco"|"churned"; freqAtual:number; freqAnterior:number; diasSemRecarga:number } {
  const uSess = allOk.filter(s=>s.user===user);
  if (!uSess.length) return { score:0, status:"churned", freqAtual:0, freqAnterior:0, diasSemRecarga:999 };
  const datas = uSess.map(s=>s.date.getTime());
  const maxDt = Math.max(...datas);
  const hoje  = Date.now();
  const diasSemRecarga = Math.round((hoje - maxDt) / 86400000);
  // Semana atual vs anterior
  const semAtualStart = hoje - 7*86400000;
  const semAntStart   = hoje - 14*86400000;
  const freqAtual    = uSess.filter(s=>s.date.getTime()>=semAtualStart).length;
  const freqAnterior = uSess.filter(s=>s.date.getTime()>=semAntStart&&s.date.getTime()<semAtualStart).length;
  // Score
  let score = 0;
  if (diasSemRecarga <= 7) score += 40;
  else if (diasSemRecarga <= 14) score += 20;
  if (freqAtual >= 2) score += 35;
  else if (freqAtual >= 1) score += 20;
  const primeiraSessao = Math.min(...datas);
  const diasCliente = Math.round((hoje - primeiraSessao) / 86400000);
  if (diasCliente >= 30) score += 25;
  else if (diasCliente >= 14) score += 12;
  const status: "ativo"|"regular"|"em_risco"|"churned" =
    score >= 76 ? "ativo" :
    score >= 51 ? "regular" :
    score >= 26 ? "em_risco" : "churned";
  return { score, status, freqAtual, freqAnterior, diasSemRecarga };
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
const brl  = (n:number) => "R$\u00a0"+n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const brlK = (n:number) => n>=1000?`R$\u00a0${(n/1000).toFixed(1)}k`:brl(n);
const fmtDate = (d:Date) => d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
function trunc(s:string,n:number){return s.length>n?s.slice(0,n-1)+"…":s;}

function heatColor(val:number,max:number):string {
  if(val===0) return "rgba(15,17,23,0.9)";
  const t=val/max;
  if(t<0.33) return `rgba(0,${Math.round(100+t/0.33*80)},${Math.round(100+t/0.33*60)},0.8)`;
  if(t<0.66) return `rgba(${Math.round((t-0.33)/0.33*200)},200,80,0.8)`;
  return `rgba(255,${Math.round(200-(t-0.66)/0.34*160)},${Math.round(80-(t-0.66)/0.34*60)},0.9)`;
}

function classificarUsuarios(sessions:Session[]):UserData[] {
  const datas=sessions.map(s=>s.date.getTime());
  const periodDays=Math.max(1,Math.round((Math.max(...datas)-Math.min(...datas))/86400000)+1);
  const periodWeeks=periodDays/7;
  const userMap:Record<string,UserData>={};
  sessions.forEach(s=>{
    if(!userMap[s.user]) userMap[s.user]={user:s.user,sess:0,kwh:0,rev:0,dates:[],hubs:[],hubKeys:[],values:[],isParceiro:false,isMotorista:false,isHeavy:false,perfil:"",perfilCor:"",localFreq:"",localFreqKey:""};
    const u=userMap[s.user];
    u.sess++;u.kwh+=s.energy;u.rev+=s.value;u.dates.push(s.date);u.hubs.push(s.hub);u.hubKeys.push(s.hubKey);u.values.push(s.value);
  });
  return Object.values(userMap).map(u=>{
    const temGratis=u.values.some(v=>v===0);
    const mediaKwh=u.kwh>0?u.rev/u.kwh:999;
    const isParceiro=temGratis||mediaKwh<1.00;
    const recPorSemana=u.sess/Math.max(1,periodWeeks);
    const isMotorista=!isParceiro&&(recPorSemana>2.5||u.kwh>150);
    const isHeavy=!isParceiro&&!isMotorista&&(u.kwh>80||u.sess>=4);
    const stCount:Record<string,number>={};
    u.hubKeys.forEach(h=>{stCount[h]=(stCount[h]||0)+1;});
    const localFreqKey=Object.entries(stCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
    const localFreq=hubNome(localFreqKey)||u.hubs[0]||"—";
    let perfil="🟢 Shopper",perfilCor="#22c55e";
    if(isParceiro){perfil="🔵 Parceiro";perfilCor="#3b82f6";}
    else if(isMotorista){perfil="🔴 Motorista";perfilCor="#ef4444";}
    else if(isHeavy){perfil="🟡 Heavy User";perfilCor="#eab308";}
    return{...u,isParceiro,isMotorista,isHeavy,perfil,perfilCor,localFreq,localFreqKey};
  });
}

function dreSimples(anual:number):number {
  if(anual<=180000)return 6.0;if(anual<=360000)return 11.2;if(anual<=720000)return 13.5;
  if(anual<=1800000)return 16.0;if(anual<=3600000)return 21.0;return 33.0;
}

// ─── ALERTAS ─────────────────────────────────────────────────────────────────
interface Alerta{tipo:"crit"|"warn"|"ok";icon:string;titulo:string;desc:string;}
function calcAlertas(sessions:Session[]):{semaforo:"verde"|"amarelo"|"vermelho";alertas:Alerta[]}{
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const cancelled=sessions.filter(s=>s.cancelled);
  if(!ok.length)return{semaforo:"vermelho",alertas:[]};
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const totalKwh=ok.reduce((a,s)=>a+s.energy,0);
  const avgSessDay=ok.length/days,avgRevDay=totalRev/days,avgKwhDay=totalKwh/days;
  const cancelRate=sessions.length>0?cancelled.length/sessions.length:0;
  const withOv=ok.filter(s=>s.overstayMin!==null&&s.overstayMin>0);
  const avgOv=withOv.length>0?withOv.reduce((a,s)=>a+(s.overstayMin||0),0)/withOv.length:0;
  const ticket=ok.length>0?totalRev/ok.length:0;
  const alertas:Alerta[]=[];
  if(avgSessDay>=12)alertas.push({tipo:"ok",icon:"✅",titulo:"Sessões no alvo",desc:`${avgSessDay.toFixed(1)} sess/dia — acima da meta`});
  else if(avgSessDay>=8)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Sessões abaixo da meta",desc:`${avgSessDay.toFixed(1)}/dia — meta é 12/dia`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Volume crítico",desc:`${avgSessDay.toFixed(1)}/dia — muito abaixo`});
  if(avgRevDay>=350)alertas.push({tipo:"ok",icon:"✅",titulo:"Receita no alvo",desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia`});
  else if(avgRevDay>=250)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Receita abaixo da meta",desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia — meta R$\u00a0350`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Receita crítica",desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia`});
  if(cancelRate<=0.08)alertas.push({tipo:"ok",icon:"✅",titulo:"Cancelamentos ok",desc:`${(cancelRate*100).toFixed(1)}%`});
  else if(cancelRate<=0.15)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Cancelamentos elevados",desc:`${(cancelRate*100).toFixed(1)}%`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Cancelamentos críticos",desc:`${(cancelRate*100).toFixed(1)}%`});
  if(avgOv===0||avgOv<=5)alertas.push({tipo:"ok",icon:"✅",titulo:"Overstay ok",desc:avgOv===0?"Sem overstay":`${avgOv.toFixed(1)} min médio`});
  else if(avgOv<=15)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Overstay elevado",desc:`${avgOv.toFixed(1)} min — meta <5`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Overstay crítico",desc:`${avgOv.toFixed(1)} min`});
  if(avgKwhDay<100)alertas.push({tipo:"crit",icon:"🔴",titulo:"Energia crítica",desc:`${avgKwhDay.toFixed(0)} kWh/dia`});
  else if(avgKwhDay<180)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Energia baixa",desc:`${avgKwhDay.toFixed(0)} kWh/dia`});
  if(ticket<20)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Ticket baixo",desc:`R$\u00a0${ticket.toFixed(2).replace(".",",")} — meta R$\u00a030`});
  const crits=alertas.filter(a=>a.tipo==="crit").length;
  const warns=alertas.filter(a=>a.tipo==="warn").length;
  return{semaforo:crits>0?"vermelho":warns>=1?"amarelo":"verde",alertas};
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function KpiCard({label,value,sub,accent="#00e5a0",small}:{label:string;value:string;sub?:string;accent?:string;small?:boolean}){
  return(
    <div style={{background:"#121620",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent}}/>
      <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>{label}</div>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:small?20:26,fontWeight:700,color:accent,lineHeight:1,marginBottom:4}}>{value}</div>
      {sub&&<div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#2d3a52"}}>{sub}</div>}
    </div>
  );
}
function SectionLabel({children}:{children:string}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52",letterSpacing:"0.18em",textTransform:"uppercase" as const,margin:"28px 0 14px"}}>
      {children}<div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
    </div>
  );
}
function Panel({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){
  return <div style={{background:"#121620",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"20px 22px",...style}}>{children}</div>;
}
const TH:React.CSSProperties={fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52",textTransform:"uppercase",letterSpacing:"0.1em",padding:"0 12px 12px",textAlign:"left",borderBottom:"1px solid rgba(255,255,255,0.07)",fontWeight:500};
const THR:React.CSSProperties={...TH,textAlign:"right"};
const TD:React.CSSProperties={padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:12,verticalAlign:"middle",color:"#e8edf5"};
const TDR:React.CSSProperties={...TD,textAlign:"right",fontFamily:"'JetBrains Mono', monospace"};
function CustomTooltip({active,payload,label,suffix=""}:{active?:boolean;payload?:{value:number;color:string}[];label?:string;suffix?:string}){
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:"#181d28",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 14px",fontFamily:"'JetBrains Mono', monospace",fontSize:11}}>
      <div style={{color:"#6b7fa3",marginBottom:4}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:p.color||"#00e5a0"}}>{suffix==="R$"?"R$\u00a0"+p.value.toLocaleString("pt-BR",{minimumFractionDigits:2}):`${p.value.toFixed(1)} ${suffix}`}</div>)}
    </div>
  );
}

// ─── SEMÁFORO ────────────────────────────────────────────────────────────────
function Semaforo({sessions}:{sessions:Session[]}){
  const{semaforo,alertas}=useMemo(()=>calcAlertas(sessions),[sessions]);
  const cores={
    verde:{bg:"rgba(0,229,160,0.08)",border:"rgba(0,229,160,0.25)",dot:"#00e5a0",label:"Operação Normal",sub:"Todos os indicadores dentro das metas"},
    amarelo:{bg:"rgba(245,158,11,0.08)",border:"rgba(245,158,11,0.25)",dot:"#f59e0b",label:"Atenção",sub:"Alguns indicadores fora da meta"},
    vermelho:{bg:"rgba(239,68,68,0.08)",border:"rgba(239,68,68,0.25)",dot:"#ef4444",label:"Alertas Críticos",sub:"Indicadores críticos detectados"},
  };
  const c=cores[semaforo];
  const emoji=semaforo==="verde"?"🟢":semaforo==="amarelo"?"🟡":"🔴";
  const[expanded,setExpanded]=useState(true);
  return(
    <div style={{marginBottom:20}}>
      <div onClick={()=>setExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:c.bg,border:`1px solid ${c.border}`,borderRadius:14,cursor:"pointer",marginBottom:expanded?10:0,transition:"all 0.2s"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:26,lineHeight:1}}>{emoji}</div>
          <div>
            <div style={{fontFamily:T.sans,fontSize:15,fontWeight:700,color:c.dot}}>{c.label}</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:2}}>{c.sub}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {["crit","warn","ok"].map(tipo=>{
            const count=alertas.filter(a=>a.tipo===tipo).length;
            if(!count)return null;
            const color=tipo==="crit"?T.red:tipo==="warn"?T.amber:T.green;
            return<span key={tipo} style={{fontFamily:T.mono,fontSize:10,padding:"2px 9px",borderRadius:20,background:`${color}20`,color,border:`1px solid ${color}40`}}>{tipo==="crit"?"🔴":tipo==="warn"?"⚠️":"✅"} {count}</span>;
          })}
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>
      {expanded&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {alertas.map((a,i)=>{
            const color=a.tipo==="crit"?T.red:a.tipo==="warn"?T.amber:T.green;
            return(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:`${color}08`,border:`1px solid ${color}25`,borderRadius:10}}>
                <span style={{fontSize:15,flexShrink:0,marginTop:1}}>{a.icon}</span>
                <div>
                  <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color,marginBottom:2}}>{a.titulo}</div>
                  <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,lineHeight:1.5}}>{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PROJEÇÃO MENSAL ─────────────────────────────────────────────────────────
function ProjecaoMensal({sessions,meta,onMetaChange}:{sessions:Session[];meta:number;onMetaChange:(v:number)=>void}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  if(!ok.length)return null;
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const totalKwh=ok.reduce((a,s)=>a+s.energy,0);
  const totalSess=ok.length;
  const avgRevDay=totalRev/days,avgKwhDay=totalKwh/days,avgSessDay=totalSess/days;
  const diasNoMes=30;
  const projRev=avgRevDay*diasNoMes,projKwh=avgKwhDay*diasNoMes,projSess=Math.round(avgSessDay*diasNoMes);
  const hoje=new Date();
  const ultimoDia=new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate();
  const diasRestantes=ultimoDia-hoje.getDate();
  const diasDecorridos=hoje.getDate();
  const metaDia=meta/diasNoMes;
  const pacingEsperado=metaDia*diasDecorridos;
  const pacingReal=totalRev;
  const pacingDiff=pacingReal-pacingEsperado;
  const pacingPct=pacingEsperado>0?(pacingReal/pacingEsperado)*100:0;
  const faltaMeta=Math.max(0,meta-totalRev);
  const ritmoNecessario=diasRestantes>0?faltaMeta/diasRestantes:0;
  const ritmoDiff=ritmoNecessario-avgRevDay;
  const pctMeta=meta>0?Math.min(150,(projRev/meta)*100):0;
  const metaColor=pctMeta>=100?T.green:pctMeta>=75?T.amber:T.red;
  const gerarInsight=():string=>{
    if(meta===0)return"Configure uma meta mensal para ativar o pacing inteligente.";
    if(pctMeta>=110)return`🚀 Ritmo excelente — projeção ${pctMeta.toFixed(0)}% da meta. Vai superar em R$\u00a0${(projRev-meta).toFixed(0)}.`;
    if(pctMeta>=100)return`✅ No alvo — mantenha ${avgSessDay.toFixed(1)} sessões/dia.`;
    if(pctMeta>=75){
      if(ritmoDiff>0)return`⚠️ Para bater a meta, precisa de R$\u00a0${ritmoNecessario.toFixed(0)}/dia nos próximos ${diasRestantes} dias — R$\u00a0${ritmoDiff.toFixed(0)}/dia a mais.`;
      return`⚠️ Projeção em ${pctMeta.toFixed(0)}%. Faltam R$\u00a0${faltaMeta.toFixed(0)} — ${diasRestantes} dias para recuperar.`;
    }
    return`🔴 Ritmo crítico — ${pctMeta.toFixed(0)}% da meta. Precisa de +${Math.ceil(ritmoDiff>0?ritmoDiff/(avgRevDay/avgSessDay):2)} sessões/dia.`;
  };
  const[editando,setEditando]=useState(false);
  const[metaInput,setMetaInput]=useState(String(meta));
  return(
    <div style={{marginBottom:24,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🔮</span>
          <div>
            <div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:T.text}}>Projeção do Mês</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:1}}>base: {avgRevDay.toFixed(0)}/dia · {days} dias no CSV · {diasRestantes} dias restantes</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>Meta:</span>
          {editando?(
            <div style={{display:"flex",gap:6}}>
              <input autoFocus type="number" value={metaInput} onChange={e=>setMetaInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){onMetaChange(+metaInput||0);setEditando(false);}if(e.key==="Escape")setEditando(false);}}
                style={{width:90,background:T.bg3,border:`1px solid ${T.green}`,color:T.text,padding:"4px 8px",borderRadius:6,fontSize:12,fontFamily:T.mono}}/>
              <button onClick={()=>{onMetaChange(+metaInput||0);setEditando(false);}} style={{background:T.greenDim,border:`1px solid rgba(0,229,160,0.3)`,color:T.green,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:T.mono}}>✓</button>
            </div>
          ):(
            <button onClick={()=>{setMetaInput(String(meta));setEditando(true);}} style={{background:"transparent",border:`1px solid ${T.border}`,color:meta>0?T.amber:T.text3,padding:"4px 12px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:T.mono,transition:"all 0.2s"}}>
              {meta>0?brlK(meta):"Definir meta"} ✏️
            </button>
          )}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border}}>
        {[
          {label:"Receita Projetada",value:brlK(projRev),sub:`R$\u00a0${avgRevDay.toFixed(0)}/dia × 30`,color:metaColor},
          {label:"kWh Projetados",value:`${Math.round(projKwh).toLocaleString("pt-BR")} kWh`,sub:`${avgKwhDay.toFixed(0)} kWh/dia × 30`,color:T.amber},
          {label:"Sessões Projetadas",value:`${projSess}`,sub:`${avgSessDay.toFixed(1)} sess/dia × 30`,color:T.blue},
          {label:"Pacing vs Meta",value:meta>0?`${pacingPct.toFixed(0)}%`:"—",sub:meta>0?(pacingDiff>=0?`▲ R$\u00a0${pacingDiff.toFixed(0)} à frente`:`▼ R$\u00a0${Math.abs(pacingDiff).toFixed(0)} atrás`):"configure uma meta",color:meta>0?(pacingPct>=100?T.green:pacingPct>=75?T.amber:T.red):T.text3},
        ].map((k,i)=>(
          <div key={i} style={{background:T.bg2,padding:"14px 16px"}}>
            <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>{k.label}</div>
            <div style={{fontFamily:T.sans,fontSize:20,fontWeight:700,color:k.color,lineHeight:1,marginBottom:4}}>{k.value}</div>
            <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{k.sub}</div>
          </div>
        ))}
      </div>
      {meta>0&&(
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:6}}>
            <span>Projeção vs Meta <span style={{color:metaColor,fontWeight:600}}>{pctMeta.toFixed(0)}%</span></span>
            <span>{brlK(projRev)} <span style={{color:T.text3}}>/ meta {brlK(meta)}</span></span>
          </div>
          <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(100,pctMeta)}%`,background:metaColor,borderRadius:3,transition:"width 0.6s ease"}}/>
          </div>
          <div style={{marginTop:10,padding:"10px 14px",background:`${metaColor}08`,border:`1px solid ${metaColor}20`,borderRadius:10,fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:1.6}}>
            {gerarInsight()}
          </div>
        </div>
      )}
      {meta===0&&(
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,fontFamily:T.mono,fontSize:11,color:T.text3,textAlign:"center"}}>
          👆 Clique em <strong style={{color:T.amber}}>Definir meta</strong> para ativar o pacing inteligente
        </div>
      )}
    </div>
  );
}

// ─── UPLOAD SCREEN ───────────────────────────────────────────────────────────
function UploadScreen({onFile}:{onFile:(s:Session[])=>void}){
  const[drag,setDrag]=useState(false);
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const process=useCallback(async(file:File)=>{
    setLoading(true);setErr("");
    try{
      if(file.name.toLowerCase().endsWith(".xlsx")||file.name.toLowerCase().endsWith(".xls")){
        const{sessions}=await parseMove(file);
        onFile(sessions);
      } else {
        const text=await file.text();
        onFile(parseSpott(text));
      }
    }catch(ex:unknown){setErr((ex as Error).message);}
    setLoading(false);
  },[onFile]);
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,minHeight:"100vh"}}>
      <div style={{textAlign:"center",marginBottom:52}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:16}}>
          <div style={{width:52,height:52,background:"#00e5a0",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>⚡</div>
          <div>
            <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:36,fontWeight:700,letterSpacing:"-0.04em",color:"#e8edf5"}}>HertzGo</div>
            <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",letterSpacing:"0.18em",textTransform:"uppercase"}}>Vision · Painel Operacional</div>
          </div>
        </div>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)process(f);}}
        onClick={()=>inputRef.current?.click()}
        style={{width:"100%",maxWidth:560,background:drag?"rgba(0,229,160,0.06)":"#0d1017",border:`1.5px dashed ${drag?"#00e5a0":"rgba(255,255,255,0.12)"}`,borderRadius:24,padding:"48px 40px",textAlign:"center",cursor:"pointer",transition:"all 0.2s"}}>
        <div style={{fontSize:40,marginBottom:16}}>{loading?"⏳":"📂"}</div>
        <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:18,fontWeight:600,marginBottom:8,color:"#e8edf5"}}>
          {loading?"Processando...":"Carregar CSV ou Excel"}
        </div>
        <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:"#6b7fa3",lineHeight:1.8,marginBottom:24}}>
          Arraste ou clique para selecionar<br/>
          <span style={{color:"#00e5a0"}}>Spott CSV · Move XLSX · Multi-estação · Qualquer período</span>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{display:"inline-block",padding:"10px 24px",background:"#00e5a0",color:"#080a0f",borderRadius:10,fontFamily:"'Space Grotesk', sans-serif",fontWeight:700,fontSize:13}}>Spott CSV</div>
          <div style={{display:"inline-block",padding:"10px 24px",background:"rgba(59,130,246,0.15)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,fontFamily:"'Space Grotesk', sans-serif",fontWeight:700,fontSize:13}}>Move XLSX</div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])process(e.target.files[0]);}}/>
      {err&&<div style={{marginTop:16,padding:"10px 18px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,color:"#ef4444",fontFamily:"'JetBrains Mono', monospace",fontSize:12}}>❌ {err}</div>}
    </div>
  );
}

// ─── TAB DASHBOARD ───────────────────────────────────────────────────────────
function TabDashboard({sessions,meta,onMetaChange}:{sessions:Session[];meta:number;onMetaChange:(v:number)=>void}){
  const[activeHub,setActiveHub]=useState("__all__");
  const hubs=useMemo(()=>Array.from(new Set(sessions.map(s=>s.hubKey))).sort(),[sessions]);
  const filtered=useMemo(()=>activeHub==="__all__"?sessions:sessions.filter(s=>s.hubKey===activeHub),[sessions,activeHub]);
  const ok=filtered.filter(s=>!s.cancelled&&s.energy>0);
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const totalKwh=ok.reduce((a,s)=>a+s.energy,0);
  const totalSess=ok.length;
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const ticket=totalSess>0?totalRev/totalSess:0;
  const priceKwh=totalKwh>0?totalRev/totalKwh:0;
  const dts=ok.map(s=>s.date.getTime());
  const minDate=dts.length?new Date(Math.min(...dts)):new Date();
  const maxDate=dts.length?new Date(Math.max(...dts)):new Date();
  const byDay:Record<string,{date:Date;rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{const k=s.date.toDateString();if(!byDay[k])byDay[k]={date:s.date,rev:0,kwh:0,sess:0};byDay[k].rev+=s.value;byDay[k].kwh+=s.energy;byDay[k].sess++;});
  const dayArr=Object.values(byDay).sort((a,b)=>a.date.getTime()-b.date.getTime());
  const dayData=dayArr.map(d=>({date:fmtDate(d.date),rev:+d.rev.toFixed(2),kwh:+d.kwh.toFixed(0)}));
  const avgRev=totalRev/days;
  const hubMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!hubMap[s.hubKey])hubMap[s.hubKey]={rev:0,kwh:0,sess:0};hubMap[s.hubKey].rev+=s.value;hubMap[s.hubKey].kwh+=s.energy;hubMap[s.hubKey].sess++;});
  const hubData=Object.entries(hubMap).sort((a,b)=>b[1].rev-a[1].rev).map(([key,d])=>({name:trunc(hubNome(key),20),rev:+d.rev.toFixed(0)}));
  const userMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!userMap[s.user])userMap[s.user]={rev:0,kwh:0,sess:0};userMap[s.user].rev+=s.value;userMap[s.user].kwh+=s.energy;userMap[s.user].sess++;});
  const top5=Object.entries(userMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);
  const hourData=Array(24).fill(0).map(()=>({sess:0,kwh:0}));
  ok.forEach(s=>{if(s.startHour!==null){hourData[s.startHour].sess++;hourData[s.startHour].kwh+=s.energy;}});
  const maxHour=Math.max(...hourData.map(h=>h.sess),1);
  // Source badge
  const hasMove=sessions.some(s=>s.source==="move");
  const hasSpott=sessions.some(s=>s.source==="spott");
  return(
    <div style={{padding:"24px 28px"}}>
      {hubs.length>1&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
          {["__all__",...hubs].map(h=>(
            <button key={h} onClick={()=>setActiveHub(h)} style={{padding:"5px 14px",borderRadius:20,fontFamily:"'JetBrains Mono', monospace",fontSize:11,cursor:"pointer",border:`1px solid ${activeHub===h?"#00e5a0":"rgba(255,255,255,0.12)"}`,background:activeHub===h?"rgba(0,229,160,0.15)":"transparent",color:activeHub===h?"#00e5a0":"#6b7fa3",transition:"all 0.18s"}}>
              {h==="__all__"?`🌐 Todas (${hubs.length})`:`📍 ${hubNome(h)}`}
            </button>
          ))}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:10,fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",marginBottom:16}}>
        <span>📅 {fmtDate(minDate)} → {fmtDate(maxDate)} · {days} dias · {totalSess} sessões</span>
        {hasSpott&&<span style={{background:"rgba(0,229,160,0.1)",color:"#00e5a0",padding:"2px 8px",borderRadius:4,fontSize:9,border:"1px solid rgba(0,229,160,0.2)"}}>Spott</span>}
        {hasMove&&<span style={{background:"rgba(59,130,246,0.1)",color:"#60a5fa",padding:"2px 8px",borderRadius:4,fontSize:9,border:"1px solid rgba(59,130,246,0.2)"}}>Move</span>}
      </div>
      <Semaforo sessions={filtered}/>
      <ProjecaoMensal sessions={filtered} meta={meta} onMetaChange={onMetaChange}/>
      <SectionLabel>KPIs do Período</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <KpiCard label="Faturamento Bruto" value={brl(totalRev)} sub={`R$\u00a0${(totalRev/days).toFixed(0)}/dia`} accent="#00e5a0"/>
        <KpiCard label="Energia Entregue" value={`${totalKwh.toFixed(0)} kWh`} sub={`${(totalKwh/days).toFixed(0)} kWh/dia`} accent="#f59e0b"/>
        <KpiCard label="Total Sessões" value={`${totalSess}`} sub={`${(totalSess/days).toFixed(1)} sess/dia`} accent="#3b82f6"/>
        <KpiCard label="Preço Médio / kWh" value={`R$\u00a0${priceKwh.toFixed(2).replace(".",",")}`} sub={`Ticket: ${brl(ticket)}`} accent="#ef4444"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16,marginBottom:28}}>
        <Panel>
          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:18,color:"#e8edf5"}}>Faturamento por Hub</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hubData} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="name" tick={{fill:"#2d3a52",fontSize:9,fontFamily:"'JetBrains Mono', monospace"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fill:"#2d3a52",fontSize:9,fontFamily:"'JetBrains Mono', monospace"}} axisLine={false} tickLine={false} width={52}/>
              <Tooltip content={<CustomTooltip suffix="R$"/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
              <Bar dataKey="rev" fill="rgba(0,229,160,0.65)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:18,color:"#e8edf5"}}>Top 5 Usuários</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><th style={TH}>#</th><th style={TH}>Usuário</th><th style={THR}>Sess.</th><th style={THR}>Total</th></tr></thead>
            <tbody>
              {top5.map(([name,d],i)=>{
                const rc=["#f59e0b","#94a3b8","#b47c3c"][i]||"#2d3a52";
                return(<tr key={name}><td style={TD}><span style={{fontFamily:"'JetBrains Mono', monospace",fontWeight:700,color:rc,fontSize:11}}>{i+1}</span></td><td style={TD}><span style={{fontSize:12,fontWeight:500}}>{trunc(name,16)}</span></td><td style={TDR}><span style={{background:"rgba(0,229,160,0.15)",color:"#00e5a0",padding:"2px 7px",borderRadius:5,fontSize:10}}>{d.sess}</span></td><td style={{...TDR,color:"#00e5a0",fontWeight:600}}>{brl(d.rev)}</td></tr>);
              })}
            </tbody>
          </table>
        </Panel>
      </div>
      <SectionLabel>Receita Diária</SectionLabel>
      <Panel style={{marginBottom:28}}>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={dayData}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/>
            <XAxis dataKey="date" tick={{fill:"#2d3a52",fontSize:9,fontFamily:"'JetBrains Mono', monospace"}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
            <YAxis tickFormatter={v=>`R$${v.toLocaleString("pt-BR",{minimumFractionDigits:0})}`} tick={{fill:"#2d3a52",fontSize:9,fontFamily:"'JetBrains Mono', monospace"}} axisLine={false} tickLine={false} width={68}/>
            <Tooltip content={<CustomTooltip suffix="R$"/>} cursor={{stroke:"rgba(255,255,255,0.06)"}}/>
            <ReferenceLine y={avgRev} stroke="rgba(245,158,11,0.4)" strokeDasharray="5 4" strokeWidth={1.5}/>
            <Line dataKey="rev" stroke="#00e5a0" strokeWidth={2} dot={{r:3,fill:"#00e5a0"}} activeDot={{r:5}}/>
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <SectionLabel>Heatmap de Atividade por Hora</SectionLabel>
      <Panel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:3}}>
          {hourData.map((h,hr)=>(
            <div key={hr} title={`${hr}h: ${h.sess} sessões`} style={{height:36,borderRadius:4,background:heatColor(h.sess,maxHour),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,0.8)",cursor:"default"}}>
              {h.sess>0?h.sess:""}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:3,marginTop:4}}>
          {Array.from({length:24},(_,hr)=>(<div key={hr} style={{fontSize:8,color:"#2d3a52",textAlign:"center",fontFamily:"'JetBrains Mono', monospace"}}>{hr}h</div>))}
        </div>
      </Panel>
    </div>
  );
}

// ─── TAB USUÁRIOS ────────────────────────────────────────────────────────────
function TabUsuarios({sessions,appState}:{sessions:Session[];appState:AppState}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const sorted=[...users].sort((a,b)=>b.rev-a.rev);
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const parceiros=users.filter(u=>u.isParceiro);
  const motoristas=users.filter(u=>u.isMotorista);
  const heavys=users.filter(u=>u.isHeavy);
  const shoppers=users.filter(u=>!u.isParceiro&&!u.isMotorista&&!u.isHeavy);
  const pieData=[{name:"Motoristas",value:motoristas.length,color:"#ef4444"},{name:"Heavy",value:heavys.length,color:"#f59e0b"},{name:"Shoppers",value:shoppers.length,color:"#22c55e"},{name:"Parceiros",value:parceiros.length,color:"#3b82f6"}].filter(d=>d.value>0);
  // Telefones disponíveis (contatos importados + Move)
  const telMap:Record<string,string>={};
  Object.values(appState.contatos).forEach(c=>{c.dados.forEach(d=>{if(d.telefone)telMap[d.nome.trim().toLowerCase()]=d.telefone;});});
  const getTel=(nome:string)=>{
    const n=nome.trim().toLowerCase();
    if(telMap[n])return telMap[n];
    const found=Object.keys(telMap).find(k=>k.includes(n)||n.includes(k));
    return found?telMap[found]:null;
  };
  // VIP Score para motoristas
  const vipScores:Record<string,ReturnType<typeof calcVipScore>>={};
  motoristas.forEach(u=>{vipScores[u.user]=calcVipScore(u.user,ok);});
  return(
    <div style={{padding:"24px 28px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <KpiCard label="Total Usuários" value={`${users.length}`} sub="únicos no período" accent="#00e5a0"/>
        <KpiCard label="Motoristas App" value={`${motoristas.length}`} sub="alvos prioritários" accent="#ef4444"/>
        <KpiCard label="Heavy Users" value={`${heavys.length}`} sub="potencial upgrade" accent="#f59e0b"/>
        <KpiCard label="Parceiros" value={`${parceiros.length}`} sub="blindados" accent="#3b82f6"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16,marginBottom:28}}>
        <Panel>
          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:16,color:"#e8edf5"}}>Segmentação</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
              </Pie>
              <Tooltip formatter={(v,n)=>[`${v} usuários`,n]} contentStyle={{background:"#181d28",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,fontFamily:"'JetBrains Mono', monospace",fontSize:11}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:8}}>
            {pieData.map(d=><span key={d.name} style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:d.color}}>■ {d.name}</span>)}
          </div>
        </Panel>
        <Panel>
          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:16,color:"#e8edf5"}}>Receita por Segmento</div>
          {[{label:"🔴 Motoristas",rev:motoristas.reduce((a,u)=>a+u.rev,0),color:"#ef4444"},{label:"🟡 Heavy Users",rev:heavys.reduce((a,u)=>a+u.rev,0),color:"#f59e0b"},{label:"🟢 Shoppers",rev:shoppers.reduce((a,u)=>a+u.rev,0),color:"#22c55e"},{label:"🔵 Parceiros",rev:parceiros.reduce((a,u)=>a+u.rev,0),color:"#3b82f6"}].map(seg=>{
            const pct=totalRev>0?(seg.rev/totalRev)*100:0;
            return(
              <div key={seg.label} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'JetBrains Mono', monospace",fontSize:11,marginBottom:5}}>
                  <span style={{color:"#6b7fa3"}}>{seg.label}</span>
                  <span style={{color:seg.color,fontWeight:600}}>{brl(seg.rev)} <span style={{color:"#2d3a52"}}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div style={{height:4,background:"#181d28",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:seg.color,borderRadius:2}}/>
                </div>
              </div>
            );
          })}
        </Panel>
      </div>

      {/* VIP Score — motoristas */}
      {motoristas.length>0&&(
        <>
          <SectionLabel>🏆 VIP Score — Motoristas App</SectionLabel>
          <Panel style={{marginBottom:24}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:10,overflow:"hidden",marginBottom:14}}>
              {[{label:"🟢 VIP Ativo",count:motoristas.filter(u=>vipScores[u.user]?.status==="ativo").length,color:T.green},{label:"🟡 Regular",count:motoristas.filter(u=>vipScores[u.user]?.status==="regular").length,color:T.amber},{label:"🟠 Em Risco",count:motoristas.filter(u=>vipScores[u.user]?.status==="em_risco").length,color:"#fb923c"},{label:"🔴 Churn",count:motoristas.filter(u=>vipScores[u.user]?.status==="churned").length,color:T.red}].map((s,i)=>(
                <div key={i} style={{background:T.bg2,padding:"12px 16px",textAlign:"center"}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginBottom:6}}>{s.label}</div>
                  <div style={{fontFamily:T.sans,fontSize:24,fontWeight:700,color:s.color}}>{s.count}</div>
                </div>
              ))}
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><th style={TH}>Motorista</th><th style={TH}>Hub</th><th style={THR}>Score</th><th style={THR}>Freq/sem</th><th style={THR}>Dias sem recarga</th><th style={TH}>Status VIP</th><th style={TH}>Telefone</th></tr></thead>
              <tbody>
                {motoristas.sort((a,b)=>(vipScores[b.user]?.score||0)-(vipScores[a.user]?.score||0)).map(u=>{
                  const v=vipScores[u.user];
                  const tel=getTel(u.user);
                  const statusColor=v?.status==="ativo"?T.green:v?.status==="regular"?T.amber:v?.status==="em_risco"?"#fb923c":T.red;
                  const statusEmoji=v?.status==="ativo"?"🟢":v?.status==="regular"?"🟡":v?.status==="em_risco"?"🟠":"🔴";
                  return(
                    <tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                      <td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,20)}</span></td>
                      <td style={{...TD,fontSize:11,color:T.text2}}>{hubNome(u.localFreqKey)}</td>
                      <td style={TDR}>
                        <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                          <div style={{width:40,height:4,background:T.bg3,borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${v?.score||0}%`,background:statusColor,borderRadius:2}}/>
                          </div>
                          <span style={{color:statusColor,fontWeight:600,fontSize:11}}>{v?.score||0}</span>
                        </div>
                      </td>
                      <td style={{...TDR,color:T.text2}}>{v?.freqAtual||0}x</td>
                      <td style={{...TDR,color:v&&v.diasSemRecarga>14?T.red:v&&v.diasSemRecarga>7?T.amber:T.text2}}>{v?.diasSemRecarga||0}d</td>
                      <td style={TD}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:`${statusColor}20`,color:statusColor,fontFamily:T.mono}}>{statusEmoji} {v?.status||"—"}</span></td>
                      <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel?`📞 ${tel}`:"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      <SectionLabel>Torre de Controle — Todos os Usuários</SectionLabel>
      <Panel style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            <th style={TH}>#</th><th style={TH}>Perfil</th><th style={TH}>Usuário</th>
            <th style={TH}>Hub</th><th style={THR}>Sess.</th>
            <th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Telefone</th>
          </tr></thead>
          <tbody>
            {sorted.map((u,i)=>{
              const tel=getTel(u.user);
              const bgRow=u.isParceiro?"rgba(59,130,246,0.04)":u.isMotorista?"rgba(239,68,68,0.04)":u.isHeavy?"rgba(234,179,8,0.03)":"";
              return(
                <tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)",background:bgRow}}>
                  <td style={{...TD,color:"#2d3a52",width:32,fontFamily:"'JetBrains Mono', monospace",fontSize:10}}>{i+1}</td>
                  <td style={TD}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:`${u.perfilCor}20`,color:u.perfilCor,fontFamily:"'JetBrains Mono', monospace"}}>{u.perfil}</span></td>
                  <td style={TD}><span style={{fontWeight:500,fontSize:12}}>{trunc(u.user,20)}</span>{u.isParceiro&&<span style={{fontSize:9,marginLeft:6,color:"#3b82f6"}}>🔒</span>}</td>
                  <td style={{...TD,fontSize:11,color:"#6b7fa3"}}>{hubNome(u.localFreqKey)||u.localFreq}</td>
                  <td style={TDR}><span style={{background:"rgba(0,229,160,0.15)",color:"#00e5a0",padding:"2px 7px",borderRadius:5,fontSize:10}}>{u.sess}</span></td>
                  <td style={{...TDR,color:"#6b7fa3"}}>{u.kwh.toFixed(1)}</td>
                  <td style={{...TDR,color:"#00e5a0",fontWeight:600}}>{brl(u.rev)}</td>
                  <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ─── TAB DRE ─────────────────────────────────────────────────────────────────
function TabDRE({sessions,appState,onSaveDRE}:{sessions:Session[];appState:AppState;onSaveDRE:(key:string,cfg:DREConfig)=>void}){
  const hubs=useMemo(()=>Array.from(new Set(sessions.map(s=>s.hubKey))).sort(),[sessions]);
  const[station,setStation]=useState(hubs[0]||"");
  const defaultCFG:DREConfig={modelo:"investidor",pctEspaco:50,pctImposto:7,pctApp:7,fixoInternet:260,fixoAluguel:0,energiaTipo:"incluido",energiaKwh:0,usinaFixo:208.37,invNome:"FL BR SOLUÇÕES SUSTENTÁVEIS LTDA",invPct:50,invTotal:150000,invPago:100000,invDividaPrio:14705.39,invAmort:1846.49,propriaInstalacao:100000,propriaAmort:0,solarProprio:false};
  const[cfg,setCfg]=useState<DREConfig>(appState.dreConfigs[station]||defaultCFG);
  useEffect(()=>{setCfg(appState.dreConfigs[station]||defaultCFG);},[station,appState.dreConfigs]);
  const stF=(s:Session)=>s.hubKey===station;
  const sessoes=sessions.filter(s=>!s.cancelled&&s.energy>0&&stF(s));
  const datas=sessoes.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const bruto=sessoes.reduce((a,s)=>a+s.value,0);
  const totalKwh=sessoes.reduce((a,s)=>a+s.energy,0);
  const diasNoMes=30;
  const faturMensal=bruto/periodDays*diasNoMes,faturAnual=faturMensal*12;
  const aliq=cfg.modelo==="propria"?dreSimples(faturAnual):cfg.pctImposto;
  const impostoVal=bruto*(aliq/100),custoEspaco=bruto*(cfg.pctEspaco/100),custoApp=bruto*(cfg.pctApp/100);
  let custoEnergia=0;
  if(!cfg.solarProprio){if(cfg.energiaTipo==="kwh")custoEnergia=totalKwh*cfg.energiaKwh;if(cfg.energiaTipo==="usina")custoEnergia=cfg.usinaFixo;}
  const fixos=cfg.fixoInternet+cfg.fixoAluguel;
  const ll=bruto-custoEspaco-impostoVal-custoApp-custoEnergia-fixos;
  const margem=bruto>0?(ll/bruto)*100:0;
  const repInv=cfg.modelo==="investidor"?ll*(cfg.invPct/100):0;
  const repHz=cfg.modelo==="investidor"?ll*((100-cfg.invPct)/100):ll;
  const retMensalInv=repInv/periodDays*diasNoMes;
  const rentAnual=cfg.invTotal>0?(repInv/cfg.invTotal)*100*(diasNoMes/periodDays)*12:0;
  const restPrio=Math.max(0,cfg.invDividaPrio-cfg.invAmort);
  const restInv=Math.max(0,(cfg.invTotal-cfg.invPago)-Math.max(0,cfg.invAmort-cfg.invDividaPrio));
  let amPrio=0,amInv=0,disp=repInv;
  if(cfg.modelo==="investidor"){if(restPrio>0){amPrio=Math.min(disp,restPrio);disp-=amPrio;}if(restInv>0){amInv=Math.min(disp,restInv);disp-=amInv;}}
  const faltaAmort=Math.max(0,cfg.invTotal-(cfg.invAmort+amPrio+amInv));
  const mesesPay=retMensalInv>0?faltaAmort/retMensalInv:Infinity;
  const tot=cfg.invDividaPrio+(cfg.invTotal-cfg.invPago);
  const pMat=tot>0?Math.min(100,(Math.min(cfg.invAmort,cfg.invDividaPrio)/tot)*100):0;
  const pPrev=tot>0?Math.min(100,(Math.max(0,cfg.invAmort-cfg.invDividaPrio)/tot)*100):0;
  const pCur=tot>0?Math.min(100,((amPrio+amInv)/tot)*100):0;
  const[saved,setSaved]=useState(false);
  const inp=(id:keyof DREConfig,label:string,type:"number"|"text"|"select",opts?:string[])=>(
    <div>
      <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",marginBottom:4}}>{label}</div>
      {type==="select"?(<select value={cfg[id] as string} onChange={e=>setCfg(p=>({...p,[id]:e.target.value}))} style={{width:"100%",background:"#181d28",border:"1px solid rgba(255,255,255,0.07)",color:"#e8edf5",padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono', monospace"}}>{opts?.map(o=><option key={o} value={o}>{o}</option>)}</select>)
      :(<input type={type} min={0} value={cfg[id] as string|number} onChange={e=>setCfg(p=>({...p,[id]:type==="number"?+e.target.value:e.target.value}))} style={{width:"100%",background:"#181d28",border:"1px solid rgba(255,255,255,0.07)",color:"#e8edf5",padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono', monospace"}}/>)}
    </div>
  );
  const dreRows=[
    {label:"(+) Receita Bruta",val:bruto,bold:true},
    cfg.pctEspaco>0?{label:`(−) Parceiro Espaço (${cfg.pctEspaco}%)`,val:-custoEspaco}:null,
    {label:`(−) Imposto (${aliq.toFixed(1)}%${cfg.modelo==="propria"?" Simples":" bruto"})`,val:-impostoVal},
    {label:`(−) App/Plataforma (${cfg.pctApp}%)`,val:-custoApp},
    cfg.energiaTipo!=="incluido"?{label:"(−) Energia",val:-custoEnergia}:null,
    cfg.fixoAluguel>0?{label:"(−) Aluguel",val:-cfg.fixoAluguel}:null,
    cfg.fixoInternet>0?{label:"(−) Internet / Adm",val:-cfg.fixoInternet}:null,
    {label:"= Lucro Líquido",val:ll,bold:true,sep:true},
    cfg.modelo==="investidor"?{label:`→ ${cfg.invNome||"Investidor"} (${cfg.invPct}%)`,val:repInv,accent:"#f59e0b"}:null,
    {label:`→ HertzGo (${cfg.modelo==="investidor"?100-cfg.invPct:100}%)`,val:repHz,accent:"#00e5a0"},
  ].filter(Boolean) as{label:string;val:number;bold?:boolean;sep?:boolean;accent?:string}[];
  return(
    <div style={{padding:"24px 28px"}}>
      {sessoes.length>0&&(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <KpiCard label="Receita Bruta" value={brl(bruto)} sub={`${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`} accent="#00e5a0"/>
        <KpiCard label="Lucro Líquido" value={brl(ll)} sub={`Margem ${margem.toFixed(1)}%`} accent={ll>=0?"#00e5a0":"#ef4444"}/>
        <KpiCard label="Proj. Mensal" value={brl(faturMensal)} sub="base 30 dias" accent="#f59e0b"/>
        <KpiCard label="Proj. Anual" value={brl(faturAnual)} sub="receita bruta" accent="#3b82f6"/>
      </div>)}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Panel>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:15,fontWeight:600,color:"#e8edf5"}}>⚙️ Configuração</div>
            <button onClick={()=>{onSaveDRE(station,cfg);setSaved(true);setTimeout(()=>setSaved(false),2000);}} style={{background:saved?"rgba(0,229,160,0.2)":"rgba(0,229,160,0.08)",border:`1px solid ${saved?"#00e5a0":"rgba(0,229,160,0.2)"}`,color:"#00e5a0",padding:"5px 14px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono', monospace",transition:"all 0.3s"}}>
              {saved?"✅ Salvo":"💾 Salvar"}
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div>
              <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",marginBottom:4}}>Estação</div>
              <select value={station} onChange={e=>setStation(e.target.value)} style={{width:"100%",background:"#181d28",border:"1px solid rgba(255,255,255,0.07)",color:"#e8edf5",padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono', monospace"}}>
                {hubs.map(h=><option key={h} value={h}>{hubNome(h)}</option>)}
              </select>
            </div>
            {inp("modelo","Modelo","select",["investidor","propria"])}
            {inp("pctEspaco","% Parceiro Espaço","number")}{inp("pctImposto","% Imposto","number")}
            {inp("pctApp","% App/Plataforma","number")}{inp("fixoInternet","Internet / Adm (R$)","number")}
            {inp("fixoAluguel","Aluguel (R$)","number")}{inp("energiaTipo","Custo Energia","select",["incluido","kwh","usina"])}
            {cfg.energiaTipo==="kwh"&&inp("energiaKwh","R$ / kWh","number")}
            {cfg.energiaTipo==="usina"&&inp("usinaFixo","Custo Usina (R$)","number")}
          </div>
          {cfg.modelo==="investidor"&&(<><div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52",letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"16px 0 10px",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:14}}>Investidor / Split</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{inp("invNome","Nome Investidor","text")}{inp("invPct","% Investidor do LL","number")}{inp("invTotal","Investimento Total","number")}{inp("invPago","Já Investido","number")}{inp("invDividaPrio","Dívida Prioritária","number")}{inp("invAmort","Já Amortizado","number")}</div></>)}
          {cfg.modelo==="propria"&&(<><div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52",letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"16px 0 10px",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:14}}>Loja Própria</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{inp("propriaInstalacao","Custo Instalação","number")}{inp("propriaAmort","Já Amortizado","number")}</div></>)}
          <label style={{display:"flex",alignItems:"center",gap:8,marginTop:14,cursor:"pointer",fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:"#6b7fa3"}}>
            <input type="checkbox" checked={cfg.solarProprio} onChange={e=>setCfg(p=>({...p,solarProprio:e.target.checked}))} style={{accentColor:"#ffd600",width:14,height:14}}/>
            ☀️ Investidor com Usina Solar Própria (energia = R$0)
          </label>
        </Panel>
        <div>
          <Panel style={{marginBottom:16}}>
            <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:15,fontWeight:600,marginBottom:16,color:"#e8edf5"}}>📋 DRE — {hubNome(station)}</div>
            {sessoes.length===0?(<div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:12,color:"#2d3a52",padding:"24px 0",textAlign:"center"}}>Nenhuma sessão encontrada para esta estação.</div>):(
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'JetBrains Mono', monospace",fontSize:12}}>
                <thead><tr><th style={TH}>Item</th><th style={THR}>Período</th><th style={THR}>Proj. Mensal</th><th style={THR}>%</th></tr></thead>
                <tbody>{dreRows.map((r,i)=>(<tr key={i} style={{borderTop:r.sep?"1px solid rgba(255,255,255,0.07)":"none",borderBottom:"1px solid rgba(255,255,255,0.02)"}}><td style={{...TD,fontWeight:r.bold?700:400,color:r.accent||(r.val>=0?"#e8edf5":"#ef4444")}}>{r.label}</td><td style={{...TDR,color:r.accent||(r.val>=0?"#00e5a0":"#ef4444"),fontWeight:r.bold?700:400}}>{brl(r.val)}</td><td style={{...TDR,color:"#6b7fa3"}}>{brl(r.val*(diasNoMes/periodDays))}</td><td style={{...TDR,color:"#2d3a52"}}>{bruto>0?`${(Math.abs(r.val)/bruto*100).toFixed(1)}%`:"—"}</td></tr>))}</tbody>
              </table>
            )}
          </Panel>
          {cfg.modelo==="investidor"&&sessoes.length>0&&(
            <Panel>
              <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:14,color:"#e8edf5"}}>👤 Painel do Investidor</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <KpiCard label="Retorno Período" value={brl(repInv)} sub={`${brl(retMensalInv)}/mês proj.`} accent="#f59e0b" small/>
                <KpiCard label="Rentabilidade Anual" value={`${rentAnual.toFixed(1)}%`} sub="sobre capital total" accent={rentAnual>=12?"#00e5a0":"#f59e0b"} small/>
                <KpiCard label="Payback Estimado" value={mesesPay===Infinity?"—":mesesPay<12?`${Math.ceil(mesesPay)} meses`:`${(mesesPay/12).toFixed(1)} anos`} sub="para amortizar saldo" accent={mesesPay<=36?"#00e5a0":"#f59e0b"} small/>
                <KpiCard label="Saldo Devedor" value={faltaAmort<=0?"✅ Quitado":brl(faltaAmort)} sub={faltaAmort<=0?"Payback completo!":"restante"} accent={faltaAmort<=0?"#00e5a0":"#ef4444"} small/>
              </div>
              <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#6b7fa3",marginBottom:8}}>📊 Progresso do Payback</div>
              <div style={{background:"#181d28",borderRadius:6,height:22,overflow:"hidden",position:"relative",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pMat}%`,background:"rgba(239,68,68,0.7)"}}/>
                <div style={{position:"absolute",left:`${pMat}%`,top:0,height:"100%",width:`${pPrev}%`,background:"rgba(245,158,11,0.6)"}}/>
                <div style={{position:"absolute",left:`${pMat+pPrev}%`,top:0,height:"100%",width:`${pCur}%`,background:"rgba(0,229,160,0.8)"}}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontFamily:"'JetBrains Mono', monospace",color:"#fff",fontWeight:600}}>{(pMat+pPrev+pCur).toFixed(1)}% amortizado</div>
              </div>
              <div style={{display:"flex",gap:12,marginTop:6,fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#2d3a52"}}>
                <span><span style={{color:"#ef4444"}}>■</span> Materiais</span>
                <span><span style={{color:"#f59e0b"}}>■</span> Anterior</span>
                <span><span style={{color:"#00e5a0"}}>■</span> Este período</span>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB AÇÕES ───────────────────────────────────────────────────────────────
function TabAcoes({sessions,appState,onSaveDisparos}:{sessions:Session[];appState:AppState;onSaveDisparos:(d:AppState["disparos"])=>void}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const[zapiStatus,setZapiStatus]=useState<"unknown"|"ok"|"err">("unknown");
  const[sending,setSending]=useState<Record<string,boolean>>({});
  const[localDisparos,setLocalDisparos]=useState(appState.disparos);
  useEffect(()=>{fetch("/api/zapi").then(r=>r.json()).then(d=>{setZapiStatus(d.configured&&d.connected?"ok":"err");}).catch(()=>setZapiStatus("err"));},[]);

  // Contatos disponíveis
  const telMap:Record<string,string>={};
  Object.values(appState.contatos).forEach(c=>{c.dados.forEach(d=>{if(d.telefone)telMap[d.nome.trim().toLowerCase()]=d.telefone;});});
  const getTel=(nome:string)=>{const n=nome.trim().toLowerCase();if(telMap[n])return telMap[n];const found=Object.keys(telMap).find(k=>k.includes(n)||n.includes(k));return found?telMap[found]:null;};

  // Gap Zero — não disparar se já foi contatado nos últimos 30 dias
  const jaContatado=(nome:string)=>localDisparos.some(d=>d.nome===nome&&d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<30*86400000);

  const leads=users.filter(u=>!u.isParceiro&&!jaContatado(u.user));
  const motoristas=users.filter(u=>u.isMotorista&&!u.isParceiro);

  const montarMsg=(template:string,nome:string,hubK:string,cupom:string)=>{
    return template
      .replace(/\[nome\]/gi,nome.split(" ")[0])
      .replace(/\[local\]/gi,hubNome(hubK))
      .replace(/\[cupom\]/gi,cupom)
      .replace(/\[beneficio\]/gi,"prioridade no carregador e desconto exclusivo");
  };

  const getMsgKey=(hubK:string,tipo:"motorista"|"nao_motorista")=>{
    if(tipo==="motorista"){
      if(hubK==="costa"||hubK==="mamute")return{key:"msg2a_parkway",cupomKey:"cupom_parkway"};
      if(hubK==="madeiro")return{key:"msg2a_cidadeauto",cupomKey:"cupom_cidadeauto"};
      return{key:"msg2a_vip_parkway",cupomKey:"cupom_vip"};
    }
    if(ESTACAO_PROPRIA.includes(hubK)||ESTACAO_PARCERIA.includes(hubK)){
      if(hubK==="costa")return{key:"msg2b_costa",cupomKey:"cupom_costa"};
      if(hubK==="parkway")return{key:"msg2b_parkway",cupomKey:"cupom_parkway"};
      return{key:"msg2b_cidadeauto",cupomKey:"cupom_cidadeauto"};
    }
    return null; // contratual — não enviar
  };

  const enviar=async(user:string,hubK:string,msgTemplate:string,telefone:string)=>{
    setSending(p=>({...p,[user]:true}));
    const nome=user.split(" ")[0];
    const msg=montarMsg(msgTemplate,nome,hubK,"");
    try{
      const r=await fetch("/api/zapi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:telefone,message:msg})});
      const d=await r.json();
      const entry={ts:new Date().toISOString(),nome:user,msgId:"msg1",status:d.ok?"ok" as const:"err" as const,msg:d.erro};
      const updated=[entry,...localDisparos.slice(0,199)];
      setLocalDisparos(updated);
      onSaveDisparos(updated);
    }catch{
      const entry={ts:new Date().toISOString(),nome:user,msgId:"msg1",status:"err" as const,msg:"Erro de rede"};
      const updated=[entry,...localDisparos.slice(0,199)];
      setLocalDisparos(updated);
      onSaveDisparos(updated);
    }
    setSending(p=>({...p,[user]:false}));
  };

  return(
    <div style={{padding:"24px 28px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <KpiCard label="Z-API Status" value={zapiStatus==="ok"?"✅ Conectada":zapiStatus==="err"?"⚠️ Verificar":"⏳ Testando"} sub="via API Route Vercel" accent={zapiStatus==="ok"?"#00e5a0":"#f59e0b"} small/>
        <KpiCard label="Leads p/ MSG 1" value={`${leads.length}`} sub="nunca contatados (Gap Zero)" accent="#ef4444" small/>
        <KpiCard label="Gap Zero Ativo" value={`${localDisparos.filter(d=>d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<30*86400000).length}`} sub="contatados nos últimos 30d" accent="#f59e0b" small/>
        <KpiCard label="Total Disparos" value={`${localDisparos.filter(d=>d.status==="ok").length}`} sub="enviados com sucesso" accent="#00e5a0" small/>
      </div>

      {zapiStatus==="err"&&(<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"14px 18px",marginBottom:20,fontFamily:"'JetBrains Mono', monospace",fontSize:12,color:"#f59e0b"}}>⚠️ Configure no Vercel: <strong>ZAPI_INSTANCE_ID</strong> · <strong>ZAPI_TOKEN</strong> · <strong>ZAPI_CLIENT_TOKEN</strong></div>)}

      <SectionLabel>🔴 Fila MSG 1 — Novos Usuários (nunca contatados)</SectionLabel>
      <Panel style={{padding:0,overflow:"hidden",marginBottom:24}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><th style={TH}>Perfil</th><th style={TH}>Usuário</th><th style={TH}>Hub</th><th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Telefone</th><th style={THR}>Ação</th></tr></thead>
          <tbody>
            {leads.length===0&&(<tr><td colSpan={7} style={{...TD,textAlign:"center",color:T.text3,padding:"24px"}}>✅ Todos os usuários já foram contatados nos últimos 30 dias (Gap Zero ativo)</td></tr>)}
            {leads.slice(0,50).map(u=>{
              const tel=getTel(u.user);
              return(
                <tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                  <td style={TD}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:`${u.perfilCor}20`,color:u.perfilCor,fontFamily:"'JetBrains Mono', monospace"}}>{u.perfil}</span></td>
                  <td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,22)}</span></td>
                  <td style={{...TD,fontSize:11,color:T.text2}}>{hubNome(u.localFreqKey)}</td>
                  <td style={{...TDR,color:T.text2}}>{u.kwh.toFixed(1)}</td>
                  <td style={{...TDR,color:"#00e5a0",fontWeight:600}}>{brl(u.rev)}</td>
                  <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel||"⚠️ sem telefone"}</td>
                  <td style={TDR}>
                    {tel?(
                      <button onClick={()=>enviar(u.user,u.localFreqKey,appState.mensagens.msg1,tel)} disabled={sending[u.user]} style={{padding:"4px 12px",borderRadius:6,fontFamily:"'JetBrains Mono', monospace",fontSize:10,cursor:sending[u.user]?"not-allowed":"pointer",background:sending[u.user]?"rgba(255,255,255,0.05)":"rgba(0,229,160,0.15)",border:`1px solid ${sending[u.user]?"rgba(255,255,255,0.07)":"rgba(0,229,160,0.3)"}`,color:sending[u.user]?T.text3:T.green,transition:"all 0.2s"}}>
                        {sending[u.user]?"⏳":"📤 MSG 1"}
                      </button>
                    ):<span style={{color:T.text3,fontSize:10,fontFamily:T.mono}}>sem tel</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {localDisparos.length>0&&(
        <>
          <SectionLabel>📋 Histórico de Disparos (persistido)</SectionLabel>
          <Panel style={{maxHeight:200,overflowY:"auto"}}>
            {localDisparos.slice(0,50).map((l,i)=>(
              <div key={i} style={{display:"flex",gap:12,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontFamily:"'JetBrains Mono', monospace",fontSize:11}}>
                <span style={{color:T.text3}}>{new Date(l.ts).toLocaleString("pt-BR")}</span>
                <span style={{color:l.status==="ok"?T.green:T.red}}>{l.status==="ok"?"✅":"❌"}</span>
                <span style={{color:T.text}}>{l.nome}</span>
                <span style={{color:T.text3,fontSize:9}}>{l.msgId}</span>
                {l.msg&&<span style={{color:T.red,fontSize:10}}>{l.msg}</span>}
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}

// ─── TAB CONFIG ──────────────────────────────────────────────────────────────
function TabConfig({appState,onSave}:{appState:AppState;onSave:(partial:Partial<AppState>)=>void}){
  const[activeSection,setActiveSection]=useState<"contatos"|"mensagens"|"zapi">("contatos");
  const[msgs,setMsgs]=useState<Mensagens>(appState.mensagens);
  const[msgSaved,setMsgSaved]=useState(false);
  const[uploadStatus,setUploadStatus]=useState<Record<string,string>>({});
  const inputRefs:Record<string,React.RefObject<HTMLInputElement>>={
    costa:useRef<HTMLInputElement>(null),
    parkway:useRef<HTMLInputElement>(null),
    cidadeauto:useRef<HTMLInputElement>(null),
    mamute:useRef<HTMLInputElement>(null),
    madeiro:useRef<HTMLInputElement>(null),
  };

  const handleContactUpload=async(estacaoKey:string,file:File)=>{
    try{
      const text=await file.text();
      const dados=parseContatos(text);
      const comTel=dados.filter(d=>d.telefone).length;
      const updated:Contatos={...appState.contatos,[estacaoKey]:{importadoEm:new Date().toISOString(),total:dados.length,comTelefone:comTel,dados}};
      onSave({contatos:updated});
      setUploadStatus(p=>({...p,[estacaoKey]:`✅ ${dados.length} usuários · ${comTel} com telefone`}));
    }catch(e){setUploadStatus(p=>({...p,[estacaoKey]:`❌ Erro: ${(e as Error).message}`}));}
  };

  const estacoes=[
    {key:"costa",nome:"Costa Atacadão",tipo:"Parceria",cor:"#f59e0b"},
    {key:"parkway",nome:"Park Way",tipo:"Própria",cor:"#00e5a0"},
    {key:"cidadeauto",nome:"Cidade do Automóvel",tipo:"Própria",cor:"#00e5a0"},
    {key:"mamute",nome:"Lava Jato do Mamute",tipo:"Contratual",cor:"#6b7fa3"},
    {key:"madeiro",nome:"Madeiro & Jerônimo",tipo:"Contratual",cor:"#6b7fa3"},
  ];

  const msgFields:[keyof Mensagens,string][]=[
    ["msg1","📤 MSG 1 — Qualificação (todos os novos)"],
    ["msg2a_parkway","🟢 MSG 2A — Motorista → Park Way"],
    ["msg2a_cidadeauto","🟢 MSG 2A — Motorista → Cidade do Automóvel"],
    ["msg2a_vip_parkway","🏆 MSG VIP — Motorista fidelizado Park Way"],
    ["msg2a_vip_cidadeauto","🏆 MSG VIP — Motorista fidelizado Cidade Auto"],
    ["msg2b_costa","🛒 MSG 2B — Não motorista Costa (desconto supermercado)"],
    ["msg2b_parkway","💚 MSG 2B — Não motorista Park Way"],
    ["msg2b_cidadeauto","💚 MSG 2B — Não motorista Cidade Auto"],
    ["msg_risco","🟠 MSG Risco — VIP em queda de frequência"],
    ["msg_churn","🔴 MSG Churn — Sumiu há 14+ dias"],
    ["cupom_parkway","🎟️ Cupom Park Way"],
    ["cupom_cidadeauto","🎟️ Cupom Cidade do Automóvel"],
    ["cupom_costa","🎟️ Cupom Costa Atacadão"],
    ["cupom_vip","🎟️ Cupom VIP"],
  ];

  return(
    <div style={{padding:"24px 28px"}}>
      {/* Navegação interna */}
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        {([["contatos","📱 Contatos por Estação"],["mensagens","✉️ Mensagens"],["zapi","🔌 Z-API"]] as [string,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setActiveSection(id as typeof activeSection)} style={{padding:"7px 16px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeSection===id?T.green:T.border}`,background:activeSection===id?T.greenDim:"transparent",color:activeSection===id?T.green:T.text2,transition:"all 0.2s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* CONTATOS */}
      {activeSection==="contatos"&&(
        <>
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#93c5fd",marginBottom:20}}>
            ℹ️ Importe o CSV de usuários de cada estação (Spott CMS → Usuários → Exportar CSV). Faça isso 1x por semana. Os telefones são cruzados automaticamente com os nomes do CSV de transações.
          </div>
          {estacoes.map(est=>{
            const c=appState.contatos[est.key];
            const status=uploadStatus[est.key];
            return(
              <div key={est.key} style={{marginBottom:12,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>{est.nome}</span>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:`${est.cor}20`,color:est.cor,fontFamily:T.mono,border:`1px solid ${est.cor}30`}}>{est.tipo}</span>
                    </div>
                    {c?(
                      <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>
                        {c.total} usuários · {c.comTelefone} com telefone · importado em {new Date(c.importadoEm).toLocaleDateString("pt-BR")}
                      </div>
                    ):<div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>Nenhum CSV importado ainda</div>}
                    {status&&<div style={{fontFamily:T.mono,fontSize:10,marginTop:4,color:status.startsWith("✅")?T.green:T.red}}>{status}</div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input ref={inputRefs[est.key]} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleContactUpload(est.key,e.target.files[0]);}}/>
                    <button onClick={()=>inputRefs[est.key]?.current?.click()} style={{background:T.greenDim,border:"1px solid rgba(0,229,160,0.3)",color:T.green,padding:"6px 14px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:T.mono}}>
                      📂 Importar CSV
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* MENSAGENS */}
      {activeSection==="mensagens"&&(
        <>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#fcd34d",marginBottom:20}}>
            ℹ️ Use [nome], [local], [cupom] e [beneficio] nas mensagens — substituídos automaticamente no envio.
          </div>
          {msgFields.map(([key,label])=>(
            <div key={key} style={{marginBottom:16}}>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:6}}>{label}</div>
              <textarea value={msgs[key]} onChange={e=>setMsgs(p=>({...p,[key]:e.target.value}))}
                style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"10px 12px",borderRadius:10,fontSize:12,fontFamily:T.mono,resize:"vertical",minHeight:key.startsWith("cupom")?40:90,lineHeight:1.6}}/>
            </div>
          ))}
          <button onClick={()=>{onSave({mensagens:msgs});setMsgSaved(true);setTimeout(()=>setMsgSaved(false),2000);}} style={{background:msgSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${msgSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 20px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono,transition:"all 0.3s"}}>
            {msgSaved?"✅ Mensagens salvas!":"💾 Salvar Mensagens"}
          </button>
        </>
      )}

      {/* Z-API */}
      {activeSection==="zapi"&&(
        <Panel>
          <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14,fontWeight:600,marginBottom:16,color:"#e8edf5"}}>📱 Z-API — WhatsApp</div>
          <div style={{fontFamily:T.mono,fontSize:12,color:T.text2,lineHeight:1.8,marginBottom:16}}>Configure no Vercel: <strong style={{color:T.text}}>Settings → Environment Variables</strong></div>
          {[{key:"ZAPI_INSTANCE_ID",desc:"Z-API → Instâncias → ID"},{key:"ZAPI_TOKEN",desc:"Z-API → Instâncias → Token"},{key:"ZAPI_CLIENT_TOKEN",desc:"Z-API → Conta → Security → Client-Token"}].map(v=>(
            <div key={v.key} style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,alignItems:"center",marginBottom:10,padding:"10px 14px",background:T.bg3,borderRadius:10,border:`1px solid ${T.border}`}}>
              <code style={{fontFamily:T.mono,fontSize:12,color:T.green,fontWeight:600}}>{v.key}</code>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{v.desc}</span>
            </div>
          ))}
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 14px",fontFamily:T.mono,fontSize:11,color:"#93c5fd",marginTop:12}}>
            ℹ️ Credenciais seguras no servidor. Disparos passam pela API Route <code style={{color:T.green}}>/api/zapi</code>.
          </div>
          <div style={{marginTop:16,fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:2}}>
            <div>⚡ <strong style={{color:T.text}}>HertzGo Vision v3.0</strong></div>
            <div>📊 Dashboard · Semáforo · Projeção · DRE persistido · CRM · Contatos · Mensagens configuráveis · Move XLSX</div>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function HertzGo(){
  useFonts();
  const[sessions,setSessions]=useState<Session[]|null>(null);
  const[tab,setTab]=useState<Tab>("dash");
  const[appState,setAppState]=useState<AppState>(()=>loadState());

  const savePartial=(partial:Partial<AppState>)=>{
    setAppState(prev=>{const next={...prev,...partial};saveState(next);return next;});
  };

  const hubKey_meta=(key:string)=>appState.metas[key]||0;
  const setMeta=(key:string,v:number)=>savePartial({metas:{...appState.metas,[key]:v}});
  const saveDRE=(key:string,cfg:DREConfig)=>savePartial({dreConfigs:{...appState.dreConfigs,[key]:cfg}});
  const saveDisparos=(d:AppState["disparos"])=>savePartial({disparos:d});

  // Hub ativo no dashboard
  const[activeHub,setActiveHub_]=useState("__all__");
  const currentMeta=activeHub==="__all__"?0:hubKey_meta(activeHub);
  const setCurrentMeta=(v:number)=>{if(activeHub!=="__all__")setMeta(activeHub,v);};

  const dts=sessions?sessions.map(s=>s.date.getTime()):[];
  const okSess=sessions?sessions.filter(s=>!s.cancelled&&s.energy>0).length:0;
  const uniqHubs=sessions?new Set(sessions.map(s=>s.hubKey)).size:0;
  const hasMove=sessions?sessions.some(s=>s.source==="move"):false;
  const hasSpott=sessions?sessions.some(s=>s.source==="spott"):false;

  const navItems:{id:Tab;label:string;icon:string}[]=[
    {id:"dash",label:"Dashboard",icon:"📊"},{id:"usuarios",label:"Usuários",icon:"👥"},
    {id:"dre",label:"DRE",icon:"💼"},{id:"acoes",label:"Ações",icon:"🎯"},{id:"config",label:"Config",icon:"⚙️"},
  ];

  if(!sessions)return(
    <div style={{minHeight:"100vh",background:"#080a0f",color:"#e8edf5",fontFamily:"'Space Grotesk', sans-serif"}}>
      <UploadScreen onFile={setSessions}/>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"#080a0f",color:"#e8edf5",fontFamily:"'Space Grotesk', sans-serif"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",height:60,background:"rgba(8,10,15,0.97)",borderBottom:"1px solid rgba(255,255,255,0.07)",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(16px)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"#00e5a0",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>⚡</div>
          <div>
            <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:16,fontWeight:700,letterSpacing:"-0.03em"}}>HertzGo</div>
            <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#6b7fa3",letterSpacing:"0.12em",textTransform:"uppercase"}}>Vision · Rede EV</div>
          </div>
        </div>
        <nav style={{display:"flex",gap:4}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{padding:"6px 14px",borderRadius:10,fontFamily:"'Space Grotesk', sans-serif",fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${tab===n.id?"#00e5a0":"rgba(255,255,255,0.07)"}`,background:tab===n.id?"rgba(0,229,160,0.15)":"transparent",color:tab===n.id?"#00e5a0":"#6b7fa3",transition:"all 0.2s",boxShadow:tab===n.id?"0 0 16px rgba(0,229,160,0.2)":"none"}}>
              <span style={{marginRight:5}}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {hasSpott&&<span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:9,padding:"2px 8px",borderRadius:4,background:"rgba(0,229,160,0.1)",color:"#00e5a0",border:"1px solid rgba(0,229,160,0.2)"}}>Spott</span>}
          {hasMove&&<span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:9,padding:"2px 8px",borderRadius:4,background:"rgba(59,130,246,0.1)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)"}}>Move</span>}
          <span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,padding:"3px 10px",borderRadius:20,background:"rgba(0,229,160,0.15)",color:"#00e5a0",border:"1px solid rgba(0,229,160,0.2)"}}>{okSess} sessões</span>
          <span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:10,padding:"3px 10px",borderRadius:20,background:"rgba(59,130,246,0.1)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)"}}>{uniqHubs} hubs</span>
          <button onClick={()=>{setSessions(null);setTab("dash");}} style={{padding:"4px 12px",borderRadius:20,fontFamily:"'JetBrains Mono', monospace",fontSize:10,cursor:"pointer",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444"}}>↩ Novo CSV</button>
        </div>
      </header>
      <main style={{flex:1}}>
        {tab==="dash"&&<TabDashboard sessions={sessions} meta={currentMeta} onMetaChange={setCurrentMeta}/>}
        {tab==="usuarios"&&<TabUsuarios sessions={sessions} appState={appState}/>}
        {tab==="dre"&&<TabDRE sessions={sessions} appState={appState} onSaveDRE={saveDRE}/>}
        {tab==="acoes"&&<TabAcoes sessions={sessions} appState={appState} onSaveDisparos={saveDisparos}/>}
        {tab==="config"&&<TabConfig appState={appState} onSave={savePartial}/>}
      </main>
      <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 28px",background:"rgba(8,10,15,0.97)",borderTop:"1px solid rgba(255,255,255,0.07)",fontFamily:"'JetBrains Mono', monospace",fontSize:10,color:"#2d3a52",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#00e5a0",boxShadow:"0 0 6px #00e5a0",display:"inline-block"}}/>
          {sessions.length} registros · {okSess} válidos · {uniqHubs} estações
          {dts.length>0&&` · ${new Date(Math.min(...dts)).toLocaleDateString("pt-BR")} → ${new Date(Math.max(...dts)).toLocaleDateString("pt-BR")}`}
        </div>
        <div>⚡ HertzGo Vision v3.0</div>
      </footer>
    </div>
  );
}