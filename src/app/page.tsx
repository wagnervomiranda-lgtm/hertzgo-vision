"use client";
import React from "react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, ScatterChart, Scatter, ZAxis,
} from "recharts";

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

// ─── PWA SERVICE WORKER ───────────────────────────────────────────────────────
function usePWA() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(() => console.info("✅ HertzGo PWA ativo"))
        .catch((e) => console.warn("SW:", e));
    }
  }, []);
}

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // null = ainda hidratando, trata como mobile para evitar flash no iPhone
  return isMobile === null ? (typeof window !== "undefined" ? window.innerWidth < 900 : false) : isMobile;
}

// ─── LOGO SVG ────────────────────────────────────────────────────────────────
function HertzGoLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="https://raw.githubusercontent.com/wagnervomiranda-lgtm/hertzgo-vision/main/Logo%20Atual.jpeg"
      alt="HertzGo"
      style={{ height: size, width: "auto", objectFit: "contain", display: "block" }}
    />
  );
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
  temCupom: boolean; precoMedioKwh: number;
}
interface DREConfig {
  modelo: "investidor" | "propria"; pctEspaco: number; pctImposto: number;
  pctApp: number; fixoInternet: number; fixoAluguel: number;
  energiaTipo: "incluido" | "kwh" | "usina"; energiaKwh: number; usinaFixo: number;
  invNome: string; invPct: number; invTotal: number; invPago: number;
  invDividaPrio: number; invAmort: number;
  propriaInstalacao: number; propriaAmort: number; solarProprio: boolean;
  custoParceiro: number;
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
  msg_risco: string; msg_churn: string; msg_boasvindas_rede: string; msg_boasvindas_estacao: string;
  cupom_parkway: string; cupom_cidadeauto: string; cupom_costa: string; cupom_vip: string;
}
interface CupomRegistro { usuario: string; motivo: string; validade: string; estacao: string; }
interface EstacaoCustom { key: string; nome: string; tipo: "propria" | "parceria" | "contratual"; ativa: boolean; }

// ─── BASE MESTRE ─────────────────────────────────────────────────────────────
interface BaseMestreUsuario {
  nome: string; email: string; telefone: string; temTel: boolean; importadoEm: string;
}
// ─── OVERRIDES DE CLASSIFICAÇÃO ──────────────────────────────────────────────
interface UserOverride {
  isMotorista?: boolean; isEmbaixador?: boolean; ignorarCRM?: boolean;
  segmento?: "motorista"|"heavy"|"shopper"|"embaixador"|"parceiro";
  atualizadoEm: string; fonte: "whatsapp"|"manual"|"csv";
}

interface AppState {
  metas: Record<string, number>;
  dreConfigs: Record<string, DREConfig>;
  contatos: Contatos;
  mensagens: Mensagens;
  disparos: { ts: string; nome: string; msgId: string; status: "ok" | "err"; msg?: string }[];
  zapi: ZAPIConfig;
  cupons: CupomRegistro[];
  estacoesCustom: EstacaoCustom[];
  baseMestre: Record<string, BaseMestreUsuario>;
  userOverrides: Record<string, UserOverride>;
  limiteDisparoDiario: number;
  mercado: {
    concorrentes: {nome:string;rede:string;precoKwh:number;tipo:string;lat?:number;lng?:number;atualizadoEm:string}[];
    estacoesOCM: {nome:string;lat:number;lng:number;rede:string;tipo:string}[];
    ocmAtualizadoEm: string;
  };
}
type Tab = "dash" | "dre" | "acoes" | "config" | "relatorio" | "goals";

// ─── ESTAÇÕES ────────────────────────────────────────────────────────────────
const ESTACAO_MAP: Record<string, string> = {
  "costa atacadao aguas claras": "costa", "hertzgo - costa atacadao": "costa",
  "hertz go 2": "costa", "costa atacadao": "costa",
  "park way": "parkway",
  "cidade do automovel": "cidadeauto",
  "lava jato do mamute": "mamute",
  "madeiro e geronimo sia brasilia": "madeiro_sia",
  "madeiro & jeronimo sia": "madeiro_sia",
  "madeiro & jeronimo": "madeiro_sp",
  "madeiro e geronimo": "madeiro_sp",
};
const ESTACAO_NOME: Record<string, string> = {
  costa: "Costa Atacadão", parkway: "Park Way",
  cidadeauto: "Cidade do Automóvel", mamute: "Lava Jato do Mamute",
  madeiro_sia: "Madeiro & Jerônimo SIA", madeiro_sp: "Madeiro & Jerônimo SP",
};
const ESTACAO_TIPO: Record<string, "propria" | "parceria" | "contratual"> = {
  costa: "parceria", parkway: "propria", cidadeauto: "propria",
  mamute: "contratual", madeiro_sia: "contratual", madeiro_sp: "contratual",
};
const ESTACAO_CRM_ATIVA = ["costa", "parkway", "cidadeauto", "mamute", "madeiro_sia"];
const ESTACAO_PROPRIA = ["parkway", "cidadeauto"];
const ESTACAO_PARCERIA = ["costa"];

function norm(s: string) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function hubKey(nome: string): string {
  const n = norm(nome);
  for (const [k, v] of Object.entries(ESTACAO_MAP)) { if (n.includes(k)) return v; }
  return n.replace(/\s+/g, "_");
}
function hubNome(key: string, custom?: EstacaoCustom[]): string {
  if (custom) { const c = custom.find(e => e.key === key); if (c) return c.nome; }
  return ESTACAO_NOME[key] || key;
}
function hubTipo(key: string, custom?: EstacaoCustom[]): "propria" | "parceria" | "contratual" {
  if (custom) { const c = custom.find(e => e.key === key); if (c) return c.tipo; }
  return ESTACAO_TIPO[key] || "contratual";
}
function isCrmAtiva(key: string, custom?: EstacaoCustom[]): boolean {
  if (custom) { const c = custom.find(e => e.key === key); if (c) return c.ativa; }
  return ESTACAO_CRM_ATIVA.includes(key);
}

// ─── MENSAGENS PADRÃO ────────────────────────────────────────────────────────
const MSG_DEFAULT: Mensagens = {
  msg1: "Olá [nome]! Sou o Wagner, da HertzGo ⚡\n\nVi que você carregou no [local] — obrigado!\n\nVocê é motorista de app? Responde 1 pra SIM ou 2 pra NÃO 🚗",
  msg2a_parkway: "Perfeito [nome]! 🎉\n\nCondição especial para motoristas no Park Way: DC 80kW, sem fila, com prioridade.\n\nCupom: [cupom]\n\nQuer o endereço?",
  msg2a_cidadeauto: "Perfeito [nome]! 🎉\n\nCondição especial na Cidade do Automóvel: DC 40kW rápido e sem fila.\n\nCupom: [cupom]\n\nQuer o endereço?",
  msg2a_vip_parkway: "Ei [nome], você é VIP no Park Way! 🏆\n\nComo reconhecimento: [beneficio]\n\nCupom exclusivo: [cupom]",
  msg2a_vip_cidadeauto: "Ei [nome], você é VIP na Cidade do Automóvel! 🏆\n\nComo reconhecimento: [beneficio]\n\nCupom: [cupom]",
  msg2b_costa: "[nome], obrigado por ser cliente do Costa Atacadão! 😊\n\nPresente: apresente o código [cupom] no caixa do supermercado e ganhe desconto especial. ⚡",
  msg2b_parkway: "[nome], você já é cliente frequente no Park Way! 🙏\n\nCupom fidelidade: [cupom]",
  msg2b_cidadeauto: "[nome], obrigado por carregar na Cidade do Automóvel! ⚡\n\nCupom fidelidade: [cupom]",
  msg_risco: "[nome], sumiu! Tudo bem com o carro? 😄\n\nFaz dias que não te vejo no [local]. Estamos aqui!\n\nQualquer problema no app, me fala.",
  msg_churn: "[nome], saudades! 😊\n\nTemos novidades no [local] que acho que você vai gostar. Quer saber?",
  msg_boasvindas_rede: "Bem-vindo à [local], da HertzGo em parceria com a iVCharge! ⚡\n\nFicamos felizes em ter você conosco. Qualquer dúvida, estou à disposição!\n\n— Wagner, HertzGo",
  msg_boasvindas_estacao: "Que ótimo ter você no [local], [nome]! ⚡\n\nJá te conhecemos da nossa rede. Seja bem-vindo a mais um ponto HertzGo!",
  cupom_parkway: "PWVIP10", cupom_cidadeauto: "CAVIP10", cupom_costa: "COSTA10", cupom_vip: "HZVIP",
};

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg: "#080a0f", bg1: "#0d1017", bg2: "#121620", bg3: "#181d28",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.12)",
  green: "#00e5a0", greenDim: "rgba(0,229,160,0.15)",
  amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  teal: "#016070",
  text: "#e8edf5", text2: "#6b7fa3", text3: "#2d3a52",
  mono: "'JetBrains Mono', monospace", sans: "'Space Grotesk', sans-serif",
} as const;

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "hertzgo_vision_v4";
function defaultState(): AppState {
  return {
    metas: {}, dreConfigs: {}, contatos: {}, mensagens: { ...MSG_DEFAULT },
    disparos: [], zapi: { instanceId: "", token: "", clientToken: "" },
    cupons: [], estacoesCustom: [],
    baseMestre: {}, userOverrides: {}, limiteDisparoDiario: 20,
    mercado: {concorrentes:[],estacoesOCM:[],ocmAtualizadoEm:""},
  };
}
function loadState(): AppState {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return { ...defaultState(), ...JSON.parse(s) }; } catch {}
  return defaultState();
}
function saveState(s: AppState) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

// ─── PARSERS ─────────────────────────────────────────────────────────────────
function parseNum(s: string): number { if (!s) return 0; return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0; }
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m1 = s.match(/(\d{2})[-/](\d{2})[-/](\d{4})/); if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1]);
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
  return null;
}
function parseHour(s: string): number | null { const ms = s?.match(/(\d{1,2}):(\d{2})/g); if (!ms) return null; const last = ms[ms.length-1].match(/(\d{1,2})/); return last ? +last[1] : null; }
function parseDurMin(s: string): number | null {
  if (!s) return null;
  const m1 = s.match(/(\d+)h\s*(\d+)\s*min/i); if (m1) return +m1[1]*60 + +m1[2];
  const m2 = s.match(/^(\d+):(\d{2})$/); if (m2) return +m2[1]*60 + +m2[2];
  return null;
}
function parseLine(line: string): string[] {
  const r: string[] = []; let cur = "", inQ = false;
  for (const c of line) { if (c==='"'){inQ=!inQ;continue;} if (c===","&&!inQ){r.push(cur.trim());cur="";continue;} cur+=c; }
  r.push(cur.trim()); return r;
}
function parseSpott(text: string): Session[] {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.split("\n").map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Arquivo vazio");
  const hdr = parseLine(lines[0]);
  const idx = (re: RegExp) => hdr.findIndex(h => re.test(norm(h)));
  const iData=idx(/^data$/), iLocal=idx(/^local$/), iUser=idx(/usu/), iChrg=idx(/carregador/);
  const iEn=idx(/^energia$/), iVal=idx(/^valor$/), iStart=idx(/inicio/);
  const iEndC=idx(/fim do car/), iEndT=idx(/fim da trans/), iDur=idx(/dura/), iSt=idx(/recarga/);
  const sessions: Session[] = [];
  for (let i=1; i<lines.length; i++) {
    const cols = parseLine(lines[i]);
    const g = (j:number) => j>=0&&cols[j]?cols[j].trim():"";
    const date = parseDate(g(iData)); if (!date) continue;
    const energy=parseNum(g(iEn)), value=parseNum(g(iVal));
    const cancelled=/cancel/i.test(g(iSt))||(energy===0&&value===0);
    let overstayMin: number|null = null;
    const toMOD=(s:string)=>{const ms2=s.match(/(\d{1,2}):(\d{2})/g);if(!ms2)return null;const x=ms2[ms2.length-1].match(/(\d+):(\d+)/);return x?+x[1]*60+ +x[2]:null;};
    const ec=toMOD(g(iEndC)),et=toMOD(g(iEndT));
    if(ec!==null&&et!==null&&et>ec) overstayMin=et-ec;
    const hub=g(iLocal)||"Desconhecida";
    sessions.push({date,hub,hubKey:hubKey(hub),user:g(iUser)||"—",charger:g(iChrg),energy,value,duration:g(iDur),durMin:parseDurMin(g(iDur)),overstayMin,startHour:parseHour(g(iStart)),status:g(iSt),cancelled,source:"spott"});
  }
  if (!sessions.length) throw new Error("Nenhuma sessão encontrada");
  return sessions;
}
async function parseMove(file: File): Promise<{sessions:Session[];contatos:{nome:string;telefone:string}[]}> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf,{type:"array"});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws,{header:1}) as unknown[][];
  const hdr=(rows[0] as unknown[]).map((h:unknown)=>String(h||"").toLowerCase());
  const iNome=hdr.findIndex(h=>/nome/i.test(h)),iTel=hdr.findIndex(h=>/telefone/i.test(h));
  const iEstac=hdr.findIndex(h=>/esta/i.test(h)),iInicFim=hdr.findIndex(h=>/inicio/i.test(h));
  const iEn=hdr.findIndex(h=>/energia|kwh/i.test(h)),iRec=hdr.findIndex(h=>/receita|valor/i.test(h));
  const iCon=hdr.findIndex(h=>/conector.*tipo|tipo.*conector/i.test(h));
  const sessions:Session[]=[];
  const contatosMap:Record<string,string>={};
  for(let i=1;i<rows.length;i++){
    const r=rows[i] as unknown[];
    const nome=String(r[iNome]||"").trim(),tel=String(r[iTel]||"").replace(/\D/g,"");
    const estac=String(r[iEstac]||"").trim(),inicFim=String(r[iInicFim]||"");
    const energy=parseFloat(String(r[iEn]||0))||0,value=parseFloat(String(r[iRec]||0))||0;
    const conType=String(r[iCon]||"").toLowerCase();
    if(!nome||!estac) continue;
    if(tel&&tel.length>=8) contatosMap[nome.toLowerCase()]=tel;
    const datePart=inicFim.split(" - ")[0].trim();
    const dm=datePart.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const date=dm?new Date(+dm[3],+dm[2]-1,+dm[1]):null;
    if(!date) continue;
    const charger=conType.includes("ccs")?"DC 120kW":conType.includes("ac")?"AC 22kW":"Move";
    sessions.push({date,hub:estac,hubKey:hubKey(estac),user:nome,charger,energy,value,duration:"",durMin:null,overstayMin:null,startHour:parseHour(datePart),status:value>0?"Finalizado":"",cancelled:energy===0&&value===0,source:"move"});
  }
  return{sessions,contatos:Object.entries(contatosMap).map(([nome,tel])=>({nome,telefone:tel}))};
}
function parseContatos(text:string):{nome:string;telefone:string;email:string;estacaoKey?:string}[]{
  text=text.replace(/^\uFEFF/,"");
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  if(lines.length<2) return[];
  const hdr=parseLine(lines[0]).map(h=>norm(h));
  const iNome=hdr.findIndex(h=>/^usuarios?$|^nome$/.test(h)||/nom|usu/.test(h));
  const iTel=hdr.findIndex(h=>/telefone|celular|tel|fone/.test(h));
  const iEmail=hdr.findIndex(h=>/e-?mail/.test(h));
  const iEstac=hdr.findIndex(h=>/esta|local|station/.test(h));
  if(iTel<0) return[];
  const result:{nome:string;telefone:string;email:string;estacaoKey?:string}[]=[];
  for(let i=1;i<lines.length;i++){
    const cols=parseLine(lines[i]);
    const g=(j:number)=>j>=0&&cols[j]?cols[j].trim():"";
    const nome=g(iNome),tel=g(iTel).replace(/\D/g,""),email=g(iEmail);
    const estacNome=iEstac>=0?g(iEstac):"";
    if(!nome||tel.length<8) continue;
    result.push({nome,telefone:tel,email,estacaoKey:estacNome?hubKey(estacNome):undefined});
  }
  return result;
}
function detectEstacao(filename:string,rows:{estacaoKey?:string}[]):string{
  const fname=norm(filename);
  for(const[k,v]of Object.entries(ESTACAO_MAP)){if(fname.includes(k))return v;}
  const keys=rows.map(r=>r.estacaoKey).filter(Boolean) as string[];
  if(keys.length>0){const counts:Record<string,number>={};keys.forEach(k=>{counts[k]=(counts[k]||0)+1;});return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];}
  return "desconhecida";
}

// ─── PREÇO PRATICADO ─────────────────────────────────────────────────────────
function calcPrecoPraticado(sessions: Session[], hubK: string): number {
  const pagas = sessions.filter(s => s.hubKey===hubK && !s.cancelled && s.energy>0 && s.value>0);
  if (!pagas.length) return 0;
  const precos = pagas.map(s => s.value/s.energy).sort((a,b)=>a-b);
  const p90idx = Math.floor(precos.length * 0.9);
  return precos[Math.min(p90idx, precos.length-1)];
}

function temCupomDetectado(sessions: Session[], user: string, hubK: string): boolean {
  const uSess = sessions.filter(s=>s.user===user&&s.hubKey===hubK&&!s.cancelled&&s.energy>0&&s.value>0);
  if (!uSess.length) return false;
  const precoMedio = calcPrecoPraticado(sessions, hubK);
  if (!precoMedio) return false;
  const precoUser = uSess.reduce((a,s)=>a+s.value,0)/uSess.reduce((a,s)=>a+s.energy,0);
  return precoUser < precoMedio * 0.90;
}

// ─── VIP SCORE ───────────────────────────────────────────────────────────────
function calcVipScore(user:string,allOk:Session[]):{score:number;status:"ativo"|"regular"|"em_risco"|"churned";freqAtual:number;freqAnterior:number;diasSemRecarga:number}{
  const uSess=allOk.filter(s=>s.user===user);
  if(!uSess.length) return{score:0,status:"churned",freqAtual:0,freqAnterior:0,diasSemRecarga:999};
  const datas=uSess.map(s=>s.date.getTime());
  const maxDt=Math.max(...datas),hoje=Date.now();
  const diasSemRecarga=Math.round((hoje-maxDt)/86400000);
  const semAtualStart=hoje-7*86400000,semAntStart=hoje-14*86400000;
  const freqAtual=uSess.filter(s=>s.date.getTime()>=semAtualStart).length;
  const freqAnterior=uSess.filter(s=>s.date.getTime()>=semAntStart&&s.date.getTime()<semAtualStart).length;
  let score=0;
  if(diasSemRecarga<=7)score+=40;else if(diasSemRecarga<=14)score+=20;
  if(freqAtual>=2)score+=35;else if(freqAtual>=1)score+=20;
  const diasCliente=Math.round((hoje-Math.min(...datas))/86400000);
  if(diasCliente>=30)score+=25;else if(diasCliente>=14)score+=12;
  const status=score>=76?"ativo":score>=51?"regular":score>=26?"em_risco":"churned";
  return{score,status,freqAtual,freqAnterior,diasSemRecarga};
}

// ─── HEALTH SCORE ────────────────────────────────────────────────────────────
interface HealthScore{total:number;status:"saudavel"|"atencao"|"critico";financeiro:number;operacional:number;investidor:number;diagnostico:string;financeiroDet:string;operacionalDet:string;investidorDet:string;}
function dreSimples(anual:number):number{if(anual<=180000)return 6.0;if(anual<=360000)return 11.2;if(anual<=720000)return 13.5;if(anual<=1800000)return 16.0;if(anual<=3600000)return 21.0;return 33.0;}
function calcHealthScore(sessions:Session[],cfg:DREConfig|null,hubK:string):HealthScore{
  const ok=sessions.filter(s=>s.hubKey===hubK&&!s.cancelled&&s.energy>0);
  const cancelled=sessions.filter(s=>s.hubKey===hubK&&s.cancelled);
  const all=sessions.filter(s=>s.hubKey===hubK);
  if(!ok.length) return{total:0,status:"critico",financeiro:0,operacional:0,investidor:0,diagnostico:"Sem dados para esta estação.",financeiroDet:"—",operacionalDet:"—",investidorDet:"—"};
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const totalKwh=ok.reduce((a,s)=>a+s.energy,0);
  const avgSessDay=ok.length/days;
  const cancelRate=all.length>0?cancelled.length/all.length:0;
  let fin=0,finDet="";
  if(cfg){
    const diasNoMes=30,faturMensal=totalRev/days*diasNoMes,faturAnual=faturMensal*12;
    const aliq=cfg.modelo==="propria"?dreSimples(faturAnual):cfg.pctImposto;
    const impostoVal=totalRev*(aliq/100),custoEspaco=totalRev*(cfg.pctEspaco/100),custoApp=totalRev*(cfg.pctApp/100);
    let custoEnergia=0;
    if(!cfg.solarProprio){if(cfg.energiaTipo==="kwh")custoEnergia=totalKwh*cfg.energiaKwh;if(cfg.energiaTipo==="usina")custoEnergia=cfg.usinaFixo;}
    const ll=totalRev-custoEspaco-impostoVal-custoApp-custoEnergia-cfg.fixoInternet-cfg.fixoAluguel;
    const margem=totalRev>0?(ll/totalRev)*100:0;
    if(ll>0)fin+=20;if(margem>=30)fin+=20;else if(margem>=15)fin+=10;
    finDet=`Margem ${margem.toFixed(1)}% · LL ${brl(ll)}`;
  }else{fin=25;finDet="Configure o DRE para análise completa";}
  let op=0;
  if(avgSessDay>=12)op+=15;else if(avgSessDay>=8)op+=8;else op+=2;
  if(cancelRate<=0.08)op+=12;else if(cancelRate<=0.15)op+=6;
  const priceKwh=totalKwh>0?totalRev/totalKwh:0;
  if(priceKwh>=1.30)op+=8;else if(priceKwh>=1.00)op+=4;
  const opDet=`${avgSessDay.toFixed(1)} sess/dia · ${(cancelRate*100).toFixed(1)}% cancel · R$${priceKwh.toFixed(2)}/kWh`;
  let inv=0,invDet="Estação própria";
  if(cfg&&cfg.modelo==="investidor"){
    const diasNoMes=30,faturMensal=totalRev/days*diasNoMes,faturAnual=faturMensal*12;
    const aliq=dreSimples(faturAnual);
    const ll=totalRev-totalRev*(cfg.pctEspaco/100)-totalRev*(aliq/100)-totalRev*(cfg.pctApp/100)-cfg.fixoInternet-cfg.fixoAluguel;
    const repInv=ll*(cfg.invPct/100),retMensalInv=repInv/days*diasNoMes;
    const rentAnual=cfg.invTotal>0?(repInv/cfg.invTotal)*100*(diasNoMes/days)*12:0;
    if(rentAnual>=12)inv+=15;else if(rentAnual>=8)inv+=8;
    const faltaAmort=Math.max(0,cfg.invTotal-cfg.invAmort);
    const mesesPay=retMensalInv>0?faltaAmort/retMensalInv:Infinity;
    if(mesesPay<=30)inv+=10;else if(mesesPay<=48)inv+=5;
    invDet=`${rentAnual.toFixed(1)}% a.a. · Payback ${mesesPay===Infinity?"—":Math.ceil(mesesPay)+"m"}`;
  }else{inv=20;invDet="100% HertzGo";}
  const total=fin+op+inv;
  const status=total>=70?"saudavel":total>=45?"atencao":"critico";
  const diagnosticos={saudavel:`${hubNome(hubK)} está performando bem. Mantenha o ritmo.`,atencao:`${hubNome(hubK)} tem pontos de melhoria. Verifique os indicadores.`,critico:`${hubNome(hubK)} precisa de ação imediata.`};
  return{total,status,financeiro:fin,operacional:op,investidor:inv,diagnostico:diagnosticos[status],financeiroDet:finDet,operacionalDet:opDet,investidorDet:invDet};
}

// ─── PARSER BASE MESTRE ──────────────────────────────────────────────────────
function parseBaseMestre(text: string): Record<string, BaseMestreUsuario> {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const result: Record<string, BaseMestreUsuario> = {};
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('"')) line = line.slice(1);
    if (line.endsWith('"')) line = line.slice(0, -1);
    line = line.replace(/""/g, "\x00");
    const cols = line.split(",\x00").map(c => c.replace(/\x00/g, "").replace(/^"|"$/g, "").trim());
    if (cols.length < 4) continue;
    const nome = cols[0].trim();
    const email = cols[1]?.trim() || "";
    const tel = cols[3]?.replace(/\D/g, "") || "";
    if (!nome) continue;
    result[nome.toLowerCase()] = {
      nome, email, telefone: tel,
      temTel: tel.length >= 10,
      importadoEm: new Date().toISOString(),
    };
  }
  return result;
}

// ─── PRIORIDADE ESTAÇÃO ───────────────────────────────────────────────────────
// Dinâmico: usa estacoesCustom para novas estações próprias automaticamente
function getPrioridadeEstacao(hubK: string, estacoesCustom?: EstacaoCustom[]): number {
  const tipo = hubTipo(hubK, estacoesCustom);
  if (tipo === "propria") return 3;    // máxima — suas estações, seu dados, sua receita
  if (tipo === "parceria") return 2;   // média — parceiro estratégico
  return 1;                            // contratual — menor prioridade CRM
}

// ─── SEGMENTO CRM ─────────────────────────────────────────────────────────────
// Retorna o segmento final considerando overrides + comportamento CSV
function getSegmento(
  user: string,
  sessoes: Session[],
  overrides: Record<string, UserOverride>,
  periodWeeks: number
): { segmento: string; prioridade: number; cor: string; fonte: string } {
  const key = user.toLowerCase();
  const ov = overrides[key];

  // Override explícito tem prioridade absoluta
  if (ov?.isEmbaixador) return { segmento: "Embaixador", prioridade: 0, cor: "#8b5cf6", fonte: ov.fonte };
  if (ov?.ignorarCRM)   return { segmento: "Ignorar",    prioridade: -1, cor: "#374151", fonte: ov.fonte };
  if (ov?.isMotorista === true)  return { segmento: "Motorista",  prioridade: 4, cor: "#ef4444", fonte: ov.fonte };
  if (ov?.isMotorista === false) return { segmento: "Não Motorista", prioridade: 2, cor: "#3b82f6", fonte: ov.fonte };

  // Inferência pelo CSV
  const uSess = sessoes.filter(s => s.user === user && !s.cancelled && s.energy > 0);
  const temGratis = uSess.some(s => s.value === 0);
  const mediaKwh = uSess.reduce((a,s)=>a+s.energy,0) > 0
    ? uSess.reduce((a,s)=>a+s.value,0) / uSess.reduce((a,s)=>a+s.energy,0) : 999;

  if (temGratis || mediaKwh < 1.00) return { segmento: "Parceiro", prioridade: 1, cor: "#3b82f6", fonte: "csv" };

  const recPorSemana = uSess.length / Math.max(1, periodWeeks);
  const totalKwh = uSess.reduce((a,s)=>a+s.energy,0);

  if (recPorSemana > 2.5 || totalKwh > 150) return { segmento: "Motorista", prioridade: 4, cor: "#ef4444", fonte: "csv" };
  if (totalKwh > 80 || uSess.length >= 4)    return { segmento: "Heavy",     prioridade: 3, cor: "#eab308", fonte: "csv" };
  if (uSess.length >= 1)                      return { segmento: "Shopper",   prioridade: 2, cor: "#22c55e", fonte: "csv" };
  return { segmento: "Inativo", prioridade: 0, cor: "#374151", fonte: "csv" };
}

// ─── FILA DO DIA ─────────────────────────────────────────────────────────────
interface FilaItem {
  nome: string; telefone: string; email: string; segmento: string;
  prioridadeSegmento: number; prioridadeEstacao: number; prioridade: number;
  hubKey: string; hubNomeStr: string; hubTipoStr: string;
  kwh: number; valor: number; sessoes: number;
  diasSemRecarga: number; ultimaRecarga: Date | null;
  jaContactado: boolean; diasDesdeContato: number;
  msgId: string; fonteSegmento: string;
  novoNaBase: boolean; // nome apareceu nas transações mas não está na base mestre
}

function gerarFilaDia(
  sessions: Session[],
  appState: AppState,
  limite: number
): { fila: FilaItem[]; semTelefone: FilaItem[]; novosDetectados: string[] } {
  const ok = sessions.filter(s => !s.cancelled && s.energy > 0);
  const datas = ok.map(s => s.date.getTime());
  const periodDays = Math.max(1, Math.round((Math.max(...datas, 0) - Math.min(...datas, 0)) / 86400000) + 1);
  const periodWeeks = periodDays / 7;

  // Montar mapa de usuários únicos das transações
  const userMap: Record<string, { sessoes: Session[] }> = {};
  ok.forEach(s => {
    if (!userMap[s.user]) userMap[s.user] = { sessoes: [] };
    userMap[s.user].sessoes.push(s);
  });

  // Resolver telefone: base mestre > contatos > Move
  const getTelefone = (nome: string): string => {
    const key = nome.toLowerCase();
    if (appState.baseMestre[key]?.temTel) return appState.baseMestre[key].telefone;
    const contatosTodos = Object.values(appState.contatos).flatMap(c => c.dados);
    const match = contatosTodos.find(d => d.nome.toLowerCase().includes(key) || key.includes(d.nome.toLowerCase().trim()));
    return match?.telefone || "";
  };

  const getEmail = (nome: string): string => {
    const key = nome.toLowerCase();
    return appState.baseMestre[key]?.email || "";
  };

  const hoje = Date.now();
  const novosDetectados: string[] = [];
  const fila: FilaItem[] = [];
  const semTelefone: FilaItem[] = [];

  Object.entries(userMap).forEach(([nome, data]) => {
    const ov = appState.userOverrides[nome.toLowerCase()];
    if (ov?.ignorarCRM) return;

    const seg = getSegmento(nome, ok, appState.userOverrides, periodWeeks);
    if (seg.prioridade <= 0) return; // embaixadores e ignorados ficam fora da fila

    // Estação mais frequente
    const hubCount: Record<string, number> = {};
    data.sessoes.forEach(s => { hubCount[s.hubKey] = (hubCount[s.hubKey] || 0) + 1; });
    const hubK = Object.entries(hubCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "";
    const prioEstacao = getPrioridadeEstacao(hubK, appState.estacoesCustom);

    // Prioridade composta: segmento (0-4) × 10 + estação (1-3)
    const prioridade = seg.prioridade * 10 + prioEstacao;

    const ultimaRecargaTs = Math.max(...data.sessoes.map(s => s.date.getTime()));
    const ultimaRecarga = new Date(ultimaRecargaTs);
    const diasSemRecarga = Math.round((hoje - ultimaRecargaTs) / 86400000);

    // Verificar se já foi contatado recentemente
    const contatos30d = appState.disparos.filter(d =>
      d.nome === nome && d.status === "ok" &&
      (hoje - new Date(d.ts).getTime()) < 30 * 86400000
    );
    const jaContactado = contatos30d.length > 0;
    const diasDesdeContato = jaContactado
      ? Math.round((hoje - new Date(contatos30d[0].ts).getTime()) / 86400000) : 999;

    // Determinar msgId correto
    let msgId = "msg1";
    if (ov?.isMotorista === true) msgId = "msg2a";
    else if (ov?.isMotorista === false) msgId = "msg2b";
    else if (seg.segmento === "Motorista") msgId = "msg2a";
    else if (seg.segmento === "Heavy" || seg.segmento === "Shopper") msgId = "msg2b";

    // Detectar novo na base mestre
    const novoNaBase = !appState.baseMestre[nome.toLowerCase()];
    if (novoNaBase) novosDetectados.push(nome);

    const tel = getTelefone(nome);
    const item: FilaItem = {
      nome, telefone: tel, email: getEmail(nome),
      segmento: seg.segmento, prioridadeSegmento: seg.prioridade,
      prioridadeEstacao: prioEstacao, prioridade,
      hubKey: hubK, hubNomeStr: hubNome(hubK, appState.estacoesCustom),
      hubTipoStr: hubTipo(hubK, appState.estacoesCustom),
      kwh: data.sessoes.reduce((a,s)=>a+s.energy,0),
      valor: data.sessoes.reduce((a,s)=>a+s.value,0),
      sessoes: data.sessoes.length,
      diasSemRecarga, ultimaRecarga,
      jaContactado, diasDesdeContato,
      msgId, fonteSegmento: seg.fonte,
      novoNaBase,
    };

    if (tel) fila.push(item);
    else semTelefone.push(item);
  });

  // Ordenar: maior prioridade primeiro, depois mais dias sem recarga
  fila.sort((a, b) => b.prioridade - a.prioridade || b.diasSemRecarga - a.diasSemRecarga);
  semTelefone.sort((a, b) => b.prioridade - a.prioridade);

  // Aplicar limite diário
  const disparadosHoje = appState.disparos.filter(d =>
    d.status === "ok" && (hoje - new Date(d.ts).getTime()) < 86400000
  ).length;
  const slotsRestantes = Math.max(0, limite - disparadosHoje);
  const filaDia = fila.filter(u => !u.jaContactado).slice(0, slotsRestantes);

  return { fila: filaDia, semTelefone, novosDetectados: Array.from(new Set(novosDetectados)) };
}

// ─── CLASSIFICAR USUÁRIOS ────────────────────────────────────────────────────
function classificarUsuarios(sessions:Session[]):UserData[]{
  const datas=sessions.map(s=>s.date.getTime());
  const periodDays=Math.max(1,Math.round((Math.max(...datas)-Math.min(...datas))/86400000)+1);
  const periodWeeks=periodDays/7;
  const userMap:Record<string,UserData>={};
  sessions.forEach(s=>{
    if(!userMap[s.user])userMap[s.user]={user:s.user,sess:0,kwh:0,rev:0,dates:[],hubs:[],hubKeys:[],values:[],isParceiro:false,isMotorista:false,isHeavy:false,perfil:"",perfilCor:"",localFreq:"",localFreqKey:"",temCupom:false,precoMedioKwh:0};
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
    const stCount:Record<string,number>={};u.hubKeys.forEach(h=>{stCount[h]=(stCount[h]||0)+1;});
    const localFreqKey=Object.entries(stCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
    const localFreq=hubNome(localFreqKey)||u.hubs[0]||"—";
    const precoMedioKwh=u.kwh>0&&u.rev>0?u.rev/u.kwh:0;
    let perfil="🟢 Shopper",perfilCor="#22c55e";
    if(isParceiro){perfil="🔵 Parceiro";perfilCor="#3b82f6";}
    else if(isMotorista){perfil="🔴 Motorista";perfilCor="#ef4444";}
    else if(isHeavy){perfil="🟡 Heavy User";perfilCor="#eab308";}
    return{...u,isParceiro,isMotorista,isHeavy,perfil,perfilCor,localFreq,localFreqKey,temCupom:false,precoMedioKwh};
  });
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
const brl=(n:number)=>"R$\u00a0"+n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const brlK=(n:number)=>n>=1000?`R$\u00a0${(n/1000).toFixed(1)}k`:brl(n);
const fmtDate=(d:Date)=>d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
function trunc(s:string,n:number){return s.length>n?s.slice(0,n-1)+"…":s;}
function heatColor(val:number,max:number):string{
  if(val===0)return"rgba(15,17,23,0.9)";const t=val/max;
  if(t<0.33)return`rgba(0,${Math.round(100+t/0.33*80)},${Math.round(100+t/0.33*60)},0.8)`;
  if(t<0.66)return`rgba(${Math.round((t-0.33)/0.33*200)},200,80,0.8)`;
  return`rgba(255,${Math.round(200-(t-0.66)/0.34*160)},${Math.round(80-(t-0.66)/0.34*60)},0.9)`;
}

// ─── ALERTAS ─────────────────────────────────────────────────────────────────
interface Alerta{tipo:"crit"|"warn"|"ok";icon:string;titulo:string;desc:string;}
function calcAlertas(sessions:Session[]):{semaforo:"verde"|"amarelo"|"vermelho";alertas:Alerta[]}{
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const cancelled=sessions.filter(s=>s.cancelled);
  if(!ok.length)return{semaforo:"vermelho",alertas:[]};
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const totalRev=ok.reduce((a,s)=>a+s.value,0),totalKwh=ok.reduce((a,s)=>a+s.energy,0);
  const avgSessDay=ok.length/days,avgRevDay=totalRev/days,avgKwhDay=totalKwh/days;
  const cancelRate=sessions.length>0?cancelled.length/sessions.length:0;
  const withOv=ok.filter(s=>s.overstayMin!==null&&s.overstayMin>0);
  const avgOv=withOv.length>0?withOv.reduce((a,s)=>a+(s.overstayMin||0),0)/withOv.length:0;
  const ticket=ok.length>0?totalRev/ok.length:0;
  const alertas:Alerta[]=[];
  if(avgSessDay>=12)alertas.push({tipo:"ok",icon:"✅",titulo:"Sessões no alvo",desc:`${avgSessDay.toFixed(1)}/dia`});
  else if(avgSessDay>=8)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Sessões abaixo da meta",desc:`${avgSessDay.toFixed(1)}/dia — meta 12`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Volume crítico",desc:`${avgSessDay.toFixed(1)}/dia`});
  if(avgRevDay>=350)alertas.push({tipo:"ok",icon:"✅",titulo:"Receita no alvo",desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia`});
  else if(avgRevDay>=250)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Receita abaixo da meta",desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Receita crítica",desc:`R$\u00a0${avgRevDay.toFixed(0)}/dia`});
  if(cancelRate<=0.08)alertas.push({tipo:"ok",icon:"✅",titulo:"Cancelamentos ok",desc:`${(cancelRate*100).toFixed(1)}%`});
  else if(cancelRate<=0.15)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Cancelamentos elevados",desc:`${(cancelRate*100).toFixed(1)}%`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Cancelamentos críticos",desc:`${(cancelRate*100).toFixed(1)}%`});
  if(avgOv===0||avgOv<=5)alertas.push({tipo:"ok",icon:"✅",titulo:"Overstay ok",desc:avgOv===0?"Sem overstay":`${avgOv.toFixed(1)} min`});
  else if(avgOv<=15)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Overstay elevado",desc:`${avgOv.toFixed(1)} min`});
  else alertas.push({tipo:"crit",icon:"🔴",titulo:"Overstay crítico",desc:`${avgOv.toFixed(1)} min`});
  if(avgKwhDay<100)alertas.push({tipo:"crit",icon:"🔴",titulo:"Energia crítica",desc:`${avgKwhDay.toFixed(0)} kWh/dia`});
  else if(avgKwhDay<180)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Energia baixa",desc:`${avgKwhDay.toFixed(0)} kWh/dia`});
  if(ticket<20)alertas.push({tipo:"warn",icon:"⚠️",titulo:"Ticket baixo",desc:`R$\u00a0${ticket.toFixed(2).replace(".",",")}`});
  const crits=alertas.filter(a=>a.tipo==="crit").length,warns=alertas.filter(a=>a.tipo==="warn").length;
  return{semaforo:crits>0?"vermelho":warns>=1?"amarelo":"verde",alertas};
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function KpiCard({label,value,sub,accent="#00e5a0",small}:{label:string;value:string;sub?:string;accent?:string;small?:boolean}){
  return(
    <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent}}/>
      <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>{label}</div>
      <div style={{fontFamily:T.sans,fontSize:small?18:22,fontWeight:700,color:accent,lineHeight:1,marginBottom:4}}>{value}</div>
      {sub&&<div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{sub}</div>}
    </div>
  );
}
function SectionLabel({children}:{children:React.ReactNode}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.18em",textTransform:"uppercase" as const,margin:"24px 0 12px"}}>
      {children}<div style={{flex:1,height:1,background:T.border}}/>
    </div>
  );
}
function Panel({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){
  return<div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px 16px",...style}}>{children}</div>;
}
const TH:React.CSSProperties={fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase",letterSpacing:"0.1em",padding:"0 10px 10px",textAlign:"left",borderBottom:`1px solid ${T.border}`,fontWeight:500};
const THR:React.CSSProperties={...TH,textAlign:"right"};
const TD:React.CSSProperties={padding:"9px 10px",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:12,verticalAlign:"middle",color:T.text};
const TDR:React.CSSProperties={...TD,textAlign:"right",fontFamily:T.mono};
function CustomTooltip({active,payload,label,suffix=""}:{active?:boolean;payload?:{value:number;color:string}[];label?:string;suffix?:string}){
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:T.bg3,border:`1px solid ${T.border2}`,borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11}}>
      <div style={{color:T.text2,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:p.color||T.green}}>{suffix==="R$"?"R$\u00a0"+p.value.toLocaleString("pt-BR",{minimumFractionDigits:2}):`${p.value.toFixed(1)} ${suffix}`}</div>)}
    </div>
  );
}

// ─── SEMÁFORO ────────────────────────────────────────────────────────────────
function Semaforo({sessions}:{sessions:Session[]}){
  const{semaforo,alertas}=useMemo(()=>calcAlertas(sessions),[sessions]);
  const cores={verde:{bg:"rgba(0,229,160,0.08)",border:"rgba(0,229,160,0.25)",dot:T.green,label:"Operação Normal",sub:"Todos os indicadores dentro das metas"},amarelo:{bg:"rgba(245,158,11,0.08)",border:"rgba(245,158,11,0.25)",dot:T.amber,label:"Atenção",sub:"Alguns indicadores fora da meta"},vermelho:{bg:"rgba(239,68,68,0.08)",border:"rgba(239,68,68,0.25)",dot:T.red,label:"Alertas Críticos",sub:"Indicadores críticos detectados"}};
  const c=cores[semaforo];
  const emoji=semaforo==="verde"?"🟢":semaforo==="amarelo"?"🟡":"🔴";
  const[expanded,setExpanded]=useState(false);
  return(
    <div style={{marginBottom:16}}>
      <div onClick={()=>setExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:c.bg,border:`1px solid ${c.border}`,borderRadius:14,cursor:"pointer",marginBottom:expanded?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:22,lineHeight:1}}>{emoji}</div>
          <div><div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:c.dot}}>{c.label}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:2}}>{c.sub}</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {["crit","warn","ok"].map(tipo=>{const count=alertas.filter(a=>a.tipo===tipo).length;if(!count)return null;const color=tipo==="crit"?T.red:tipo==="warn"?T.amber:T.green;return<span key={tipo} style={{fontFamily:T.mono,fontSize:10,padding:"2px 7px",borderRadius:20,background:`${color}20`,color,border:`1px solid ${color}40`}}>{tipo==="crit"?"🔴":tipo==="warn"?"⚠️":"✅"} {count}</span>;})}
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>
      {expanded&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{alertas.map((a,i)=>{const color=a.tipo==="crit"?T.red:a.tipo==="warn"?T.amber:T.green;return(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:`${color}08`,border:`1px solid ${color}25`,borderRadius:10}}><span style={{fontSize:14,flexShrink:0,marginTop:1}}>{a.icon}</span><div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color,marginBottom:2}}>{a.titulo}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,lineHeight:1.5}}>{a.desc}</div></div></div>);})}</div>)}
    </div>
  );
}

// ─── PROJEÇÃO MENSAL ─────────────────────────────────────────────────────────
function ProjecaoMensal({sessions,meta,onMetaChange}:{sessions:Session[];meta:number;onMetaChange:(v:number)=>void}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  if(!ok.length)return null;
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const totalRev=ok.reduce((a,s)=>a+s.value,0),totalKwh=ok.reduce((a,s)=>a+s.energy,0),totalSess=ok.length;
  const avgRevDay=totalRev/days,avgKwhDay=totalKwh/days,avgSessDay=totalSess/days;
  const diasNoMes=30;
  const projRev=avgRevDay*diasNoMes,projKwh=avgKwhDay*diasNoMes,projSess=Math.round(avgSessDay*diasNoMes);
  const hoje=new Date();
  const ultimoDia=new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate();
  const diasRestantes=ultimoDia-hoje.getDate(),diasDecorridos=hoje.getDate();
  const metaDia=meta/diasNoMes,pacingEsperado=metaDia*diasDecorridos;
  const pacingDiff=totalRev-pacingEsperado,pacingPct=pacingEsperado>0?(totalRev/pacingEsperado)*100:0;
  const faltaMeta=Math.max(0,meta-totalRev),ritmoNecessario=diasRestantes>0?faltaMeta/diasRestantes:0;
  const ritmoDiff=ritmoNecessario-avgRevDay;
  const pctMeta=meta>0?Math.min(150,(projRev/meta)*100):0;
  const metaColor=pctMeta>=100?T.green:pctMeta>=75?T.amber:T.red;
  const gerarInsight=():string=>{
    if(meta===0)return"Configure uma meta mensal para ativar o pacing inteligente.";
    if(pctMeta>=110)return`🚀 Projeção ${pctMeta.toFixed(0)}% da meta. Vai superar em R$\u00a0${(projRev-meta).toFixed(0)}.`;
    if(pctMeta>=100)return`✅ No alvo — mantenha ${avgSessDay.toFixed(1)} sessões/dia.`;
    if(pctMeta>=75){if(ritmoDiff>0)return`⚠️ Precisa de R$\u00a0${ritmoNecessario.toFixed(0)}/dia nos próximos ${diasRestantes} dias.`;return`⚠️ Projeção em ${pctMeta.toFixed(0)}%. Faltam R$\u00a0${faltaMeta.toFixed(0)} — ${diasRestantes} dias.`;}
    return`🔴 Ritmo crítico — ${pctMeta.toFixed(0)}% da meta.`;
  };
  const[editando,setEditando]=useState(false);
  const[metaInput,setMetaInput]=useState(String(meta));
  return(
    <div style={{marginBottom:20,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>🔮</span><div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>Projeção do Mês</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{days} dias · {diasRestantes}d restantes</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>Meta:</span>
          {editando?(<div style={{display:"flex",gap:6}}><input autoFocus type="number" value={metaInput} onChange={e=>setMetaInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onMetaChange(+metaInput||0);setEditando(false);}if(e.key==="Escape")setEditando(false);}} style={{width:80,background:T.bg3,border:`1px solid ${T.green}`,color:T.text,padding:"4px 8px",borderRadius:6,fontSize:12,fontFamily:T.mono}}/><button onClick={()=>{onMetaChange(+metaInput||0);setEditando(false);}} style={{background:T.greenDim,border:`1px solid rgba(0,229,160,0.3)`,color:T.green,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:T.mono}}>✓</button></div>)
          :(<button onClick={()=>{setMetaInput(String(meta));setEditando(true);}} style={{background:"transparent",border:`1px solid ${T.border}`,color:meta>0?T.amber:T.text3,padding:"4px 12px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{meta>0?brlK(meta):"Definir meta"} ✏️</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border}}>
        {[{label:"Receita Proj.",value:brlK(projRev),sub:`R$\u00a0${avgRevDay.toFixed(0)}/dia`,color:metaColor},{label:"kWh Proj.",value:`${Math.round(projKwh).toLocaleString("pt-BR")}`,sub:`${avgKwhDay.toFixed(0)}/dia`,color:T.amber},{label:"Sessões Proj.",value:`${projSess}`,sub:`${avgSessDay.toFixed(1)}/dia`,color:T.blue},{label:"Pacing",value:meta>0?`${pacingPct.toFixed(0)}%`:"—",sub:meta>0?(pacingDiff>=0?`▲ à frente`:`▼ atrás`):"set. meta",color:meta>0?(pacingPct>=100?T.green:pacingPct>=75?T.amber:T.red):T.text3}].map((k,i)=>(
          <div key={i} style={{background:T.bg2,padding:"12px 14px"}}><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:4}}>{k.label}</div><div style={{fontFamily:T.sans,fontSize:18,fontWeight:700,color:k.color,lineHeight:1,marginBottom:3}}>{k.value}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{k.sub}</div></div>
        ))}
      </div>
      {meta>0&&(<div style={{padding:"10px 16px",borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:5}}><span>vs Meta <span style={{color:metaColor,fontWeight:600}}>{pctMeta.toFixed(0)}%</span></span><span style={{fontSize:9}}>{brlK(projRev)} / {brlK(meta)}</span></div><div style={{height:5,background:T.bg3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pctMeta)}%`,background:metaColor,borderRadius:3}}/></div><div style={{marginTop:8,padding:"8px 12px",background:`${metaColor}08`,border:`1px solid ${metaColor}20`,borderRadius:10,fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:1.6}}>{gerarInsight()}</div></div>)}
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
    try{if(file.name.toLowerCase().match(/\.xlsx?$/)){const{sessions}=await parseMove(file);onFile(sessions);}else{const text=await file.text();onFile(parseSpott(text));}}
    catch(ex:unknown){setErr((ex as Error).message);}
    setLoading(false);
  },[onFile]);
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",minHeight:"100vh"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:16}}>
          <HertzGoLogo size={40}/>
        </div>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,letterSpacing:"0.18em",textTransform:"uppercase",marginTop:8}}>Vision · Painel Operacional</div>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)process(f);}} onClick={()=>inputRef.current?.click()} style={{width:"100%",maxWidth:480,background:drag?"rgba(0,229,160,0.06)":T.bg1,border:`1.5px dashed ${drag?T.green:T.border2}`,borderRadius:20,padding:"40px 28px",textAlign:"center",cursor:"pointer"}}>
        <div style={{fontSize:36,marginBottom:14}}>{loading?"⏳":"📂"}</div>
        <div style={{fontFamily:T.sans,fontSize:17,fontWeight:600,marginBottom:8,color:T.text}}>{loading?"Processando...":"Carregar CSV ou Excel"}</div>
        <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:1.8,marginBottom:20}}>Toque para selecionar · <span style={{color:T.green}}>Spott CSV · Move XLSX</span></div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{padding:"10px 22px",background:T.green,color:T.bg,borderRadius:10,fontFamily:T.sans,fontWeight:700,fontSize:13}}>Spott CSV</div>
          <div style={{padding:"10px 22px",background:"rgba(59,130,246,0.15)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,fontFamily:T.sans,fontWeight:700,fontSize:13}}>Move XLSX</div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])process(e.target.files[0]);}}/>
      {err&&<div style={{marginTop:16,padding:"10px 16px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,color:T.red,fontFamily:T.mono,fontSize:12}}>❌ {err}</div>}
    </div>
  );
}

// ─── BRIEFING DIÁRIO ─────────────────────────────────────────────────────────
function BriefingDiario({sessions,appState,meta,isMobile}:{
  sessions:Session[];appState:AppState;meta:number;isMobile:boolean;
}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const allTs=ok.map(s=>s.date.getTime());
  const maxTs=allTs.length?Math.max(...allTs):Date.now();
  const maxDay=new Date(maxTs);maxDay.setHours(0,0,0,0);
  const mesAtual=maxDay.getMonth();
  const anoAtual=maxDay.getFullYear();
    const hoje=Date.now();
  const mesAnteriorDate=new Date(anoAtual,mesAtual-1,1);

  const ontemOk=ok.filter(s=>{const d=new Date(s.date);d.setHours(0,0,0,0);return d.getTime()===maxDay.getTime();});
  const mesAtualOk=ok.filter(s=>s.date.getMonth()===mesAtual&&s.date.getFullYear()===anoAtual);

  const revOntem=ontemOk.reduce((a,s)=>a+s.value,0);
  const kwhOntem=ontemOk.reduce((a,s)=>a+s.energy,0);
  const sessOntem=ontemOk.length;
  const revMes=mesAtualOk.reduce((a,s)=>a+s.value,0);
  const kwhMes=mesAtualOk.reduce((a,s)=>a+s.energy,0);
  const sessMes=mesAtualOk.length;
  const diasMes=new Set(mesAtualOk.map(s=>s.date.toDateString())).size||1;
  const avgRevDia=revMes/diasMes;
  const projMes=avgRevDia*30;

  const overstayOntem=ontemOk.filter(s=>s.overstayMin&&s.overstayMin>15);
  const cancelOntem=sessions.filter(s=>{const d=new Date(s.date);d.setHours(0,0,0,0);return d.getTime()===maxDay.getTime()&&s.cancelled;});
  const totalOntem=ontemOk.length+cancelOntem.length;
  const cancelRate=totalOntem>0?cancelOntem.length/totalOntem:0;
  const avgCancelRate=sessions.length>0?sessions.filter(s=>s.cancelled).length/sessions.length:0;
  const cancelAlerta=cancelRate>avgCancelRate*1.5&&cancelOntem.length>=3;

  const hubs2=Array.from(new Set(ok.map(s=>s.hubKey)));
  const saudeEstacoes=hubs2.map(h=>{
    const hSess=ok.filter(s=>s.hubKey===h);
    const daysH=new Set(hSess.map(s=>s.date.toDateString())).size||1;
    const avgRevH=hSess.reduce((a,s)=>a+s.value,0)/daysH;
    const hOntem=ontemOk.filter(s=>s.hubKey===h);
    const revOntemH=hOntem.reduce((a,s)=>a+s.value,0);
    const semMovimento=hOntem.length===0;
    const abaixoMedia=hOntem.length>0&&revOntemH<avgRevH*0.6;
    const ovH=hOntem.filter(s=>s.overstayMin&&s.overstayMin>15);
    const avgSess=hSess.length/daysH;
    let status:"ok"|"warn"|"crit"="ok";
    if(semMovimento||abaixoMedia)status="warn";
    if(semMovimento&&avgSess>=5)status="crit";
    return{hub:h,status,semMovimento,abaixoMedia,overstay:ovH.length,sessOntem:hOntem.length,revOntem:revOntemH,avgRevDia:avgRevH};
  });

  const users2=classificarUsuarios(ok);
  const vipScores2:Record<string,ReturnType<typeof calcVipScore>>={};
  users2.filter(u=>u.isMotorista).forEach(u=>{vipScores2[u.user]=calcVipScore(u.user,ok);});
  const motoristasRisco=users2.filter(u=>u.isMotorista&&["em_risco","churned"].includes(vipScores2[u.user]?.status||""));
  const novosHoje=users2.filter(u=>{
    const primeiraRecarga=Math.min(...ok.filter(s=>s.user===u.user).map(s=>s.date.getTime()));
    return(maxTs-primeiraRecarga)<7*86400000;
  });

  const acoes:{icon:string;texto:string;tipo:"crm"|"op"|"info";cor:string}[]=[];
  const baseMestreKeys=Object.keys(appState.baseMestre||{});
  if(baseMestreKeys.length>0){
    const ultimaImport=Object.values(appState.baseMestre)[0]?.importadoEm;
    if(ultimaImport){
      const diasBase=Math.round((hoje-new Date(ultimaImport).getTime())/86400000);
      if(diasBase>30)acoes.push({icon:"📋",texto:`Base Mestre desatualizada (${diasBase} dias) — exportar CSV de usuários da Spott`,tipo:"op",cor:T.amber});
    }
  }else{
    acoes.push({icon:"📋",texto:"Base Mestre vazia — importar CSV de usuários da Spott em Config → Contatos",tipo:"op",cor:T.amber});
  }
  const nomesTransacoes=Array.from(new Set(ok.map(s=>s.user)));
  const semCadastro=nomesTransacoes.filter(n=>!appState.baseMestre[n.toLowerCase()]);
  if(semCadastro.length>0)acoes.push({icon:"👤",texto:`${semCadastro.length} usuários nas transações sem cadastro — atualizar Base Mestre`,tipo:"info",cor:T.text2});
  if(motoristasRisco.length>0)acoes.push({icon:"🔴",texto:`${motoristasRisco.length} motoristas em risco — disparar MSG Risco`,tipo:"crm",cor:T.red});
  if(novosHoje.length>0)acoes.push({icon:"🌱",texto:`${novosHoje.length} novos usuários esta semana — enviar boas-vindas`,tipo:"crm",cor:T.teal});
  overstayOntem.forEach(s=>acoes.push({icon:"⏱️",texto:`Overstay: ${s.user} em ${hubNome(s.hubKey)} (${s.overstayMin}min)`,tipo:"op",cor:T.amber}));
  if(cancelAlerta)acoes.push({icon:"⚠️",texto:`Cancelamentos acima da média ontem: ${(cancelRate*100).toFixed(0)}% (média ${(avgCancelRate*100).toFixed(0)}%)`,tipo:"op",cor:T.amber});
  saudeEstacoes.filter(e=>e.semMovimento).forEach(e=>acoes.push({icon:"🔌",texto:`${hubNome(e.hub)} sem sessões ontem — verificar carregador`,tipo:"op",cor:T.red}));
  saudeEstacoes.filter(e=>e.abaixoMedia&&!e.semMovimento).forEach(e=>acoes.push({icon:"📉",texto:`${hubNome(e.hub)} abaixo da média (${brl(e.revOntem)} vs ${brl(e.avgRevDia)}/dia)`,tipo:"info",cor:T.text2}));

  const[briefingOpen,setBriefingOpen]=useState(true);
  const[acoesResolvidas,setAcoesResolvidas]=useState<number[]>([]);
  const resolverAcao=(i:number)=>setAcoesResolvidas(prev=>[...prev,i]);
  const acoesAtivas=acoes.filter((_,i)=>!acoesResolvidas.includes(i));

  const dataOntem=maxDay.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
  const mesNome=maxDay.toLocaleDateString("pt-BR",{month:"long"});
  const crits=saudeEstacoes.filter(e=>e.status==="crit").length;
  const warns=saudeEstacoes.filter(e=>e.status==="warn").length;
  const briefingCor=crits>0?T.red:warns>0||acoesAtivas.filter(a=>a.tipo==="op").length>0?T.amber:T.green;
  const briefingEmoji=crits>0?"🔴":warns>0?"🟡":"🟢";

  return(
    <div style={{marginBottom:16,background:`${briefingCor}06`,border:`1px solid ${briefingCor}30`,borderRadius:16,overflow:"hidden"}}>
      <div onClick={()=>setBriefingOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{briefingEmoji}</span>
          <div>
            <div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:briefingCor}}>Briefing do Dia — {dataOntem}</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{acoesAtivas.length} ações · {saudeEstacoes.filter(e=>e.status==="ok").length}/{saudeEstacoes.length} estações ok · {mesNome}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {acoesAtivas.filter(a=>a.tipo==="op").length>0&&<span style={{fontFamily:T.mono,fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(245,158,11,0.2)",color:T.amber,border:"1px solid rgba(245,158,11,0.3)"}}>⚠️ {acoesAtivas.filter(a=>a.tipo==="op").length}</span>}
          {acoesAtivas.filter(a=>a.tipo==="crm").length>0&&<span style={{fontFamily:T.mono,fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(239,68,68,0.2)",color:T.red,border:"1px solid rgba(239,68,68,0.3)"}}>📤 {acoesAtivas.filter(a=>a.tipo==="crm").length}</span>}
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{briefingOpen?"▲":"▼"}</span>
        </div>
      </div>
      {briefingOpen&&(
        <div style={{borderTop:`1px solid ${briefingCor}20`}}>
          {/* SAÚDE */}
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:8}}>Saúde das Estações</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {saudeEstacoes.map(e=>{
                const cor=e.status==="crit"?T.red:e.status==="warn"?T.amber:T.green;
                const emoji=e.status==="crit"?"🔴":e.status==="warn"?"🟡":"🟢";
                return(
                  <div key={e.hub} style={{background:`${cor}08`,border:`1px solid ${cor}30`,borderRadius:10,padding:"8px 12px",minWidth:120}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                      <span style={{fontSize:12}}>{emoji}</span>
                      <span style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:cor}}>{trunc(hubNome(e.hub),12)}</span>
                    </div>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.text2}}>{e.semMovimento?"sem sessões":e.sessOntem+" sess · "+brl(e.revOntem)}</div>
                    {e.overstay>0&&<div style={{fontFamily:T.mono,fontSize:9,color:T.amber,marginTop:2}}>⏱️ {e.overstay} overstay</div>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* KPIS */}
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:8}}>KPIs — Ontem vs {mesNome}</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
              {[
                {label:"Receita",ontem:brl(revOntem),mes:brl(revMes),sub:`proj. ${brl(projMes)}`,cor:T.green},
                {label:"Energia",ontem:`${kwhOntem.toFixed(0)} kWh`,mes:`${kwhMes.toFixed(0)} kWh`,sub:`${(kwhMes/diasMes).toFixed(0)}/dia`,cor:T.amber},
                {label:"Sessões",ontem:`${sessOntem}`,mes:`${sessMes}`,sub:`${(sessMes/diasMes).toFixed(1)}/dia`,cor:T.blue},
                {label:"Ticket",ontem:sessOntem>0?brl(revOntem/sessOntem):"—",mes:sessMes>0?brl(revMes/sessMes):"—",sub:`R$${kwhMes>0?(revMes/kwhMes).toFixed(2):"-"}/kWh`,cor:T.purple},
              ].map((k,i)=>(
                <div key={i} style={{background:T.bg2,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>{k.label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                    <div><div style={{fontFamily:T.mono,fontSize:8,color:T.text2,marginBottom:2}}>Ontem</div><div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:k.cor}}>{k.ontem}</div></div>
                    <div><div style={{fontFamily:T.mono,fontSize:8,color:T.text2,marginBottom:2}}>{mesNome.slice(0,3)}</div><div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:T.text2}}>{k.mes}</div></div>
                  </div>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginTop:4}}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
          {/* FATURAMENTO POR ESTAÇÃO */}
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:8}}>Faturamento por Estação</div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?480:undefined}}>
                <thead><tr><th style={TH}>Estação</th><th style={THR}>Ontem</th><th style={THR}>{mesNome.slice(0,3)}</th><th style={THR}>Proj.</th><th style={THR}>R$/kWh</th><th style={TH}>Status</th></tr></thead>
                <tbody>
                  {saudeEstacoes.sort((a,b)=>{
                    const rA=mesAtualOk.filter(s=>s.hubKey===a.hub).reduce((x,s)=>x+s.value,0);
                    const rB=mesAtualOk.filter(s=>s.hubKey===b.hub).reduce((x,s)=>x+s.value,0);
                    return rB-rA;
                  }).map(e=>{
                    const hMes=mesAtualOk.filter(s=>s.hubKey===e.hub);
                    const revHMes=hMes.reduce((a,s)=>a+s.value,0);
                    const kwhHMes=hMes.reduce((a,s)=>a+s.energy,0);
                    const diasHMes=new Set(hMes.map(s=>s.date.toDateString())).size||1;
                    const projH=revHMes/diasHMes*30;
                    const precoH=kwhHMes>0?revHMes/kwhHMes:0;
                    const cor=e.status==="crit"?T.red:e.status==="warn"?T.amber:T.green;
                    return(
                      <tr key={e.hub} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                        <td style={TD}><span style={{fontWeight:600,fontSize:12}}>{hubNome(e.hub)}</span></td>
                        <td style={{...TDR,color:e.revOntem>0?T.green:T.text3}}>{e.revOntem>0?brl(e.revOntem):"—"}</td>
                        <td style={{...TDR,color:T.text}}>{brl(revHMes)}</td>
                        <td style={{...TDR,color:T.amber}}>{brl(projH)}</td>
                        <td style={{...TDR,color:T.text2,fontSize:11}}>R${precoH.toFixed(2)}</td>
                        <td style={TD}><span style={{fontFamily:T.mono,fontSize:9,padding:"2px 6px",borderRadius:4,background:`${cor}15`,color:cor}}>{e.status==="crit"?"🔴 crítico":e.status==="warn"?"🟡 atenção":"🟢 ok"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* USUÁRIOS */}
          {(motoristasRisco.length>0||novosHoje.length>0)&&(
            <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:8}}>Usuários em Atenção</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
                {motoristasRisco.length>0&&(
                  <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.red,marginBottom:6}}>🔴 Motoristas em Risco ({motoristasRisco.length})</div>
                    {motoristasRisco.slice(0,3).map(u=>(<div key={u.user} style={{fontFamily:T.mono,fontSize:10,color:T.text2,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>{trunc(u.user,20)} · {vipScores2[u.user]?.diasSemRecarga}d</div>))}
                    {motoristasRisco.length>3&&<div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginTop:4}}>+{motoristasRisco.length-3} outros</div>}
                  </div>
                )}
                {novosHoje.length>0&&(
                  <div style={{background:"rgba(1,96,112,0.06)",border:"1px solid rgba(1,96,112,0.2)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.teal,marginBottom:6}}>🌱 Novos esta semana ({novosHoje.length})</div>
                    {novosHoje.slice(0,3).map(u=>(<div key={u.user} style={{fontFamily:T.mono,fontSize:10,color:T.text2,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>{trunc(u.user,20)} · {hubNome(u.localFreqKey)}</div>))}
                    {novosHoje.length>3&&<div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginTop:4}}>+{novosHoje.length-3} outros</div>}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* AÇÕES */}
          {acoesAtivas.length>0?(
            <div style={{padding:"12px 16px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:8}}>Ações de Hoje</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {acoesAtivas.map((a,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:T.bg2,borderRadius:8,border:`1px solid ${a.cor}20`,gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                      <span style={{fontSize:14,flexShrink:0}}>{a.icon}</span>
                      <span style={{fontFamily:T.mono,fontSize:11,color:a.tipo==="op"?T.amber:a.tipo==="crm"?T.red:T.text2,lineHeight:1.4}}>{a.texto}</span>
                    </div>
                    <button onClick={()=>resolverAcao(acoes.indexOf(a))} style={{padding:"4px 10px",borderRadius:6,fontFamily:T.mono,fontSize:10,cursor:"pointer",background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,color:T.text3,flexShrink:0,whiteSpace:"nowrap" as const}}>✓ Ok</button>
                  </div>
                ))}
              </div>
            </div>
          ):(
            <div style={{padding:"14px 16px",textAlign:"center" as const,fontFamily:T.mono,fontSize:11,color:T.green}}>✅ Nenhuma ação pendente — operação normalizada</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PARCEIROS CARD ──────────────────────────────────────────────────────────
function ParceirosCard({ok,isMobile}:{ok:Session[];isMobile:boolean}){
  const allParceiros=classificarUsuarios(ok).filter(u=>u.isParceiro);
  const[parcOpen,setParcOpen]=useState(false);
  if(allParceiros.length===0)return null;
  const volTotal=allParceiros.reduce((a,u)=>{
    return a+ok.filter(s=>s.user===u.user).reduce((b,s)=>b+s.energy,0);
  },0);
  return(
    <div style={{marginBottom:24,background:T.bg2,border:"1px solid rgba(59,130,246,0.25)",borderRadius:14,overflow:"hidden"}}>
      <div onClick={()=>setParcOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🔵</span>
          <div>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:"#60a5fa"}}>Parceiros & Embaixadores</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{allParceiros.length} parceiros · {volTotal.toFixed(0)} kWh total</div>
          </div>
        </div>
        <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{parcOpen?"▲":"▼"}</span>
      </div>
      {parcOpen&&(
        <div style={{borderTop:"1px solid rgba(59,130,246,0.15)",overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?360:undefined}}>
            <thead><tr style={{background:T.bg3}}>
              <th style={TH}>Parceiro</th><th style={TH}>Estação</th><th style={THR}>kWh</th><th style={THR}>Sessões</th>
            </tr></thead>
            <tbody>
              {allParceiros.map(u=>{
                const uSess=ok.filter(s=>s.user===u.user);
                const kwhU=uSess.reduce((a,s)=>a+s.energy,0);
                return(
                  <tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                    <td style={TD}><span style={{fontSize:12,fontWeight:500}}>{trunc(u.user,isMobile?14:22)}</span></td>
                    <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{trunc(hubNome(u.localFreqKey),12)}</span></td>
                    <td style={{...TDR,color:T.amber,fontSize:11}}>{kwhU.toFixed(0)}</td>
                    <td style={{...TDR,color:T.text2,fontSize:11}}>{uSess.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TAB DASHBOARD ───────────────────────────────────────────────────────────
function TabDashboard({sessions,meta,onMetaChange,appState}:{sessions:Session[];meta:number;onMetaChange:(v:number)=>void;appState:AppState}){
  const isMobile=useIsMobile();
  const[activeHub,setActiveHub]=useState("__all__");
  const hubs=useMemo(()=>Array.from(new Set(sessions.map(s=>s.hubKey))).sort(),[sessions]);
  const filtered=useMemo(()=>activeHub==="__all__"?sessions:sessions.filter(s=>s.hubKey===activeHub),[sessions,activeHub]);
  const ok=filtered.filter(s=>!s.cancelled&&s.energy>0);
  const totalRev=ok.reduce((a,s)=>a+s.value,0),totalKwh=ok.reduce((a,s)=>a+s.energy,0),totalSess=ok.length;
  const days=new Set(ok.map(s=>s.date.toDateString())).size||1;
  const ticket=totalSess>0?totalRev/totalSess:0,priceKwh=totalKwh>0?totalRev/totalKwh:0;
  const dts=ok.map(s=>s.date.getTime());
  const minDate=dts.length?new Date(Math.min(...dts)):new Date();
  const maxDate=dts.length?new Date(Math.max(...dts)):new Date();
  const byDay:Record<string,{date:Date;rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{const k=s.date.toDateString();if(!byDay[k])byDay[k]={date:s.date,rev:0,kwh:0,sess:0};byDay[k].rev+=s.value;byDay[k].kwh+=s.energy;byDay[k].sess++;});
  const dayData=Object.values(byDay).sort((a,b)=>a.date.getTime()-b.date.getTime()).map(d=>({date:fmtDate(d.date),rev:+d.rev.toFixed(2),kwh:+d.kwh.toFixed(0),sess:d.sess}));
  // Dados por hub por dia para gráfico empilhado
  const hubKeys2=Array.from(new Set(ok.map(s=>s.hubKey))).sort();
  const HUB_COLORS=["#00e5a0","#00bcd4","#ffab00","#7c4dff","#ff5252","#448aff"];
  const byDayHub:Record<string,Record<string,number>>={};
  ok.forEach(s=>{const k=s.date.toDateString();if(!byDayHub[k])byDayHub[k]={};byDayHub[k][s.hubKey]=(byDayHub[k][s.hubKey]||0)+s.value;});
  const dayDataHub=Object.entries(byDayHub).sort((a,b)=>new Date(a[0]).getTime()-new Date(b[0]).getTime()).map(([dateStr,hubs])=>{
    const d={date:fmtDate(new Date(dateStr))};
    hubKeys2.forEach(h=>{Object.assign(d,{[h]:+(hubs[h]||0).toFixed(0)});});
    return d;
  });
  const avgRev=totalRev/days;
  const hubMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!hubMap[s.hubKey])hubMap[s.hubKey]={rev:0,kwh:0,sess:0};hubMap[s.hubKey].rev+=s.value;hubMap[s.hubKey].kwh+=s.energy;hubMap[s.hubKey].sess++;});
  const hubData=Object.entries(hubMap).sort((a,b)=>b[1].rev-a[1].rev).map(([key,d])=>({name:trunc(hubNome(key),isMobile?10:20),rev:+d.rev.toFixed(0),sess:d.sess,kwh:+d.kwh.toFixed(0)}));
  const userMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!userMap[s.user])userMap[s.user]={rev:0,kwh:0,sess:0};userMap[s.user].rev+=s.value;userMap[s.user].kwh+=s.energy;userMap[s.user].sess++;});
  // Top 5 com estação principal
  const userHubMap:Record<string,Record<string,number>>={};
  ok.forEach(s=>{
    if(!userHubMap[s.user])userHubMap[s.user]={};
    userHubMap[s.user][s.hubKey]=(userHubMap[s.user][s.hubKey]||0)+s.value;
  });
  const top5=Object.entries(userMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5).map(([name,d])=>{
    const hubs=userHubMap[name]||{};
    const mainHub=Object.entries(hubs).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
    return[name,{...d,mainHub}] as [string,{rev:number;kwh:number;sess:number;mainHub:string}];
  });
  const hourData=Array(24).fill(0).map(()=>({sess:0,kwh:0}));
  ok.forEach(s=>{if(s.startHour!==null){hourData[s.startHour].sess++;hourData[s.startHour].kwh+=s.energy;}});
  const maxHour=Math.max(...hourData.map(h=>h.sess),1);
  const hasMove=sessions.some(s=>s.source==="move"),hasSpott=sessions.some(s=>s.source==="spott");
  const[chartMode,setChartMode]=useState<"rev"|"kwh"|"sess">("rev");
  const pad=isMobile?"16px 14px":"24px 28px";
  return(
    <div style={{padding:pad}}>
      {/* Filtro hubs — scroll horizontal no mobile */}
      {hubs.length>1&&(
        <div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
          {["__all__",...hubs].map(h=>(<button key={h} onClick={()=>setActiveHub(h)} style={{padding:"5px 12px",borderRadius:20,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeHub===h?T.green:T.border2}`,background:activeHub===h?T.greenDim:"transparent",color:activeHub===h?T.green:T.text2,whiteSpace:"nowrap",flexShrink:0}}>{h==="__all__"?`🌐 Todas`:`📍 ${hubNome(h)}`}</button>))}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:14,flexWrap:"wrap"}}>
        <span>📅 {fmtDate(minDate)} → {fmtDate(maxDate)} · {days}d</span>
        {hasSpott&&<span style={{background:"rgba(0,229,160,0.1)",color:T.green,padding:"2px 7px",borderRadius:4,fontSize:9,border:"1px solid rgba(0,229,160,0.2)"}}>Spott</span>}
        {hasMove&&<span style={{background:"rgba(59,130,246,0.1)",color:"#60a5fa",padding:"2px 7px",borderRadius:4,fontSize:9,border:"1px solid rgba(59,130,246,0.2)"}}>Move</span>}
      </div>
      {/* ── BRIEFING DIÁRIO ─────────────────────────────────────────── */}
      <BriefingDiario sessions={sessions} appState={appState} meta={meta} isMobile={isMobile} />

            {/* TERMÔMETRO NEON — Receita Hoje vs Mês */}
      {(()=>{
        const allOkDash=ok;
        const dts2=allOkDash.map(s=>s.date.getTime());
        const maxTs2=dts2.length?Math.max(...dts2):Date.now();
        const maxDay2=new Date(maxTs2);maxDay2.setHours(0,0,0,0);
        const ontemDash=allOkDash.filter(s=>{const d=new Date(s.date);d.setHours(0,0,0,0);return d.getTime()===maxDay2.getTime();});
        const mesDash=allOkDash.filter(s=>s.date.getMonth()===maxDay2.getMonth()&&s.date.getFullYear()===maxDay2.getFullYear());
        const revHoje=ontemDash.reduce((a,s)=>a+s.value,0);
        const revMesDash=mesDash.reduce((a,s)=>a+s.value,0);
        const diasMesDash=new Set(mesDash.map(s=>s.date.toDateString())).size||1;
        const metaDiaria=meta>0?meta/30:revHoje>0?revHoje*1.2:100;
        const metaMes=meta>0?meta:revMesDash>0?revMesDash*1.2:1000;
        const pctHoje=Math.min(100,(revHoje/metaDiaria)*100);
        const pctMes=Math.min(100,(revMesDash/metaMes)*100);
        const getCor=(pct:number)=>pct>=100?"#00e5a0":pct>=75?"#ffab00":"#ff5252";
        const getGlow=(pct:number)=>pct>=100?"0 0 12px rgba(0,229,160,0.6)":pct>=75?"0 0 12px rgba(255,171,0,0.5)":"0 0 12px rgba(255,82,82,0.5)";
        return(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:24}}>
            {[
              {label:"Receita Ontem",valor:revHoje,meta:metaDiaria,pct:pctHoje,sub:`Meta: ${brl(metaDiaria)}`},
              {label:"Receita do Mês",valor:revMesDash,meta:metaMes,pct:pctMes,sub:`Meta: ${brl(metaMes)} · ${diasMesDash}d`},
            ].map((t,i)=>{
              const cor=getCor(t.pct);
              const glow=getGlow(t.pct);
              return(
                <div key={i} style={{background:T.bg2,border:`1px solid ${cor}40`,borderRadius:16,padding:"16px 20px",position:"relative",overflow:"hidden"}}>
                  {/* Glow de fundo */}
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${cor},transparent)`,boxShadow:glow}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:4}}>{t.label}</div>
                      <div style={{fontFamily:T.sans,fontSize:24,fontWeight:800,color:cor,lineHeight:1,textShadow:glow}}>{brl(t.valor)}</div>
                      <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:4}}>{t.sub}</div>
                    </div>
                    <div style={{textAlign:"right" as const}}>
                      <div style={{fontFamily:T.mono,fontSize:22,fontWeight:800,color:cor,textShadow:glow}}>{t.pct.toFixed(0)}%</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.text2}}>{t.pct>=100?"✅ meta":t.pct>=75?"🟡 perto":"🔴 atrás"}</div>
                    </div>
                  </div>
                  {/* Barra termômetro */}
                  <div style={{height:8,background:T.bg3,borderRadius:4,overflow:"hidden",border:`1px solid ${T.border}`}}>
                    <div style={{
                      height:"100%",
                      width:`${t.pct}%`,
                      background:`linear-gradient(90deg,${cor}99,${cor})`,
                      borderRadius:4,
                      boxShadow:glow,
                      transition:"width 1s ease"
                    }}/>
                  </div>
                  {t.pct>=100&&(
                    <div style={{position:"absolute",top:8,right:12,fontFamily:T.mono,fontSize:10,color:cor,textShadow:glow}}>🎯 META!</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* PARCEIROS — card colapsável */}
      <ParceirosCard ok={ok} isMobile={isMobile}/>

            <SectionLabel>Receita Diária por Estação</SectionLabel>
      <Panel style={{marginBottom:24}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12}}>
          {hubKeys2.map((h,i)=>(
            <div key={h} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:10,height:10,borderRadius:2,background:HUB_COLORS[i%HUB_COLORS.length]}}/>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{trunc(hubNome(h),14)}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dayDataHub} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/>
            <XAxis dataKey="date" tick={{fill:T.text2,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
            <YAxis tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fill:T.text2,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={44}/>
            <Tooltip contentStyle={{background:T.bg3,border:`1px solid ${T.border2}`,borderRadius:10,fontFamily:T.mono,fontSize:11}} formatter={(v:number,name:string)=>[brl(v),hubNome(name)]}/>
            {hubKeys2.map((h,i)=>(
              <Bar key={h} dataKey={h} stackId="a" fill={HUB_COLORS[i%HUB_COLORS.length]} radius={i===hubKeys2.length-1?[4,4,0,0]:[0,0,0,0]}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <SectionLabel>Heatmap por Hora</SectionLabel>
      <Panel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:2}}>{hourData.map((h,hr)=>(<div key={hr} title={`${hr}h: ${h.sess}`} style={{height:isMobile?28:36,borderRadius:4,background:heatColor(h.sess,maxHour),display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"rgba(255,255,255,0.8)",cursor:"default"}}>{h.sess>0&&!isMobile?h.sess:""}</div>))}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:2,marginTop:3}}>{Array.from({length:24},(_,hr)=>(<div key={hr} style={{fontSize:7,color:T.text3,textAlign:"center",fontFamily:T.mono}}>{hr%6===0?`${hr}h`:""}</div>))}</div>
      </Panel>
    </div>
  );
}

// ─── NOVOS COLAPSÁVEL ────────────────────────────────────────────────────────
function NovosColapsavel({novosNaRede,novosNaEstacao,getTel}:{novosNaRede:UserData[];novosNaEstacao:UserData[];getTel:(n:string)=>string|null}){
  const isMobile=useIsMobile();
  const[openRede,setOpenRede]=useState(false);
  const[openEstacao,setOpenEstacao]=useState(false);
  const grupos=[
    {label:"🌱 Novos na Rede",sub:"1ª vez em qualquer estação HertzGo",color:T.teal,lista:novosNaRede,tipo:"rede",open:openRede,setOpen:setOpenRede},
    {label:"📍 Novos na Estação",sub:"Já eram clientes, chegaram num novo ponto",color:T.blue,lista:novosNaEstacao,tipo:"estacao",open:openEstacao,setOpen:setOpenEstacao},
  ];
  return(
    <div>
      {grupos.map(grupo=>(
        <div key={grupo.tipo} style={{marginBottom:10,background:T.bg2,border:`1px solid ${grupo.open?grupo.color+"40":T.border}`,borderRadius:14,overflow:"hidden"}}>
          <div onClick={()=>grupo.setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer"}}>
            <div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{grupo.label}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{grupo.sub}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:T.mono,fontSize:11,padding:"2px 9px",borderRadius:20,background:`${grupo.color}20`,color:grupo.color,border:`1px solid ${grupo.color}40`}}>{grupo.lista.length}</span>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{grupo.open?"▲":"▼"}</span>
            </div>
          </div>
          {grupo.open&&(
            <div style={{borderTop:`1px solid ${T.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?400:undefined}}>
                <thead><tr><th style={TH}>Usuário</th><th style={TH}>Estação</th><th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Tel</th></tr></thead>
                <tbody>
                  {grupo.lista.length===0&&<tr><td colSpan={5} style={{...TD,textAlign:"center",color:T.text3,padding:"16px"}}>Nenhum usuário no período</td></tr>}
                  {grupo.lista.map(u=>{
                    const tel=getTel(u.user);
                    const isPropria=ESTACAO_PROPRIA.includes(u.localFreqKey);
                    return(<tr key={u.user}><td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,isMobile?14:20)}</span></td>
                      <td style={TD}><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:isPropria?"rgba(1,96,112,0.2)":"rgba(255,255,255,0.05)",color:isPropria?T.teal:T.text3,fontFamily:T.mono}}>{trunc(hubNome(u.localFreqKey),isMobile?10:16)}</span></td>
                      <td style={{...TDR,color:T.text2}}>{u.kwh.toFixed(1)}</td>
                      <td style={{...TDR,color:T.green,fontWeight:600}}>{brl(u.rev)}</td>
                      <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel?"📞":"—"}</td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── VIP CATEGORIAS COLAPSÁVEL ───────────────────────────────────────────────
function VipCategorias({motoristasOrdenados,vipScores,getTel}:{motoristasOrdenados:UserData[];vipScores:Record<string,ReturnType<typeof calcVipScore>>;getTel:(n:string)=>string|null}){
  const isMobile=useIsMobile();
  const[openRisco,setOpenRisco]=useState(false);
  const[openChurn,setOpenChurn]=useState(false);
  const[openRegular,setOpenRegular]=useState(false);
  const[openAtivo,setOpenAtivo]=useState(false);
  const cats=[
    {label:"🟠 Em Risco",status:"em_risco",color:"#fb923c",open:openRisco,setOpen:setOpenRisco},
    {label:"🔴 Churn",status:"churned",color:T.red,open:openChurn,setOpen:setOpenChurn},
    {label:"🟡 Regular",status:"regular",color:T.amber,open:openRegular,setOpen:setOpenRegular},
    {label:"🟢 VIP Ativo",status:"ativo",color:T.green,open:openAtivo,setOpen:setOpenAtivo},
  ];
  return(
    <div style={{display:"grid",gap:8}}>
      {cats.map(cat=>{
        const lista=motoristasOrdenados.filter(u=>vipScores[u.user]?.status===cat.status);
        return(
          <div key={cat.status} style={{background:T.bg2,border:`1px solid ${cat.open?cat.color+"50":T.border}`,borderRadius:12,overflow:"hidden"}}>
            <div onClick={()=>cat.setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:`${cat.color}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:T.sans,fontSize:16,fontWeight:800,color:cat.color}}>{lista.length}</span></div>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:cat.color}}>{cat.label}</div>
              </div>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{cat.open?"▲":"▼"}</span>
            </div>
            {cat.open&&lista.length>0&&(
              <div style={{borderTop:`1px solid ${T.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?380:undefined}}>
                  <thead><tr><th style={TH}>Motorista</th><th style={THR}>Score</th><th style={THR}>Dias</th><th style={TH}>Tel</th></tr></thead>
                  <tbody>
                    {lista.map(u=>{
                      const v=vipScores[u.user];const tel=getTel(u.user);
                      return(<tr key={u.user}>
                        <td style={TD}><div style={{fontWeight:500,fontSize:12}}>{trunc(u.user,isMobile?14:20)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{hubNome(u.localFreqKey)}</div></td>
                        <td style={TDR}><span style={{color:cat.color,fontWeight:600,fontSize:11}}>{v?.score||0}</span></td>
                        <td style={{...TDR,color:v&&v.diasSemRecarga>14?T.red:v&&v.diasSemRecarga>7?T.amber:T.text2}}>{v?.diasSemRecarga||0}d</td>
                        <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel?"📞":"—"}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {cat.open&&lista.length===0&&<div style={{padding:"12px 14px",fontFamily:T.mono,fontSize:11,color:T.text3,borderTop:`1px solid ${T.border}`}}>Nenhum motorista nesta categoria</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB USUÁRIOS ────────────────────────────────────────────────────────────

// ─── TAB DRE ─────────────────────────────────────────────────────────────────
function TabDRE({sessions,appState}:{sessions:Session[];appState:AppState}){
  const isMobile=useIsMobile();
  const hubs=useMemo(()=>Array.from(new Set(sessions.map(s=>s.hubKey))).sort(),[sessions]);
  const[station,setStation]=useState(hubs[0]||"");
  const cfg=appState.dreConfigs[station]||null;
  const sessoes=sessions.filter(s=>!s.cancelled&&s.energy>0&&s.hubKey===station);
  const datas=sessoes.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const days=new Set(sessoes.map(s=>s.date.toDateString())).size||1;
  const bruto=sessoes.reduce((a,s)=>a+s.value,0),totalKwh=sessoes.reduce((a,s)=>a+s.energy,0);
  const diasNoMes=30,faturMensal=bruto/periodDays*diasNoMes,faturAnual=faturMensal*12;
  let ll=bruto,margem=0,repInv=0,repHz=bruto,retMensalInv=0,rentAnual=0,faltaAmort=0,mesesPay=Infinity;
  let pMat=0,pPrev=0,pCur=0;
  const dreRows:{label:string;val:number;bold?:boolean;sep?:boolean;accent?:string}[]=[];
  if(cfg){
    const aliq=cfg.modelo==="propria"?dreSimples(faturAnual):cfg.pctImposto;
    const impostoVal=bruto*(aliq/100),custoEspaco=bruto*(cfg.pctEspaco/100),custoApp=bruto*(cfg.pctApp/100);
    let custoEnergia=0;
    if(!cfg.solarProprio){if(cfg.energiaTipo==="kwh")custoEnergia=totalKwh*cfg.energiaKwh;if(cfg.energiaTipo==="usina")custoEnergia=cfg.usinaFixo;}
    ll=bruto-custoEspaco-impostoVal-custoApp-custoEnergia-cfg.fixoInternet-cfg.fixoAluguel;
    margem=bruto>0?(ll/bruto)*100:0;
    repInv=cfg.modelo==="investidor"?ll*(cfg.invPct/100):0;
    repHz=cfg.modelo==="investidor"?ll*((100-cfg.invPct)/100):ll;
    retMensalInv=repInv/periodDays*diasNoMes;
    rentAnual=cfg.invTotal>0?(repInv/cfg.invTotal)*100*(diasNoMes/periodDays)*12:0;
    const restPrio=Math.max(0,cfg.invDividaPrio-cfg.invAmort);
    const restInv=Math.max(0,(cfg.invTotal-cfg.invPago)-Math.max(0,cfg.invAmort-cfg.invDividaPrio));
    let amPrio=0,amInv=0,disp=repInv;
    if(cfg.modelo==="investidor"){if(restPrio>0){amPrio=Math.min(disp,restPrio);disp-=amPrio;}if(restInv>0){amInv=Math.min(disp,restInv);disp-=amInv;}}
    faltaAmort=Math.max(0,cfg.invTotal-(cfg.invAmort+amPrio+amInv));
    mesesPay=retMensalInv>0?faltaAmort/retMensalInv:Infinity;
    const tot=cfg.invDividaPrio+(cfg.invTotal-cfg.invPago);
    pMat=tot>0?Math.min(100,(Math.min(cfg.invAmort,cfg.invDividaPrio)/tot)*100):0;
    pPrev=tot>0?Math.min(100,(Math.max(0,cfg.invAmort-cfg.invDividaPrio)/tot)*100):0;
    pCur=tot>0?Math.min(100,((amPrio+amInv)/tot)*100):0;
    dreRows.push({label:"(+) Receita Bruta",val:bruto,bold:true});
    if(cfg.pctEspaco>0)dreRows.push({label:`(−) Parceiro (${cfg.pctEspaco}%)`,val:-custoEspaco});
    dreRows.push({label:`(−) Imposto (${aliq.toFixed(1)}%)`,val:-impostoVal});
    dreRows.push({label:`(−) App (${cfg.pctApp}%)`,val:-custoApp});
    if(cfg.energiaTipo!=="incluido")dreRows.push({label:"(−) Energia",val:-custoEnergia});
    if(cfg.fixoAluguel>0)dreRows.push({label:"(−) Aluguel",val:-cfg.fixoAluguel});
    if(cfg.fixoInternet>0)dreRows.push({label:"(−) Internet",val:-cfg.fixoInternet});
    dreRows.push({label:"= Lucro Líquido",val:ll,bold:true,sep:true});
    if(cfg.modelo==="investidor")dreRows.push({label:`→ ${cfg.invNome||"Investidor"} (${cfg.invPct}%)`,val:repInv,accent:T.amber});
    dreRows.push({label:`→ HertzGo (${cfg.modelo==="investidor"?100-cfg.invPct:100}%)`,val:repHz,accent:T.green});
  }
  const allHealthScores=hubs.map(h=>({hub:h,hs:calcHealthScore(sessions,appState.dreConfigs[h]||null,h)}));
  const hs=calcHealthScore(sessions,cfg,station);
  const radarData=[{subject:"Financeiro",value:hs.financeiro,fullMark:40},{subject:"Operacional",value:hs.operacional,fullMark:35},{subject:"Investidor",value:hs.investidor,fullMark:25}];
  const pad=isMobile?"16px 14px":"24px 28px";
  return(
    <div style={{padding:pad}}>
      <SectionLabel>Health Score — Rede</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:isMobile?`repeat(${Math.min(allHealthScores.length,2)},1fr)`:`repeat(${Math.min(allHealthScores.length,6)},1fr)`,gap:10,marginBottom:24}}>
        {allHealthScores.map(({hub,hs:h})=>{
          const color=h.status==="saudavel"?T.green:h.status==="atencao"?T.amber:T.red;
          const emoji=h.status==="saudavel"?"🟢":h.status==="atencao"?"🟡":"🔴";
          return(
            <div key={hub} onClick={()=>setStation(hub)} style={{background:`${color}06`,border:`1px solid ${color}${station===hub?"60":"25"}`,borderRadius:14,padding:"12px 14px",cursor:"pointer",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
              <div style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:T.text,marginBottom:6,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{hubNome(hub)}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:18}}>{emoji}</span>
                <div style={{fontFamily:T.sans,fontSize:26,fontWeight:800,color,lineHeight:1}}>{h.total}</div>
                <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,alignSelf:"flex-end",marginBottom:2}}>/100</div>
              </div>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"capitalize" as const}}>{h.status==="saudavel"?"saudável":h.status==="atencao"?"atenção":"crítico"}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{fontFamily:T.sans,fontSize:15,fontWeight:700,color:T.text}}>📋 DRE — {hubNome(station)}</div>
      </div>
      {/* Selector hubs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {hubs.map(h=>(<button key={h} onClick={()=>setStation(h)} style={{padding:"4px 10px",borderRadius:8,fontFamily:T.mono,fontSize:10,cursor:"pointer",border:`1px solid ${station===h?T.green:T.border}`,background:station===h?T.greenDim:"transparent",color:station===h?T.green:T.text2}}>{hubNome(h)}</button>))}
      </div>
      {sessoes.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:20}}>
          <KpiCard label="Receita Bruta" value={brl(bruto)} sub={`${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`} accent={T.green}/>
          <KpiCard label="Lucro Líquido" value={brl(ll)} sub={`Margem ${margem.toFixed(1)}%`} accent={ll>=0?T.green:T.red}/>
          <KpiCard label="Proj. Mensal" value={brl(faturMensal)} sub="base 30 dias" accent={T.amber}/>
          <KpiCard label="Proj. Anual" value={brl(faturAnual)} sub="receita bruta" accent={T.blue}/>
        </div>
      )}
      {!cfg&&(<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"12px 16px",marginBottom:16,fontFamily:T.mono,fontSize:12,color:T.amber}}>⚙️ Configure o DRE em <strong>Config → DRE Config</strong>.</div>)}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":cfg?"1fr 1fr":"1fr",gap:16}}>
        <div>
          {sessoes.length===0?(<Panel><div style={{fontFamily:T.mono,fontSize:12,color:T.text3,padding:"20px 0",textAlign:"center"}}>Nenhuma sessão para {hubNome(station)}.</div></Panel>):cfg?(
            <Panel>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,marginBottom:14,color:T.text}}>Resultado Financeiro</div>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:T.mono,fontSize:12,minWidth:isMobile?300:undefined}}>
                  <thead><tr><th style={TH}>Item</th><th style={THR}>Período</th><th style={THR}>Mensal</th></tr></thead>
                  <tbody>{dreRows.map((r,i)=>(<tr key={i} style={{borderTop:r.sep?`1px solid ${T.border}`:"none",borderBottom:"1px solid rgba(255,255,255,0.02)"}}><td style={{...TD,fontWeight:r.bold?700:400,color:r.accent||(r.val>=0?T.text:T.red),fontSize:11}}>{r.label}</td><td style={{...TDR,color:r.accent||(r.val>=0?T.green:T.red),fontWeight:r.bold?700:400}}>{brl(r.val)}</td><td style={{...TDR,color:T.text2,fontSize:11}}>{brl(r.val*(diasNoMes/periodDays))}</td></tr>))}</tbody>
                </table>
              </div>
            </Panel>
          ):(
            <Panel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <KpiCard label="Receita" value={brl(bruto)} accent={T.green} small/><KpiCard label="kWh" value={`${totalKwh.toFixed(0)}`} accent={T.amber} small/>
                <KpiCard label="Sessões" value={`${sessoes.length}`} accent={T.blue} small/><KpiCard label="R$/kWh" value={`${(totalKwh>0?bruto/totalKwh:0).toFixed(2)}`} accent={T.purple} small/>
              </div>
            </Panel>
          )}
        </div>
        {cfg&&sessoes.length>0&&(
          <div>
            <Panel style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>🏥 Health Score</div><div style={{fontFamily:T.sans,fontSize:20,fontWeight:800,color:hs.status==="saudavel"?T.green:hs.status==="atencao"?T.amber:T.red}}>{hs.total}/100</div></div>
              <ResponsiveContainer width="100%" height={150}><RadarChart data={radarData}><PolarGrid stroke={T.border}/><PolarAngleAxis dataKey="subject" tick={{fill:T.text2,fontSize:10,fontFamily:T.mono}}/><Radar name="Score" dataKey="value" stroke={hs.status==="saudavel"?T.green:hs.status==="atencao"?T.amber:T.red} fill={hs.status==="saudavel"?T.green:hs.status==="atencao"?T.amber:T.red} fillOpacity={0.2}/></RadarChart></ResponsiveContainer>
              <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:8}}>{hs.diagnostico}</div>
            </Panel>
            {cfg.modelo==="investidor"&&(
              <Panel>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,marginBottom:12,color:T.text}}>👤 Investidor</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <KpiCard label="Retorno" value={brl(repInv)} sub={`${brl(retMensalInv)}/mês`} accent={T.amber} small/>
                  <KpiCard label="Rentab. Anual" value={`${rentAnual.toFixed(1)}%`} sub="a.a." accent={rentAnual>=12?T.green:T.amber} small/>
                  <KpiCard label="Payback" value={mesesPay===Infinity?"—":mesesPay<12?`${Math.ceil(mesesPay)}m`:`${(mesesPay/12).toFixed(1)}a`} sub="estimado" accent={mesesPay<=36?T.green:T.amber} small/>
                  <KpiCard label="Saldo" value={faltaAmort<=0?"✅ Quitado":brl(faltaAmort)} sub="devedor" accent={faltaAmort<=0?T.green:T.red} small/>
                </div>
                <div style={{height:18,background:T.bg3,borderRadius:4,overflow:"hidden",position:"relative",border:`1px solid ${T.border}`}}>
                  <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pMat}%`,background:"rgba(239,68,68,0.7)"}}/>
                  <div style={{position:"absolute",left:`${pMat}%`,top:0,height:"100%",width:`${pPrev}%`,background:"rgba(245,158,11,0.6)"}}/>
                  <div style={{position:"absolute",left:`${pMat+pPrev}%`,top:0,height:"100%",width:`${pCur}%`,background:"rgba(0,229,160,0.8)"}}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontFamily:T.mono,color:"#fff",fontWeight:600}}>{(pMat+pPrev+pCur).toFixed(1)}% amortizado</div>
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FILA DO DIA COMPONENTE ──────────────────────────────────────────────────
interface FilaDoDiaProps{
  sessions:Session[];appState:AppState;
  localDisparos:{ts:string;nome:string;msgId:string;status:"ok"|"err";msg?:string}[];
  getMsgTemplate:(k:string)=>string;
  abrirPreview:(nome:string,hubK:string,msgId:string,template:string,cupom:string)=>void;
  enviarUm:(nome:string,hubK:string,msgId:string,template:string,cupom:string)=>Promise<void>;
  onSaveState:(p:Partial<AppState>)=>void;
  isMobile:boolean;
  sending:Record<string,boolean>;
}
function FilaDoDia({sessions,appState,localDisparos,getMsgTemplate,abrirPreview,enviarUm,onSaveState,isMobile,sending}:FilaDoDiaProps){
  const limite=appState.limiteDisparoDiario||20;
  const horarioInicio=appState.metas["crm_inicio"]||9;
  const horarioFim=appState.metas["crm_fim"]||18;
  const intervaloMin=appState.metas["crm_intervalo_min"]||15;
  const intervaloMax=appState.metas["crm_intervalo_max"]||45;
  const{fila,semTelefone,novosDetectados}=useMemo(()=>gerarFilaDia(sessions,appState,limite),[sessions,appState,limite]);
  const disparadosHoje=localDisparos.filter(d=>d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<86400000).length;
  const[filaExpanded,setFilaExpanded]=useState(true);
  const[semTelExpanded,setSemTelExpanded]=useState(false);
  const segCores:Record<string,string>={Motorista:T.red,Heavy:T.amber,Shopper:T.green,Parceiro:T.blue,Embaixador:"#8b5cf6"};
  const[autoStatus,setAutoStatus]=useState<"idle"|"running"|"paused"|"done">("idle");
  const[autoIdx,setAutoIdx]=useState(0);
  const[autoTotal,setAutoTotal]=useState(0);
  const[proximoHorario,setProximoHorario]=useState<Date|null>(null);
  const[autoLog,setAutoLog]=useState<{nome:string;status:"ok"|"err";ts:Date}[]>([]);
  const autoRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pausedRef=useRef(false);

  const calcHorarios=(n:number)=>{
    const agora=new Date();
    const inicio=new Date();inicio.setHours(horarioInicio,0,0,0);
    const fim=new Date();fim.setHours(horarioFim,30,0,0);
    const base=agora>inicio?agora:inicio;
    const horarios:Date[]=[];
    let cursor=new Date(base.getTime());
    for(let i=0;i<n;i++){
      horarios.push(new Date(cursor));
      const delay=Math.floor(Math.random()*(intervaloMax-intervaloMin+1)+intervaloMin);
      cursor=new Date(cursor.getTime()+delay*60000);
      if(cursor>fim)break;
    }
    return horarios;
  };

  const getMsgPorEstacao=(msgId:string,hubK:string):string=>{
    if(msgId==="msg2a"){
      if(hubK==="cidadeauto")return getMsgTemplate("msg2a_cidadeauto");
      if(hubK==="costa")return getMsgTemplate("msg2b_costa");
      return getMsgTemplate("msg2a_parkway");
    }
    if(msgId==="msg2b"){
      if(hubK==="costa")return getMsgTemplate("msg2b_costa");
      if(hubK==="cidadeauto")return getMsgTemplate("msg2b_cidadeauto");
      return getMsgTemplate("msg2b_parkway");
    }
    return getMsgTemplate("msg1");
  };

  const iniciarDisparo=async()=>{
    if(fila.length===0){return;}
    const horarios=calcHorarios(fila.length);
    if(!window.confirm(`Disparar para ${fila.length} usuários?
Primeira mensagem: agora
Última: ~${horarios[horarios.length-1]?.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
Intervalo: ${intervaloMin}–${intervaloMax} min entre cada`))return;
    setAutoStatus("running");setAutoIdx(0);setAutoTotal(fila.length);setAutoLog([]);pausedRef.current=false;
    const disparar=async(i:number)=>{
      if(i>=fila.length){setAutoStatus("done");return;}
      if(pausedRef.current){setAutoStatus("paused");return;}
      const u=fila[i];setAutoIdx(i);
      const template=getMsgPorEstacao(u.msgId,u.hubKey);
      const cupomFila=u.msgId==="msg2a"?(u.hubKey==="cidadeauto"?getMsgTemplate("cupom_cidadeauto"):u.hubKey==="costa"?getMsgTemplate("cupom_costa"):getMsgTemplate("cupom_parkway")):"";
      await enviarUm(u.nome,u.hubKey,u.msgId,template,cupomFila);
      setAutoLog(prev=>[{nome:u.nome,status:"ok",ts:new Date()},...prev]);
      const delay=Math.floor(Math.random()*(intervaloMax-intervaloMin+1)+intervaloMin)*60000;
      const proximo=new Date(Date.now()+delay);
      setProximoHorario(proximo);
      if(i<fila.length-1){autoRef.current=setTimeout(()=>disparar(i+1),delay);}
      else{setAutoStatus("done");}
    };
    disparar(0);
  };

  const pausarDisparo=()=>{pausedRef.current=true;if(autoRef.current)clearTimeout(autoRef.current);setAutoStatus("paused");};
  const retomar=()=>{
    pausedRef.current=false;setAutoStatus("running");
    const i=autoIdx+1;
    const delay=Math.floor(Math.random()*(intervaloMax-intervaloMin+1)+intervaloMin)*60000;
    autoRef.current=setTimeout(()=>{
      const disparar=async(idx:number)=>{
        if(idx>=fila.length){setAutoStatus("done");return;}
        if(pausedRef.current){setAutoStatus("paused");return;}
        const u=fila[idx];setAutoIdx(idx);
        const template=getMsgPorEstacao(u.msgId,u.hubKey);
        const cupomFila=u.msgId==="msg2a"?(u.hubKey==="cidadeauto"?getMsgTemplate("cupom_cidadeauto"):u.hubKey==="costa"?getMsgTemplate("cupom_costa"):getMsgTemplate("cupom_parkway")):"";
        await enviarUm(u.nome,u.hubKey,u.msgId,template,cupomFila);
        setAutoLog(prev=>[{nome:u.nome,status:"ok",ts:new Date()},...prev]);
        const d=Math.floor(Math.random()*(intervaloMax-intervaloMin+1)+intervaloMin)*60000;
        setProximoHorario(new Date(Date.now()+d));
        if(idx<fila.length-1)autoRef.current=setTimeout(()=>disparar(idx+1),d);
        else setAutoStatus("done");
      };
      disparar(i);
    },delay);
  };

  const pct=autoTotal>0?Math.round((autoIdx/autoTotal)*100):0;
  const horariosPreview=fila.length>0?calcHorarios(fila.length):[];

  return(
    <div style={{marginBottom:20}}>
      <div style={{background:"rgba(0,229,160,0.06)",border:"1px solid rgba(0,229,160,0.25)",borderRadius:14,overflow:"hidden",marginBottom:10}}>
        <div onClick={()=>setFilaExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>🎯</span>
            <div>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.green}}>Fila do Dia — Algoritmo Inteligente</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{fila.length} prontos · {disparadosHoje}/{limite} hoje · {semTelefone.length} sem tel · {intervaloMin}–{intervaloMax} min intervalo</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {novosDetectados.length>0&&<span style={{fontFamily:T.mono,fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(245,158,11,0.2)",color:T.amber,border:"1px solid rgba(245,158,11,0.3)"}}>⚠️ {novosDetectados.length} novos</span>}
            <span style={{fontFamily:T.mono,fontSize:11,padding:"2px 9px",borderRadius:20,background:"rgba(0,229,160,0.15)",color:T.green,border:"1px solid rgba(0,229,160,0.3)"}}>{fila.length}</span>
            <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{filaExpanded?"▲":"▼"}</span>
          </div>
        </div>
        {autoStatus!=="idle"&&(
          <div style={{padding:"12px 16px",borderTop:"1px solid rgba(0,229,160,0.2)",background:"rgba(0,229,160,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
              <div style={{fontFamily:T.mono,fontSize:11,color:T.green}}>
                {autoStatus==="running"?"⚡ Disparando...":autoStatus==="paused"?"⏸️ Pausado":autoStatus==="done"?"✅ Concluído":""}
                {" "}<span style={{color:T.text2}}>{autoIdx}/{autoTotal} enviados</span>
              </div>
              {autoStatus==="running"&&proximoHorario&&<span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>próxima: {proximoHorario.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}
              <div style={{display:"flex",gap:8}}>
                {autoStatus==="running"&&<button onClick={pausarDisparo} style={{padding:"4px 12px",borderRadius:6,fontFamily:T.mono,fontSize:11,cursor:"pointer",background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",color:T.amber}}>⏸️ Pausar</button>}
                {autoStatus==="paused"&&<button onClick={retomar} style={{padding:"4px 12px",borderRadius:6,fontFamily:T.mono,fontSize:11,cursor:"pointer",background:T.greenDim,border:"1px solid rgba(0,229,160,0.3)",color:T.green}}>▶️ Retomar</button>}
                {(autoStatus==="paused"||autoStatus==="done")&&<button onClick={()=>{setAutoStatus("idle");setAutoIdx(0);setAutoLog([]);}} style={{padding:"4px 12px",borderRadius:6,fontFamily:T.mono,fontSize:11,cursor:"pointer",background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,color:T.text3}}>↩ Reset</button>}
              </div>
            </div>
            <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:T.green,borderRadius:3,transition:"width 0.5s"}}/>
            </div>
            {autoLog.length>0&&(
              <div style={{marginTop:8,maxHeight:80,overflowY:"auto"}}>
                {autoLog.slice(0,5).map((l,i)=>(<div key={i} style={{fontFamily:T.mono,fontSize:10,color:T.text2,padding:"2px 0"}}>{l.status==="ok"?"✅":"❌"} {trunc(l.nome,20)} · {l.ts.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>))}
              </div>
            )}
          </div>
        )}
        {filaExpanded&&(
          <div style={{borderTop:"1px solid rgba(0,229,160,0.2)"}}>
            {novosDetectados.length>0&&(
              <div style={{padding:"10px 16px",background:"rgba(245,158,11,0.06)",borderBottom:"1px solid rgba(245,158,11,0.2)",fontFamily:T.mono,fontSize:11,color:T.amber}}>
                ⚠️ Novos usuários sem cadastro: <strong>{novosDetectados.slice(0,5).join(", ")}{novosDetectados.length>5?` +${novosDetectados.length-5}`:""}</strong>
                <br/><span style={{fontSize:10,color:T.text3}}>→ Exporte CSV de usuários da Spott e importe em Config → Contatos → Base Mestre</span>
              </div>
            )}
            {fila.length===0?(
              <div style={{padding:"20px",textAlign:"center" as const,fontFamily:T.mono,fontSize:11,color:T.text3}}>
                {disparadosHoje>=limite?"✅ Limite diário atingido":"✅ Fila vazia — todos contactados recentemente"}
              </div>
            ):(
              <>
                {autoStatus==="idle"&&(
                  <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,229,160,0.15)",background:"rgba(0,229,160,0.03)"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                      <div style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>
                        {fila.length} mensagens · {horarioInicio}h–{horarioFim}h · intervalo {intervaloMin}–{intervaloMax} min
                        {horariosPreview.length>0&&<span style={{color:T.text3}}> · última ~{horariosPreview[horariosPreview.length-1]?.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}
                      </div>
                      <button onClick={iniciarDisparo} style={{padding:"8px 20px",borderRadius:10,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer",background:T.green,color:T.bg,border:"none"}}>
                        🚀 Iniciar Fila do Dia
                      </button>
                    </div>
                  </div>
                )}
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?400:undefined}}>
                    <thead><tr style={{background:T.bg3}}>
                      <th style={TH}>Usuário</th><th style={TH}>Segmento</th><th style={TH}>Estação</th>
                      <th style={THR}>Dias</th><th style={TH}>Fonte</th><th style={THR}></th>
                    </tr></thead>
                    <tbody>
                      {fila.map((u,idx)=>{
                        const cor=segCores[u.segmento]||T.text2;
                        const tipoEmoji=u.hubTipoStr==="propria"?"🏠":u.hubTipoStr==="parceria"?"🤝":"📋";
                        const sendKey=`${u.nome}_${u.msgId}_fila`;
                        const template=getMsgPorEstacao(u.msgId,u.hubKey);
                        const isEnviado=autoLog.some(l=>l.nome===u.nome);
                        const isAtual=autoStatus==="running"&&autoIdx===idx;
                        return(
                          <tr key={u.nome} style={{borderBottom:"1px solid rgba(255,255,255,0.02)",background:isAtual?"rgba(0,229,160,0.06)":isEnviado?"rgba(255,255,255,0.02)":"",opacity:isEnviado?0.5:1}}>
                            <td style={TD}>
                              <div style={{fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                                {isEnviado&&<span style={{color:T.green,fontSize:10}}>✅</span>}
                                {isAtual&&<span style={{fontSize:10}}>⚡</span>}
                                {trunc(u.nome,isMobile?14:22)}
                              </div>
                              <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{u.sessoes}x · R${u.valor.toFixed(0)}</div>
                            </td>
                            <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 7px",borderRadius:4,background:`${cor}18`,color:cor,border:`1px solid ${cor}30`}}>{u.segmento}</span>{u.fonteSegmento!=="csv"&&<span style={{fontFamily:T.mono,fontSize:9,color:T.green,marginLeft:4}}>✓</span>}</td>
                            <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{tipoEmoji} {trunc(u.hubNomeStr,isMobile?10:16)}</span></td>
                            <td style={{...TDR,color:u.diasSemRecarga>21?T.red:u.diasSemRecarga>10?T.amber:T.text2,fontSize:11}}>{u.diasSemRecarga}d</td>
                            <td style={{...TD,fontSize:10,color:T.text3}}>{u.fonteSegmento}</td>
                            <td style={TDR}>
                              <button onClick={()=>abrirPreview(u.nome,u.hubKey,u.msgId,template,"")} disabled={sending[sendKey]||isEnviado} style={{padding:"5px 10px",borderRadius:6,fontFamily:T.mono,fontSize:11,cursor:isEnviado?"default":"pointer",background:isEnviado?"rgba(255,255,255,0.03)":sending[sendKey]?"rgba(255,255,255,0.05)":"rgba(0,229,160,0.15)",border:`1px solid ${isEnviado?T.border:sending[sendKey]?T.border:"rgba(0,229,160,0.3)"}`,color:isEnviado?T.text3:sending[sendKey]?T.text3:T.green}}>{isEnviado?"✓":sending[sendKey]?"⏳":"📤"}</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {semTelefone.length>0&&(
        <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,overflow:"hidden",marginBottom:10}}>
          <div onClick={()=>setSemTelExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",cursor:"pointer"}}>
            <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.red}}>📵 Sem telefone — {semTelefone.length} usuários</div>
            <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{semTelExpanded?"▲":"▼"}</span>
          </div>
          {semTelExpanded&&(
            <div style={{borderTop:"1px solid rgba(239,68,68,0.15)",overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?360:undefined}}>
                <thead><tr><th style={TH}>Usuário</th><th style={TH}>Segmento</th><th style={TH}>Estação</th><th style={THR}>Valor</th><th style={TH}>Email</th></tr></thead>
                <tbody>
                  {semTelefone.slice(0,20).map(u=>{
                    const cor=segCores[u.segmento]||T.text2;
                    return(<tr key={u.nome} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                      <td style={TD}><div style={{fontSize:12}}>{trunc(u.nome,isMobile?14:20)}</div></td>
                      <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 6px",borderRadius:4,background:`${cor}15`,color:cor}}>{u.segmento}</span></td>
                      <td style={{...TD,fontSize:11,color:T.text2}}>{trunc(u.hubNomeStr,12)}</td>
                      <td style={{...TDR,color:T.text2,fontSize:11}}>R${u.valor.toFixed(0)}</td>
                      <td style={{...TD,fontSize:10,color:u.email?T.blue:T.text3}}>{u.email?`✉️ ${trunc(u.email,isMobile?12:20)}`:"—"}</td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB AÇÕES ───────────────────────────────────────────────────────────────
function TabAcoes({sessions,appState,onSaveDisparos,onSaveState}:{sessions:Session[];appState:AppState;onSaveDisparos:(d:AppState["disparos"])=>void;onSaveState:(p:Partial<AppState>)=>void}){
  const isMobile=useIsMobile();
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const[zapiStatus,setZapiStatus]=useState<"unknown"|"ok"|"err">("unknown");
  const[preview,setPreview]=useState<{user:string;hubK:string;msgId:string;template:string;cupom:string;tel:string;msg:string}|null>(null);
  const[respostas,setRespostas]=useState<{id:string;telefone:string;mensagem:string;resposta:string|null;criado_em:string}[]>([]);
  const[loadingResp,setLoadingResp]=useState(false);
  const[autoIdentificados,setAutoIdentificados]=useState<string[]>([]);
  const[confirmModal,setConfirmModal]=useState<{msg:string;qtd:number;onConfirm:()=>void}|null>(null);
  const[toastMsg,setToastMsg]=useState<string|null>(null);
  const showToast=(msg:string)=>{setToastMsg(msg);setTimeout(()=>setToastMsg(null),4000);};

  // Cruzar telefone com base mestre → identificar usuário
  const cruzarTelefone=(tel:string):string|null=>{
    const t=tel.replace(/\D/g,"");
    const match=Object.values(appState.baseMestre).find(u=>{
      const ut=u.telefone.replace(/\D/g,"");
      return ut===t||ut.slice(-8)===t.slice(-8);
    });
    return match?.nome||null;
  };

  const marcarProcessado=async(id:string)=>{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return;
    await fetch(`${url}/rest/v1/webhook_respostas?id=eq.${id}`,{method:"PATCH",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({processado:true})});
    setRespostas(r=>r.filter(x=>x.id!==id));
  };

  const buscarRespostas=useCallback(async(silent=false)=>{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return;
    if(!silent)setLoadingResp(true);
    try{
      const res=await fetch(`${url}/rest/v1/webhook_respostas?processado=eq.false&order=criado_em.desc&limit=50`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
      if(res.ok){
        const data=await res.json();
        setRespostas(data);
        // Auto-identificar e salvar overrides
        const novosOverrides:Record<string,UserOverride>={};
        const novosIds:string[]=[];
        for(const r of data){
          if(r.resposta!=="1"&&r.resposta!=="2")continue;
          if(autoIdentificados.includes(r.id))continue;
          const nome=cruzarTelefone(r.telefone);
          if(!nome)continue;
          novosOverrides[nome.toLowerCase()]={isMotorista:r.resposta==="1",atualizadoEm:new Date().toISOString(),fonte:"whatsapp"};
          novosIds.push(r.id);
          marcarProcessado(r.id);
        }
        if(Object.keys(novosOverrides).length>0){
          onSaveState({userOverrides:{...appState.userOverrides,...novosOverrides}});
          setAutoIdentificados(prev=>[...prev,...novosIds]);
          const m=Object.values(novosOverrides).filter(v=>v.isMotorista===true).length;
          const n=Object.values(novosOverrides).filter(v=>v.isMotorista===false).length;
          const msgs:string[]=[];
          if(m>0)msgs.push(`${m} motorista${m>1?"s":""} ✅`);
          if(n>0)msgs.push(`${n} não motorista${n>1?"s":""}`);
          showToast(`WhatsApp: ${msgs.join(" · ")} identificado${msgs.length>1?"s":""}`);
        }
      }
    }catch(e){console.error(e);}
    finally{if(!silent)setLoadingResp(false);}
  },[autoIdentificados,appState.baseMestre,appState.userOverrides]);

  // Auto-busca ao montar + polling 60s
  useEffect(()=>{
    buscarRespostas(true);
    const iv=setInterval(()=>buscarRespostas(true),60000);
    return()=>clearInterval(iv);
  },[]);
  const[sending,setSending]=useState<Record<string,boolean>>({});
  const[localDisparos,setLocalDisparos]=useState(appState.disparos);
  const[expandedSection,setExpandedSection]=useState<string|null>("msg1");
  const[msgEdits,setMsgEdits]=useState<Record<string,string>>({});
  useEffect(()=>{fetch("/api/zapi").then(r=>r.json()).then(d=>{setZapiStatus(d.configured&&d.connected?"ok":"err");}).catch(()=>setZapiStatus("err"));},[]);
  const telMap:Record<string,string>={};
  Object.values(appState.contatos).forEach(c=>{c.dados.forEach(d=>{if(d.telefone)telMap[d.nome.trim().toLowerCase()]=d.telefone;});});
  const getTel=(nome:string)=>{const n=nome.trim().toLowerCase();if(telMap[n])return telMap[n];const found=Object.keys(telMap).find(k=>k.includes(n)||n.includes(k));return found?telMap[found]:null;};
  const jaContatado=(nome:string,msgId:string,dias:number=30)=>localDisparos.some(d=>d.nome===nome&&d.msgId===msgId&&d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<dias*86400000);
  const vipScores:Record<string,ReturnType<typeof calcVipScore>>={};
  users.filter(u=>u.isMotorista).forEach(u=>{vipScores[u.user]=calcVipScore(u.user,ok);});
  const getMsgTemplate=(key:string)=>msgEdits[key]??appState.mensagens[key as keyof Mensagens]??"";
  const montarMsg=(template:string,nome:string,hubK:string,cupom:string="")=>template.replace(/\[nome\]/gi,nome.split(" ")[0]).replace(/\[local\]/gi,hubNome(hubK)).replace(/\[cupom\]/gi,cupom).replace(/\[beneficio\]/gi,"prioridade e desconto exclusivo");
  const abrirPreview=(user:string,hubK:string,msgId:string,template:string,cupom:string="")=>{const tel=getTel(user)||"";const msg=montarMsg(template,user,hubK,cupom);setPreview({user,hubK,msgId,template,cupom,tel,msg});};
  const enviarUm=async(user:string,hubK:string,msgId:string,template:string,cupom:string="")=>{
    const tel=getTel(user);if(!tel)return;
    setSending(p=>({...p,[`${user}_${msgId}`]:true}));
    const msg=montarMsg(template,user,hubK,cupom);
    try{const r=await fetch("/api/zapi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:tel,message:msg})});const d=await r.json();const entry={ts:new Date().toISOString(),nome:user,msgId,status:d.ok?"ok" as const:"err" as const,msg:d.erro};const updated=[entry,...localDisparos.slice(0,199)];setLocalDisparos(updated);onSaveDisparos(updated);}
    catch{const entry={ts:new Date().toISOString(),nome:user,msgId,status:"err" as const,msg:"Erro de rede"};const updated=[entry,...localDisparos.slice(0,199)];setLocalDisparos(updated);onSaveDisparos(updated);}
    setSending(p=>({...p,[`${user}_${msgId}`]:false}));
  };
  const[selecionados,setSelecionados]=useState<Record<string,string[]>>({});
  const getSel=(section:string)=>new Set(selecionados[section]||[]);
  const toggleSel=(section:string,user:string)=>setSelecionados(p=>{const s=new Set(p[section]||[]);s.has(user)?s.delete(user):s.add(user);return{...p,[section]:Array.from(s)};});
  const toggleTodos=(section:string,lista:UserData[])=>setSelecionados(p=>{const curr=new Set(p[section]||[]);const comTel=lista.filter(u=>getTel(u.user)).map(u=>u.user);const updated=curr.size===comTel.length?new Set<string>():new Set(comTel);return{...p,[section]:Array.from(updated)};});
  const[enviandoLote,setEnviandoLote]=useState<Record<string,boolean>>({});
  const enviarLote=async(section:string,lista:UserData[],msgId:string,template:string,cupom:string="")=>{
    const sel=getSel(section);const elegíveis=lista.filter(u=>sel.has(u.user)&&getTel(u.user));
    if(!elegíveis.length){alert("Nenhum selecionado com telefone.");return;}
    // Modal inline — não usa confirm() nativo
    await new Promise<void>((resolve,reject)=>{
      setConfirmModal({msg:`Disparar para ${elegíveis.length} usuário${elegíveis.length>1?"s":""}?`,qtd:elegíveis.length,onConfirm:()=>{setConfirmModal(null);resolve();}});
      setTimeout(()=>{setConfirmModal(null);reject(new Error("timeout"));},30000);
    }).catch(()=>{return;});
    setEnviandoLote(p=>({...p,[section]:true}));
    for(let i=0;i<elegíveis.length;i++){await enviarUm(elegíveis[i].user,elegíveis[i].localFreqKey,msgId,template,cupom);if(i<elegíveis.length-1)await new Promise(r=>setTimeout(r,3000));}
    setSelecionados(p=>({...p,[section]:[]}));setEnviandoLote(p=>({...p,[section]:false}));
  };
  const leads1=users.filter(u=>!u.isParceiro&&isCrmAtiva(u.localFreqKey)&&!jaContatado(u.user,"msg1"));
  const motoristasMigracao=users.filter(u=>u.isMotorista&&isCrmAtiva(u.localFreqKey)&&(ESTACAO_PARCERIA.includes(u.localFreqKey)||["mamute","madeiro_sia"].includes(u.localFreqKey))&&!jaContatado(u.user,"msg2a",60));
  const fidelizacao=users.filter(u=>!u.isParceiro&&!u.isMotorista&&(ESTACAO_PROPRIA.includes(u.localFreqKey)||ESTACAO_PARCERIA.includes(u.localFreqKey))&&!jaContatado(u.user,"msg2b",60));
  const vipsAtivos=users.filter(u=>u.isMotorista&&ESTACAO_PROPRIA.includes(u.localFreqKey)&&vipScores[u.user]?.status==="ativo"&&!jaContatado(u.user,"msg_vip",30));
  const emRisco=users.filter(u=>u.isMotorista&&isCrmAtiva(u.localFreqKey)&&["em_risco"].includes(vipScores[u.user]?.status||"")&&!jaContatado(u.user,"msg_risco",14));
  const churned=users.filter(u=>u.isMotorista&&isCrmAtiva(u.localFreqKey)&&vipScores[u.user]?.status==="churned"&&!jaContatado(u.user,"msg_churn",30));
  const secoes=[
    {id:"msg1",emoji:"📤",title:"MSG 1 — Qualificação",sub:"Novos não contatados",color:T.red,count:leads1.length,lista:leads1,msgKey:"msg1",cupomKey:"",msgId:"msg1"},
    {id:"msg2a",emoji:"🟢",title:"MSG 2A — Migração",sub:"Motoristas → estações próprias",color:T.green,count:motoristasMigracao.length,lista:motoristasMigracao,msgKey:"msg2a_parkway",cupomKey:"cupom_parkway",msgId:"msg2a"},
    {id:"msg2b",emoji:"🛒",title:"MSG 2B — Fidelização",sub:"Não motoristas nas estações ativas",color:T.blue,count:fidelizacao.length,lista:fidelizacao,msgKey:"msg2b_parkway",cupomKey:"cupom_parkway",msgId:"msg2b"},
    {id:"msg_vip",emoji:"🏆",title:"MSG VIP",sub:"Motoristas VIP ativos",color:T.amber,count:vipsAtivos.length,lista:vipsAtivos,msgKey:"msg2a_vip_parkway",cupomKey:"cupom_vip",msgId:"msg_vip"},
    {id:"msg_risco",emoji:"🟠",title:"MSG Risco",sub:"VIPs com frequência caindo",color:"#fb923c",count:emRisco.length,lista:emRisco,msgKey:"msg_risco",cupomKey:"",msgId:"msg_risco"},
    {id:"msg_churn",emoji:"🔴",title:"MSG Churn",sub:"Sumidos há 14+ dias",color:T.red,count:churned.length,lista:churned,msgKey:"msg_churn",cupomKey:"",msgId:"msg_churn"},
  ];
  const pad=isMobile?"16px 14px":"24px 28px";
  return(
    <div style={{padding:pad}}>
      {/* MODAL PREVIEW — adaptado para mobile */}
      {preview&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}>
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:isMobile?"24px 20px 32px":"28px",width:"100%",maxWidth:560,position:"relative"}}>
            <button onClick={()=>setPreview(null)} style={{position:"absolute",top:16,right:16,background:"transparent",border:"none",color:T.text3,fontSize:20,cursor:"pointer"}}>✕</button>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Preview da Mensagem</div>
            <div style={{fontFamily:T.sans,fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Como vai chegar no WhatsApp</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              <div style={{background:T.bg3,borderRadius:10,padding:"10px 12px"}}><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Para</div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{preview.user.split(" ").slice(0,2).join(" ")}</div></div>
              <div style={{background:T.bg3,borderRadius:10,padding:"10px 12px"}}><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Tel</div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:preview.tel?T.green:T.red}}>{preview.tel||"⚠️ Sem tel"}</div></div>
            </div>
            <div style={{background:"#1a2333",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{background:"#005c4b",borderRadius:"12px 12px 12px 2px",padding:"10px 14px",display:"inline-block",maxWidth:"90%"}}>
                <div style={{fontFamily:"system-ui, sans-serif",fontSize:14,color:"#e9edef",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{preview.msg}</div>
                <div style={{fontFamily:"system-ui, sans-serif",fontSize:11,color:"rgba(233,237,239,0.6)",textAlign:"right",marginTop:3}}>agora ✓✓</div>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setPreview(null)} style={{flex:1,padding:"13px",borderRadius:12,fontFamily:T.sans,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:`1px solid ${T.border}`,color:T.text2}}>Cancelar</button>
              <button onClick={()=>{if(!preview.tel)return;enviarUm(preview.user,preview.hubK,preview.msgId,preview.template,preview.cupom);setPreview(null);}} disabled={!preview.tel} style={{flex:2,padding:"13px",borderRadius:12,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:preview.tel?"pointer":"not-allowed",background:preview.tel?T.green:"rgba(255,255,255,0.05)",color:preview.tel?T.bg:T.text3,border:"none",opacity:preview.tel?1:0.5}}>
                🚀 Confirmar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TOAST */}
      {toastMsg&&(
        <div style={{position:"fixed",bottom:isMobile?80:24,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"rgba(0,229,160,0.95)",color:T.bg,padding:"10px 20px",borderRadius:12,fontFamily:T.mono,fontSize:12,fontWeight:700,boxShadow:"0 4px 24px rgba(0,0,0,0.4)",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"}}>
          ✅ {toastMsg}
        </div>
      )}
      {/* MODAL CONFIRMAÇÃO INLINE */}
      {confirmModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:20,padding:"28px 24px",maxWidth:360,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>🚀</div>
            <div style={{fontFamily:T.sans,fontSize:16,fontWeight:700,color:T.text,marginBottom:8}}>Confirmar Disparo</div>
            <div style={{fontFamily:T.mono,fontSize:12,color:T.text2,marginBottom:24,lineHeight:1.6}}>{confirmModal.msg}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmModal(null)} style={{flex:1,padding:"12px",borderRadius:12,fontFamily:T.sans,fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent",border:`1px solid ${T.border}`,color:T.text2}}>Cancelar</button>
              <button onClick={confirmModal.onConfirm} style={{flex:2,padding:"12px",borderRadius:12,fontFamily:T.sans,fontSize:13,fontWeight:700,cursor:"pointer",background:T.green,color:T.bg,border:"none"}}>🚀 Disparar {confirmModal.qtd}</button>
            </div>
          </div>
        </div>
      )}
      {/* KPIs — incluindo status WhatsApp */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10,marginBottom:20}}>
        <KpiCard label="Z-API" value={zapiStatus==="ok"?"✅ OK":zapiStatus==="err"?"⚠️ Verificar":"⏳"} sub="status" accent={zapiStatus==="ok"?T.green:T.amber} small/>
        <KpiCard
          label="WhatsApp"
          value={loadingResp?"⏳":respostas.length>0?`${respostas.length} nova${respostas.length>1?"s":""}`:"✅"}
          sub={loadingResp?"buscando...":respostas.length>0?`${respostas.filter(r=>r.resposta==="1").length} motor · ${respostas.filter(r=>r.resposta==="2").length} não`:"sem pendentes"}
          accent={respostas.length>0?T.amber:T.green}
          small
        />
        <KpiCard label="Fila Total" value={`${secoes.reduce((a,s)=>a+s.count,0)}`} sub="elegíveis" accent={T.red} small/>
        <KpiCard label="Enviados 30d" value={`${localDisparos.filter(d=>d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<30*86400000).length}`} sub="confirmados" accent={T.amber} small/>
        <KpiCard label="Total Enviado" value={`${localDisparos.filter(d=>d.status==="ok").length}`} sub="Z-API" accent={T.green} small/>
      </div>

      {/* FILA DO DIA — ALGORITMO INTELIGENTE */}
      <FilaDoDia sessions={sessions} appState={appState} localDisparos={localDisparos} getMsgTemplate={getMsgTemplate} abrirPreview={abrirPreview} enviarUm={enviarUm} onSaveState={onSaveState} isMobile={isMobile} sending={sending}/>
            {zapiStatus==="err"&&(<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:16,fontFamily:T.mono,fontSize:11,color:T.amber}}>⚠️ Configure em Config → Z-API</div>)}
      {Object.keys(appState.contatos).length===0&&(<div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:16,fontFamily:T.mono,fontSize:11,color:"#60a5fa"}}>ℹ️ Importe o CSV de usuários em Config → Contatos.</div>)}
      {/* Seções CRM */}
      {secoes.map(sec=>{
        const isOpen=expandedSection===sec.id;
        const sel=getSel(sec.id);
        const comTel=sec.lista.filter(u=>getTel(u.user));
        const template=getMsgTemplate(sec.msgKey);
        const cupom=sec.cupomKey?getMsgTemplate(sec.cupomKey):"";
        return(
          <div key={sec.id} style={{marginBottom:10,background:T.bg2,border:`1px solid ${isOpen?sec.color+"40":T.border}`,borderRadius:14,overflow:"hidden"}}>
            <div onClick={()=>setExpandedSection(isOpen?null:sec.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>{sec.emoji}</span>
                <div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{sec.title}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{sec.sub}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:T.mono,fontSize:11,padding:"2px 9px",borderRadius:20,background:`${sec.color}20`,color:sec.color,border:`1px solid ${sec.color}40`}}>{sec.count}</span>
                <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>
            {isOpen&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:"14px"}}>
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:5}}>✉️ Mensagem</div>
                  <textarea value={template} onChange={e=>setMsgEdits(p=>({...p,[sec.msgKey]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"10px 12px",borderRadius:10,fontSize:12,fontFamily:T.mono,resize:"vertical",minHeight:80,lineHeight:1.6,boxSizing:"border-box"}}/>
                  {sec.cupomKey&&(<div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}><span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>🎟️ Cupom:</span><input value={cupom} onChange={e=>setMsgEdits(p=>({...p,[sec.cupomKey]:e.target.value}))} style={{background:T.bg3,border:`1px solid ${T.border}`,color:T.amber,padding:"4px 8px",borderRadius:6,fontSize:12,fontFamily:T.mono,width:120}}/></div>)}
                </div>
                {/* Barra lote */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,padding:"8px 10px",background:T.bg3,borderRadius:8,flexWrap:"wrap",gap:8}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:T.mono,fontSize:11,color:T.text2}}>
                    <input type="checkbox" checked={comTel.length>0&&comTel.every(u=>sel.has(u.user))} onChange={()=>toggleTodos(sec.id,sec.lista)} style={{accentColor:sec.color,width:13,height:13}}/>
                    Todos com tel ({comTel.length})
                  </label>
                  <button onClick={()=>enviarLote(sec.id,sec.lista,sec.msgId,template,cupom)} disabled={enviandoLote[sec.id]||sel.size===0} style={{padding:"6px 14px",borderRadius:8,fontFamily:T.mono,fontSize:11,cursor:sel.size===0?"not-allowed":"pointer",background:sel.size>0?`${sec.color}20`:"rgba(255,255,255,0.04)",border:`1px solid ${sel.size>0?sec.color+"50":T.border}`,color:sel.size>0?sec.color:T.text3}}>
                    {enviandoLote[sec.id]?"⏳ Enviando...":`🚀 Disparar (${sel.size})`}
                  </button>
                </div>
                {/* Lista usuários */}
                {sec.lista.length===0?(<div style={{fontFamily:T.mono,fontSize:11,color:T.text3,textAlign:"center",padding:"12px"}}>✅ Fila vazia</div>):(
                  <div style={{maxHeight:260,overflowY:"auto",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?340:undefined}}>
                      <thead><tr><th style={{...TH,width:20}}></th><th style={TH}>Usuário</th><th style={THR}>kWh</th><th style={TH}>Tel</th><th style={THR}></th></tr></thead>
                      <tbody>
                        {sec.lista.map(u=>{
                          const tel=getTel(u.user);const isSel=sel.has(u.user);const sendKey=`${u.user}_${sec.msgId}`;
                          return(<tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)",background:isSel?`${sec.color}06`:""}}>
                            <td style={{...TD,width:20,textAlign:"center"}}>{tel&&<input type="checkbox" checked={isSel} onChange={()=>toggleSel(sec.id,u.user)} style={{accentColor:sec.color,width:13,height:13,cursor:"pointer"}}/>}</td>
                            <td style={TD}><div style={{fontWeight:500,fontSize:12}}>{trunc(u.user,isMobile?14:22)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{hubNome(u.localFreqKey)}</div></td>
                            <td style={{...TDR,color:T.text2,fontSize:11}}>{u.kwh.toFixed(1)}</td>
                            <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel?"📞":"—"}</td>
                            <td style={TDR}>{tel?(<button onClick={()=>abrirPreview(u.user,u.localFreqKey,sec.msgId,template,cupom)} disabled={sending[sendKey]} style={{padding:"5px 10px",borderRadius:6,fontFamily:T.mono,fontSize:11,cursor:sending[sendKey]?"not-allowed":"pointer",background:sending[sendKey]?"rgba(255,255,255,0.05)":`${sec.color}20`,border:`1px solid ${sending[sendKey]?T.border:sec.color+"50"}`,color:sending[sendKey]?T.text3:sec.color}}>{sending[sendKey]?"⏳":"📤"}</button>):<span style={{color:T.text3,fontSize:10}}>—</span>}</td>
                          </tr>);
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {localDisparos.length>0&&(<><SectionLabel>Histórico</SectionLabel><Panel style={{maxHeight:180,overflowY:"auto"}}>{localDisparos.slice(0,50).map((l,i)=>(<div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontFamily:T.mono,fontSize:10,flexWrap:"wrap"}}><span style={{color:T.text3}}>{new Date(l.ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span style={{color:l.status==="ok"?T.green:T.red}}>{l.status==="ok"?"✅":"❌"}</span><span style={{color:T.text}}>{trunc(l.nome,isMobile?16:24)}</span><span style={{color:T.text3,fontSize:9}}>{l.msgId}</span></div>))}</Panel></>)}
    </div>
  );
}

// ─── TAB CONFIG ──────────────────────────────────────────────────────────────
function TabConfig({appState,onSave}:{appState:AppState;onSave:(partial:Partial<AppState>)=>void}){
  const isMobile=useIsMobile();
  const[activeSection,setActiveSection]=useState<"contatos"|"mensagens"|"dre"|"cupons"|"estacoes"|"zapi">("contatos");
  const[msgs,setMsgs]=useState<Mensagens>(appState.mensagens);
  const[msgSaved,setMsgSaved]=useState(false);
  const[uploadStatus,setUploadStatus]=useState("");
  const[zapi,setZapi]=useState<ZAPIConfig>(appState.zapi||{instanceId:"",token:"",clientToken:""});
  const[zapiSaved,setZapiSaved]=useState(false);
  const[zapiTesting,setZapiTesting]=useState(false);
  const[zapiTestResult,setZapiTestResult]=useState("");
  const[dreStation,setDreStation]=useState("costa");
  const[dreSaved,setDreSaved]=useState(false);
  const autoSaveRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const baseMestreRef=useRef<HTMLInputElement>(null);
  const[limiteDisp,setLimiteDisp]=useState(appState.limiteDisparoDiario||20);
  const defaultCFG:DREConfig={modelo:"investidor",pctEspaco:50,pctImposto:7,pctApp:7,fixoInternet:260,fixoAluguel:0,energiaTipo:"incluido",energiaKwh:0,usinaFixo:208.37,invNome:"FL BR SOLUÇÕES SUSTENTÁVEIS LTDA",invPct:50,invTotal:150000,invPago:100000,invDividaPrio:14705.39,invAmort:1846.49,propriaInstalacao:100000,propriaAmort:0,solarProprio:false,custoParceiro:0.80};
  const dreDefaults:Record<string,Partial<DREConfig>>={
    costa:{modelo:"investidor",pctEspaco:50,invNome:"FL BR SOLUÇÕES SUSTENTÁVEIS LTDA",invPct:50,invTotal:150000,invPago:100000,solarProprio:true,custoParceiro:0.80},
    parkway:{modelo:"propria",pctEspaco:0,propriaInstalacao:100000,custoParceiro:0.80},
    cidadeauto:{modelo:"propria",pctEspaco:0,propriaInstalacao:100000,custoParceiro:0.80},
    mamute:{modelo:"investidor",pctEspaco:50,custoParceiro:0.80},
    madeiro_sia:{modelo:"investidor",pctEspaco:50,custoParceiro:0.80},
    madeiro_sp:{modelo:"investidor",pctEspaco:50,custoParceiro:0.80},
  };
  const[cfg,setCfg]=useState<DREConfig>({...defaultCFG,...(dreDefaults[dreStation]||{}),...(appState.dreConfigs[dreStation]||{})});
  // Auto-save DRE com debounce 2s
  useEffect(()=>{
    if(autoSaveRef.current)clearTimeout(autoSaveRef.current);
    autoSaveRef.current=setTimeout(()=>{
      onSave({dreConfigs:{...appState.dreConfigs,[dreStation]:cfg}});
      setDreSaved(true);setTimeout(()=>setDreSaved(false),2000);
    },2000);
    return()=>{if(autoSaveRef.current)clearTimeout(autoSaveRef.current);};
  },[cfg]);
  useEffect(()=>{setCfg({...defaultCFG,...(dreDefaults[dreStation]||{}),...(appState.dreConfigs[dreStation]||{})});},[dreStation]);
  const[cupons,setCupons]=useState<CupomRegistro[]>(appState.cupons||[]);
  const[novoCupom,setNovoCupom]=useState<CupomRegistro>({usuario:"",motivo:"",validade:"",estacao:""});
  const[cupomSaved,setCupomSaved]=useState(false);
  const[estacoesCustom,setEstacoesCustom]=useState<EstacaoCustom[]>(appState.estacoesCustom||[]);
  const[novaEstacao,setNovaEstacao]=useState<EstacaoCustom>({key:"",nome:"",tipo:"propria",ativa:true});
  const[estacaoSaved,setEstacaoSaved]=useState(false);
  const handleContactUpload=async(file:File)=>{
    try{const text=await file.text();const dados=parseContatos(text);const estacaoKey=detectEstacao(file.name,dados);const comTel=dados.filter(d=>d.telefone).length;const updated:Contatos={...appState.contatos,[estacaoKey]:{importadoEm:new Date().toISOString(),total:dados.length,comTelefone:comTel,dados}};onSave({contatos:updated});setUploadStatus(`✅ ${dados.length} usuários · ${comTel} tel · ${hubNome(estacaoKey)}`);}
    catch(e){setUploadStatus(`❌ Erro: ${(e as Error).message}`);}
  };
  const testarZapi=async()=>{setZapiTesting(true);setZapiTestResult("");try{const r=await fetch("/api/zapi");const d=await r.json();setZapiTestResult(d.connected?"✅ Conectada":d.configured?"⚠️ Desconectada":"❌ Não configurada");}catch{setZapiTestResult("❌ Erro de conexão");}setZapiTesting(false);};
  const exportarBackup=()=>{const data=JSON.stringify(appState,null,2);const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`hertzgo-backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.json`;a.click();URL.revokeObjectURL(url);};
  const importRefConfig=useRef<HTMLInputElement>(null);
  const[importMsg,setImportMsg]=useState<{ok:boolean;text:string}|null>(null);
  const importarBackup=(file:File)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{const json=JSON.parse(e.target?.result as string) as AppState;if(!json.mensagens&&!json.dreConfigs&&!json.contatos)throw new Error("Não é um backup HertzGo");onSave(json);setImportMsg({ok:true,text:"✅ Backup importado!"});setTimeout(()=>setImportMsg(null),3000);}
      catch(err){setImportMsg({ok:false,text:"❌ "+(err as Error).message});setTimeout(()=>setImportMsg(null),4000);}
    };
    reader.readAsText(file);
  };
  const inp=(id:keyof DREConfig,label:string,type:"number"|"text"|"select",opts?:string[])=>(
    <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>{label}</div>{type==="select"?(<select value={cfg[id] as string} onChange={e=>setCfg(p=>({...p,[id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"8px 10px",borderRadius:8,fontSize:13,fontFamily:T.mono}}>{opts?.map(o=><option key={o} value={o}>{o}</option>)}</select>):(<input type={type} min={0} value={cfg[id] as string|number} onChange={e=>setCfg(p=>({...p,[id]:type==="number"?+e.target.value:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"8px 10px",borderRadius:8,fontSize:13,fontFamily:T.mono}}/>)}</div>
  );
  const msgFields:[keyof Mensagens,string][]=[
    ["msg1","📤 MSG 1 — Qualificação"],["msg2a_parkway","🟢 MSG 2A — Motorista → Park Way"],["msg2a_cidadeauto","🟢 MSG 2A — Motorista → Cidade Auto"],
    ["msg2a_vip_parkway","🏆 MSG VIP — Park Way"],["msg2a_vip_cidadeauto","🏆 MSG VIP — Cidade Auto"],
    ["msg2b_costa","🛒 MSG 2B — Costa"],["msg2b_parkway","💚 MSG 2B — Park Way"],["msg2b_cidadeauto","💚 MSG 2B — Cidade Auto"],
    ["msg_boasvindas_rede","🌱 Boas-vindas — 1ª vez na rede"],["msg_boasvindas_estacao","📍 Boas-vindas — 1ª vez na estação"],
    ["msg_risco","🟠 MSG Risco"],["msg_churn","🔴 MSG Churn"],
    ["cupom_parkway","🎟️ Cupom Park Way"],["cupom_cidadeauto","🎟️ Cupom Cidade Auto"],["cupom_costa","🎟️ Cupom Costa"],["cupom_vip","🎟️ Cupom VIP"],
  ];
  const estacoesDRE=[
    {key:"costa",nome:"Costa",tipo:"Parceria"},{key:"parkway",nome:"Park Way",tipo:"Própria"},
    {key:"cidadeauto",nome:"Cidade Auto",tipo:"Própria"},{key:"mamute",nome:"Mamute",tipo:"Contratual"},
    {key:"madeiro_sia",nome:"Madeiro SIA",tipo:"Contratual"},{key:"madeiro_sp",nome:"Madeiro SP",tipo:"Contratual"},
    ...estacoesCustom.map(e=>({key:e.key,nome:e.nome,tipo:e.tipo})),
  ];
  const pad=isMobile?"16px 14px":"24px 28px";
  const navSections=[["contatos","📱 Contatos"],["mensagens","✉️ Msgs"],["dre","💼 DRE"],["cupons","🎟️ Cupons"],["estacoes","🏪 Estações"],["zapi","🔌 Z-API"]] as [string,string][];
  return(
    <div style={{padding:pad}}>
      {/* Nav + botões backup — scroll horizontal */}
      <div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch",alignItems:"center"}}>
        {navSections.map(([id,label])=>(
          <button key={id} onClick={()=>setActiveSection(id as typeof activeSection)} style={{padding:"7px 12px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeSection===id?T.green:T.border}`,background:activeSection===id?T.greenDim:"transparent",color:activeSection===id?T.green:T.text2,whiteSpace:"nowrap",flexShrink:0}}>{label}</button>
        ))}
        <div style={{display:"flex",gap:8,marginLeft:"auto",flexShrink:0}}>
          {importMsg&&<span style={{fontFamily:T.mono,fontSize:11,color:importMsg.ok?T.green:T.red,whiteSpace:"nowrap"}}>{importMsg.text}</span>}
          <button onClick={()=>importRefConfig.current?.click()} style={{padding:"7px 12px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:"1px solid rgba(0,229,160,0.3)",background:"rgba(0,229,160,0.08)",color:T.green,whiteSpace:"nowrap"}}>⬆️ Importar</button>
          <input ref={importRefConfig} type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])importarBackup(e.target.files[0]);e.target.value="";}}/>
          <button onClick={exportarBackup} style={{padding:"7px 12px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:"1px solid rgba(59,130,246,0.3)",background:"rgba(59,130,246,0.08)",color:"#60a5fa",whiteSpace:"nowrap"}}>⬇️ Exportar</button>
        </div>
      </div>

      {/* CONTATOS */}
      {activeSection==="contatos"&&(
        <>
          {/* BASE MESTRE */}
          <div style={{background:"rgba(0,229,160,0.06)",border:"1px solid rgba(0,229,160,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.green,marginBottom:6}}>🗃️ Base Mestre de Usuários</div>
            <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,marginBottom:10,lineHeight:1.6}}>
              CSV exportado da Spott (aba Usuários → Exportar CSV). Importar 1x/mês.<br/>
              {Object.keys(appState.baseMestre).length > 0 && (
                <span style={{color:T.green}}>✅ {Object.keys(appState.baseMestre).length} usuários · {Object.values(appState.baseMestre).filter(u=>u.temTel).length} com telefone</span>
              )}
            </div>
            <input
              type="file" accept=".csv,.txt" style={{display:"none"}}
              ref={baseMestreRef}
              onChange={async e=>{
                const file=e.target.files?.[0];if(!file)return;
                try{
                  const text=await file.text();
                  const base=parseBaseMestre(text);
                  onSave({baseMestre:base});
                  setUploadStatus(`✅ Base mestre: ${Object.keys(base).length} usuários · ${Object.values(base).filter(u=>u.temTel).length} com telefone`);
                }catch(err){setUploadStatus(`❌ ${(err as Error).message}`);}
                e.target.value="";
              }}
            />
            <button onClick={()=>baseMestreRef.current?.click()} style={{background:T.greenDim,border:"1px solid rgba(0,229,160,0.3)",color:T.green,padding:"8px 20px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono,fontWeight:600}}>
              ⬆️ Importar Base Mestre (Spott CSV)
            </button>
          </div>
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11,color:"#93c5fd",marginBottom:16}}>ℹ️ Importe também o CSV de contatos por estação. Estação detectada automaticamente.</div>
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:10}}>📂</div>
            <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text,marginBottom:5}}>Importar CSV de Contatos por Estação</div>
            <input ref={inputRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleContactUpload(e.target.files[0]);}}/>
            <button onClick={()=>inputRef.current?.click()} style={{background:T.greenDim,border:"1px solid rgba(0,229,160,0.3)",color:T.green,padding:"10px 24px",borderRadius:10,fontSize:13,cursor:"pointer",fontFamily:T.sans,fontWeight:600}}>Selecionar CSV</button>
            {uploadStatus&&<div style={{marginTop:12,fontFamily:T.mono,fontSize:11,color:uploadStatus.startsWith("✅")?T.green:T.red}}>{uploadStatus}</div>}
          </div>
          {Object.keys(appState.contatos).length>0&&(<><SectionLabel>Importados</SectionLabel><div style={{display:"grid",gap:8}}>{Object.entries(appState.contatos).map(([key,c])=>(<div key={key} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}><div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{hubNome(key)}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{c.total} usuários · {c.comTelefone} tel · {new Date(c.importadoEm).toLocaleDateString("pt-BR")}</div></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{height:5,width:60,background:T.bg3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${c.total>0?(c.comTelefone/c.total*100).toFixed(0):0}%`,background:T.green,borderRadius:3}}/></div><span style={{fontFamily:T.mono,fontSize:10,color:T.green}}>{c.total>0?(c.comTelefone/c.total*100).toFixed(0):0}%</span></div></div>))}</div></>)}
        </>
      )}

      {/* MENSAGENS */}
      {activeSection==="mensagens"&&(
        <>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11,color:"#fcd34d",marginBottom:16}}>ℹ️ Use [nome], [local], [cupom] e [beneficio].</div>
          {msgFields.map(([key,label])=>(<div key={key} style={{marginBottom:14}}><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:5}}>{label}</div><textarea value={msgs[key]} onChange={e=>setMsgs(p=>({...p,[key]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"10px 12px",borderRadius:10,fontSize:12,fontFamily:T.mono,resize:"vertical",minHeight:key.startsWith("cupom")?38:76,lineHeight:1.6,boxSizing:"border-box"}}/></div>))}
          <button onClick={()=>{onSave({mensagens:msgs});setMsgSaved(true);setTimeout(()=>setMsgSaved(false),2000);}} style={{background:msgSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${msgSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"10px 20px",borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:T.mono,width:"100%"}}>{msgSaved?"✅ Salvas!":"💾 Salvar Mensagens"}</button>
        </>
      )}

      {/* DRE CONFIG */}
      {activeSection==="dre"&&(
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {estacoesDRE.map(e=>(<button key={e.key} onClick={()=>setDreStation(e.key)} style={{padding:"6px 12px",borderRadius:8,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${dreStation===e.key?T.green:T.border}`,background:dreStation===e.key?T.greenDim:"transparent",color:dreStation===e.key?T.green:T.text2}}>{e.nome}</button>))}
          </div>
          <Panel>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>{hubNome(dreStation)}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:T.mono,fontSize:10,color:dreSaved?T.green:T.text3}}>{dreSaved?"✅ Salvo automaticamente":""}</span>
                <button onClick={()=>{onSave({dreConfigs:{...appState.dreConfigs,[dreStation]:cfg}});setDreSaved(true);setTimeout(()=>setDreSaved(false),2000);}} style={{background:dreSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${dreSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{dreSaved?"✅":"💾 Salvar"}</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:12}}>
              {inp("modelo","Modelo","select",["investidor","propria"])}{inp("pctEspaco","% Parceiro Espaço","number")}{inp("pctImposto","% Imposto","number")}
              {inp("pctApp","% App","number")}{inp("fixoInternet","Internet/Adm (R$)","number")}{inp("fixoAluguel","Aluguel (R$)","number")}
              {inp("energiaTipo","Custo Energia","select",["incluido","kwh","usina"])}{cfg.energiaTipo==="kwh"&&inp("energiaKwh","R$/kWh","number")}{cfg.energiaTipo==="usina"&&inp("usinaFixo","Custo Usina R$","number")}
              {inp("custoParceiro","R$/kWh Parceiro","number")}
            </div>
            {cfg.modelo==="investidor"&&(<><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"12px 0 10px",borderTop:`1px solid ${T.border}`,paddingTop:12}}>Investidor</div><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>{inp("invNome","Nome Investidor","text")}{inp("invPct","% do LL","number")}{inp("invTotal","Total Investido","number")}{inp("invPago","Já Integralizado","number")}{inp("invDividaPrio","Dívida Prioritária","number")}{inp("invAmort","Já Amortizado","number")}</div></>)}
            {cfg.modelo==="propria"&&(<><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"12px 0 10px",borderTop:`1px solid ${T.border}`,paddingTop:12}}>Loja Própria</div><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>{inp("propriaInstalacao","Custo Instalação","number")}{inp("propriaAmort","Já Amortizado","number")}</div></>)}
            <label style={{display:"flex",alignItems:"center",gap:8,marginTop:14,cursor:"pointer",fontFamily:T.mono,fontSize:11,color:T.text2}}><input type="checkbox" checked={cfg.solarProprio} onChange={e=>setCfg(p=>({...p,solarProprio:e.target.checked}))} style={{accentColor:"#ffd600",width:14,height:14}}/>☀️ Usina Solar (energia = R$0)</label>
          </Panel>

          {/* TABELA DE PAYBACK LINHA A LINHA */}
          {cfg.modelo==="investidor"&&(()=>{
            const diasNoMes=30;
            const retMensalBruto=cfg.invPct>0?1:0; // placeholder para estrutura
            // Calcular retorno mensal baseado nos valores configurados
            // Usamos os valores do DRE Config diretamente
            const invTotal=cfg.invTotal||0;
            const invPago=cfg.invPago||0;
            const invDividaPrio=cfg.invDividaPrio||0;
            const invAmort=cfg.invAmort||0;
            const invPct=cfg.invPct||50;
            // Projeção baseada em retorno mensal médio — usa o retorno atual se disponível
            // Como não temos sessions aqui, mostramos a estrutura de amortização
            const totalDevido=invDividaPrio+Math.max(0,invTotal-invPago);
            const jaAmort=invAmort;
            const falta=Math.max(0,totalDevido-jaAmort);
            // Gerar linhas de payback mês a mês (simulação baseada em retorno estimado)
            // Retorno estimado: usuário preenche "retorno mensal estimado" ou calculamos
            const [retMensal,setRetMensal]=useState(0);
            const linhas=[];
            if(retMensal>0&&falta>0){
              let saldo=falta;
              let mes=1;
              let amortAcum=jaAmort;
              while(saldo>0&&mes<=120){
                const amortMes=Math.min(retMensal,saldo);
                amortAcum+=amortMes;
                saldo-=amortMes;
                const pct=totalDevido>0?(amortAcum/totalDevido)*100:0;
                linhas.push({mes,amortMes,amortAcum,saldo:Math.max(0,saldo),pct});
                mes++;
              }
            }
            return(
              <Panel style={{marginTop:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                  <div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>📅 Projeção de Payback — Mês a Mês</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:2}}>Dívida total: {brl(totalDevido)} · Já amortizado: {brl(jaAmort)} · Saldo: {brl(falta)}</div></div>
                </div>
                {/* Barra de progresso geral */}
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:5}}>
                    <span>Amortização atual</span>
                    <span style={{color:T.green,fontWeight:600}}>{totalDevido>0?((jaAmort/totalDevido)*100).toFixed(1):0}%</span>
                  </div>
                  <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden",border:`1px solid ${T.border}`}}>
                    <div style={{height:"100%",width:`${totalDevido>0?Math.min(100,(jaAmort/totalDevido)*100):0}%`,background:T.green,borderRadius:3}}/>
                  </div>
                </div>
                {/* Input retorno mensal */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:T.bg3,borderRadius:10,border:`1px solid ${T.border}`}}>
                  <span style={{fontFamily:T.mono,fontSize:11,color:T.text2,whiteSpace:"nowrap"}}>💰 Retorno mensal ao investidor (R$):</span>
                  <input type="number" min={0} value={retMensal||""} placeholder="Ex: 3500" onChange={e=>setRetMensal(+e.target.value||0)} style={{flex:1,background:"transparent",border:"none",color:T.amber,fontFamily:T.mono,fontSize:13,fontWeight:600,outline:"none"}}/>
                </div>
                {retMensal<=0&&(
                  <div style={{fontFamily:T.mono,fontSize:11,color:T.text3,textAlign:"center",padding:"16px 0"}}>
                    ℹ️ Insira o retorno mensal estimado para ver a projeção mês a mês
                  </div>
                )}
                {retMensal>0&&linhas.length>0&&(
                  <>
                    <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>
                      Payback completo em <span style={{color:T.green,fontWeight:700}}>{linhas.length} {linhas.length===1?"mês":"meses"}</span> · {(linhas.length/12).toFixed(1)} anos
                    </div>
                    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",maxHeight:320,overflowY:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?360:undefined}}>
                        <thead style={{position:"sticky",top:0,background:T.bg2}}>
                          <tr>
                            <th style={TH}>Mês</th>
                            <th style={THR}>Retorno</th>
                            <th style={THR}>Amort. Acum.</th>
                            <th style={THR}>Saldo Dev.</th>
                            <th style={THR}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map((l,i)=>{
                            const isQuitado=l.saldo===0;
                            const isMarcante=l.mes%6===0||isQuitado;
                            return(
                              <tr key={l.mes} style={{background:isQuitado?"rgba(0,229,160,0.08)":isMarcante?"rgba(255,255,255,0.02)":""}}>
                                <td style={{...TD,color:isMarcante?T.text:T.text2,fontWeight:isMarcante?700:400}}>
                                  {isQuitado?"✅ ":""}{l.mes}
                                </td>
                                <td style={{...TDR,color:T.amber}}>{brl(l.amortMes)}</td>
                                <td style={{...TDR,color:T.green}}>{brl(l.amortAcum)}</td>
                                <td style={{...TDR,color:l.saldo===0?T.green:T.red}}>{l.saldo===0?"Quitado":brl(l.saldo)}</td>
                                <td style={{...TDR,color:T.text2,fontSize:10}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                                    <div style={{width:32,height:4,background:T.bg3,borderRadius:2,overflow:"hidden"}}>
                                      <div style={{height:"100%",width:`${l.pct}%`,background:l.pct>=100?T.green:T.amber,borderRadius:2}}/>
                                    </div>
                                    {l.pct.toFixed(0)}%
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {retMensal>0&&falta===0&&(
                  <div style={{background:"rgba(0,229,160,0.08)",border:"1px solid rgba(0,229,160,0.25)",borderRadius:10,padding:"14px 16px",fontFamily:T.mono,fontSize:12,color:T.green,textAlign:"center"}}>
                    ✅ Investimento já quitado! Saldo devedor: R$ 0,00
                  </div>
                )}
              </Panel>
            );
          })()}
        </>
      )}

      {/* CUPONS */}
      {activeSection==="cupons"&&(
        <>
          <Panel style={{marginBottom:14}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>➕ Adicionar Cupom</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8,marginBottom:10}}>
              {[{id:"usuario",label:"Usuário"},{id:"motivo",label:"Motivo"},{id:"validade",label:"Validade"},{id:"estacao",label:"Estação"}].map(f=>(<div key={f.id}><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:3}}>{f.label}</div><input value={novoCupom[f.id as keyof CupomRegistro]} onChange={e=>setNovoCupom(p=>({...p,[f.id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"7px 9px",borderRadius:8,fontSize:13,fontFamily:T.mono,boxSizing:"border-box"}}/></div>))}
            </div>
            <button onClick={()=>{if(!novoCupom.usuario)return;const updated=[...cupons,novoCupom];setCupons(updated);onSave({cupons:updated});setNovoCupom({usuario:"",motivo:"",validade:"",estacao:""});setCupomSaved(true);setTimeout(()=>setCupomSaved(false),1500);}} style={{background:cupomSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${cupomSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{cupomSaved?"✅ Adicionado!":"➕ Adicionar"}</button>
          </Panel>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.bg2,borderRadius:16,overflow:"hidden",minWidth:isMobile?340:undefined}}>
              <thead><tr><th style={TH}>Usuário</th><th style={TH}>Motivo</th><th style={TH}>Validade</th><th style={TH}>Status</th><th style={THR}></th></tr></thead>
              <tbody>
                {cupons.length===0&&<tr><td colSpan={5} style={{...TD,textAlign:"center",color:T.text3,padding:"16px"}}>Nenhum cupom</td></tr>}
                {cupons.map((c,i)=>{const vencido=c.validade&&new Date(c.validade)<new Date();return(<tr key={i}><td style={TD}>{trunc(c.usuario,isMobile?14:20)}</td><td style={{...TD,fontSize:11,color:T.text2}}>{c.motivo||"—"}</td><td style={{...TD,fontSize:11,fontFamily:T.mono,color:vencido?T.red:T.green}}>{c.validade||"—"}</td><td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 7px",borderRadius:4,background:vencido?"rgba(239,68,68,0.15)":"rgba(0,229,160,0.15)",color:vencido?T.red:T.green}}>{vencido?"⚠️":"✅"}</span></td><td style={TDR}><button onClick={()=>{const updated=cupons.filter((_,j)=>j!==i);setCupons(updated);onSave({cupons:updated});}} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:T.red,padding:"3px 9px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:T.mono}}>×</button></td></tr>);})}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ESTAÇÕES */}
      {activeSection==="estacoes"&&(
        <>
          <Panel style={{marginBottom:14}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>➕ Nova Estação</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr auto",gap:8,marginBottom:10,alignItems:"end"}}>
              <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:3}}>Nome</div><input value={novaEstacao.nome} onChange={e=>setNovaEstacao(p=>({...p,nome:e.target.value,key:e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"_")}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"7px 9px",borderRadius:8,fontSize:13,fontFamily:T.mono,boxSizing:"border-box"}} placeholder="Ex: Park Way Norte"/></div>
              <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:3}}>Tipo</div><select value={novaEstacao.tipo} onChange={e=>setNovaEstacao(p=>({...p,tipo:e.target.value as EstacaoCustom["tipo"]}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"7px 9px",borderRadius:8,fontSize:13,fontFamily:T.mono}}><option value="propria">Própria</option><option value="parceria">Parceria</option><option value="contratual">Contratual</option></select></div>
              <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:3}}>Key (auto)</div><input value={novaEstacao.key} readOnly style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text3,padding:"7px 9px",borderRadius:8,fontSize:12,fontFamily:T.mono,boxSizing:"border-box"}}/></div>
              <button onClick={()=>{if(!novaEstacao.nome||!novaEstacao.key)return;const updated=[...estacoesCustom,novaEstacao];setEstacoesCustom(updated);onSave({estacoesCustom:updated});setNovaEstacao({key:"",nome:"",tipo:"propria",ativa:true});setEstacaoSaved(true);setTimeout(()=>setEstacaoSaved(false),1500);}} style={{background:estacaoSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${estacaoSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 14px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono,whiteSpace:"nowrap"}}>{estacaoSaved?"✅":"➕ Add"}</button>
            </div>
          </Panel>
          <SectionLabel>Estações Padrão</SectionLabel>
          <div style={{display:"grid",gap:8}}>
            {[{key:"costa",nome:"Costa Atacadão",tipo:"Parceria"},{key:"parkway",nome:"Park Way",tipo:"Própria"},{key:"cidadeauto",nome:"Cidade do Automóvel",tipo:"Própria"},{key:"mamute",nome:"Lava Jato do Mamute",tipo:"Contratual"},{key:"madeiro_sia",nome:"Madeiro & Jerônimo SIA",tipo:"Contratual"},{key:"madeiro_sp",nome:"Madeiro & Jerônimo SP",tipo:"Contratual"}].map(e=>(
              <div key={e.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px"}}><div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{e.nome}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{e.key}</div></div><span style={{fontFamily:T.mono,fontSize:9,padding:"2px 8px",borderRadius:4,background:"rgba(255,255,255,0.05)",color:T.text3}}>Padrão</span></div>
            ))}
          </div>
          {estacoesCustom.length>0&&(<><SectionLabel>Customizadas</SectionLabel><div style={{display:"grid",gap:8}}>{estacoesCustom.map((e,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px"}}><div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{e.nome}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{e.key}</div></div><button onClick={()=>{const updated=estacoesCustom.filter((_,j)=>j!==i);setEstacoesCustom(updated);onSave({estacoesCustom:updated});}} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:T.red,padding:"3px 9px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:T.mono}}>×</button></div>))}</div></>)}
        </>
      )}

      {/* Z-API */}
      {activeSection==="zapi"&&(
        <Panel>
          <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,marginBottom:14,color:T.text}}>📱 Z-API — WhatsApp</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10,marginBottom:14}}>
            {([{id:"instanceId" as keyof ZAPIConfig,label:"ID da Instância",placeholder:"Ex: 3DF217DC18D..."},{id:"token" as keyof ZAPIConfig,label:"Token",placeholder:"Token..."},{id:"clientToken" as keyof ZAPIConfig,label:"Client-Token",placeholder:"Client-Token..."}] as {id:keyof ZAPIConfig;label:string;placeholder:string}[]).map(f=>(<div key={f.id}><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>{f.label}</div><input type={f.id==="instanceId"?"text":"password"} value={zapi[f.id]} placeholder={f.placeholder} onChange={e=>setZapi(p=>({...p,[f.id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"8px 10px",borderRadius:8,fontSize:13,fontFamily:T.mono,boxSizing:"border-box"}}/></div>))}
          </div>
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            <button onClick={()=>{onSave({zapi});setZapiSaved(true);setTimeout(()=>setZapiSaved(false),2000);}} style={{background:zapiSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${zapiSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"9px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{zapiSaved?"✅ Salvas!":"💾 Salvar"}</button>
            <button onClick={testarZapi} disabled={zapiTesting} style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",color:"#60a5fa",padding:"9px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{zapiTesting?"⏳ Testando...":"🔌 Testar"}</button>
          </div>
          {zapiTestResult&&(<div style={{fontFamily:T.mono,fontSize:12,color:zapiTestResult.startsWith("✅")?T.green:zapiTestResult.startsWith("⚠️")?T.amber:T.red,padding:"10px 12px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:14}}>{zapiTestResult}</div>)}
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"10px 12px",fontFamily:T.mono,fontSize:11,color:"#93c5fd"}}>ℹ️ Configure também as variáveis de ambiente no Vercel para maior segurança.</div>
          <div style={{marginTop:14,padding:"14px 16px",background:T.bg3,borderRadius:10,border:`1px solid ${T.border}`}}>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:10}}>📊 Configurações de Disparo Automático</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:8,marginBottom:10}}>
              {[
                {label:"Limite/dia",key:"limiteDisparoDiario",val:limiteDisp,set:setLimiteDisp,min:1,max:100},
                {label:"Início (h)",key:"crm_inicio",val:appState.metas["crm_inicio"]||9,set:(v:number)=>onSave({metas:{...appState.metas,crm_inicio:v}}),min:6,max:12},
                {label:"Fim (h)",key:"crm_fim",val:appState.metas["crm_fim"]||18,set:(v:number)=>onSave({metas:{...appState.metas,crm_fim:v}}),min:14,max:22},
                {label:"Intervalo mín (min)",key:"crm_intervalo_min",val:appState.metas["crm_intervalo_min"]||15,set:(v:number)=>onSave({metas:{...appState.metas,crm_intervalo_min:v}}),min:5,max:60},
                {label:"Intervalo máx (min)",key:"crm_intervalo_max",val:appState.metas["crm_intervalo_max"]||45,set:(v:number)=>onSave({metas:{...appState.metas,crm_intervalo_max:v}}),min:10,max:120},
              ].map(f=>(
                <div key={f.key}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginBottom:4}}>{f.label}</div>
                  <input type="number" min={f.min} max={f.max} value={f.val}
                    onChange={e=>{
                      const v=+e.target.value||f.min;
                      if(f.key==="limiteDisparoDiario"){setLimiteDisp(v);onSave({limiteDisparoDiario:v});}
                      else f.set(v);
                    }}
                    style={{width:"100%",background:T.bg2,border:`1px solid ${T.border}`,color:T.text,padding:"7px 8px",borderRadius:8,fontSize:13,fontFamily:T.mono,textAlign:"center" as const,boxSizing:"border-box" as const}}
                  />
                </div>
              ))}
            </div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>
              ⚡ Exemplo: 20 msgs · 09h–18h · 15–45 min = última mensagem ~{Math.round((20*30)/60)}h após início
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── TAB RELATÓRIOS ───────────────────────────────────────────────────────────
// (mantém todo o CSS e lógica de geração HTML — apenas o layout da aba é responsivo)
const LOGO_URL_REL="data:image/png;base64,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0zMeKzrlscU4iJ0idoX/T9942jH0IrBKY1Bob1AOtCpKZqtYFRWSgJq33H1qhlHv+IsP/z/w/PNw9hz+6lXyxXkSrWgoCjEmy7BZTr/fpdvtkdkcE9/+J08URZsq7VlrWV1dpdFoMDMzw7lz53j22Wf5wR/8QV7/+tf7RqPBK17xCgUciwGS/bK1euvW/73uda/zp06d8r//+79fCjJaa65evVpWc63X61y+fJnZ2dnSdmFycvLYRPgeJqrVau36pAsdjO1G+L33tNttBoOB6nQ6xHFcdhrb7fYNdSD328lut9s0m83yBErTlFarRbfbZXZ21p/0Rlyo4d5qtVhdXeX7vu/7+OxnP6uiKCojlbaah26d7sZejeydQtwCWZaVjTKllG82m8RxzPr6OiMjIweeJradeWp1tHe/589ev/fe02w2WVhYwHvPvffey4c+9CEefvhhNT09Tb/fp1arvaRTEo5r8FoII8khBTCk41QbuCHKJHSibkQgCA+u7/Z7oUMVjm8w5g4CaDDystby27/92/7f/tt/y2OPPQbAxMRE6Vu01/1hv8dnvw39TqfDK17xCi5dukQURczMzHDp0iV+8zd/k3/4D/+h2uv83Wvf7rV9e80/eCo550KYqB8bG2NpaYngj3WQHPT1ddTZ6/zqdrv863/9r3nPe96jqpW+BoMB/X6fZrNZCh7hWAdRLTybt4of1Xv6dpWuqmxXinzr58HfRSlVprQtLy8zNTXl93rG77X93ntGR0e5fv06MzMzPP3008o5x9TUFO12m1qttm0KVJiGaK6q6FMVf8L9Zi9xcafn1F7n534/32v/7HX/eznP3+9m/ns9I/aav1KKKIpYWVmhXq+X9xullFdKMTIysul+sHW6XfvkVj6fq/vnJeuhIHe6KE0MFGVsCu+XyBVmubUopjsY4HUCSZ1unoLStO6+mzte+3ru/+F38sUXX2C9oYgnJ1hrt4md4XQ0Qrq4xuTIBH2fskxKhxSrHUZpGk4RK4N1sNs46n62D27s+L7c+bvh57tFYex1fmt384S67bZ/t+erG3735UaRRA7i1BUDS7WYts/o2rw4saxC545mFEFuCwFGK6zP0SjGRpqcG2lw5atf5MXHvgzPfAcyC0pDr0eUZowlMSrLhqWlwWlHpotorSDcaWtuSinz40qaply4cIHvfOc7zMzMsL6+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";
const FLBR_CSS=`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');:root{--bg:#080b10;--bg2:#0d1117;--bg3:#111820;--border:#1a2333;--border2:#243040;--text1:#e8f0f8;--text2:#7a94b0;--text3:#3d5268;--green:#00e676;--teal:#00bcd4;--amber:#ffab00;--red:#ff5252;--blue:#448aff;--purple:#7c4dff;--font:'Syne',sans-serif;--mono:'DM Mono',monospace;}*{margin:0;padding:0;box-sizing:border-box;}html{font-size:14px;background:var(--bg);-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{font-family:var(--font);color:var(--text1);overflow-x:hidden;}.print-btn{position:fixed;bottom:28px;right:28px;z-index:999;background:var(--green);color:#000;border:none;padding:12px 22px;border-radius:8px;font-family:var(--font);font-weight:700;font-size:13px;cursor:pointer;}@media print{.print-btn{display:none!important;}}.cover{min-height:100vh;background:radial-gradient(ellipse 80% 60% at 60% 40%,rgba(0,188,212,.06) 0%,transparent 60%),var(--bg);display:flex;flex-direction:column;justify-content:space-between;padding:56px 64px;border-bottom:1px solid var(--border);}.cover-top{display:flex;justify-content:space-between;align-items:flex-start;}.logo-block img{height:48px;display:block;margin-bottom:8px;background:transparent;}.logo-sub{font-size:10px;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;font-family:var(--mono);}.badge-conf{background:rgba(255,82,82,.12);border:1px solid rgba(255,82,82,.25);color:#ff8a80;font-size:9px;font-family:var(--mono);letter-spacing:.12em;padding:4px 10px;border-radius:4px;text-transform:uppercase;}.cover-main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px 0 40px;}.cover-eyebrow{font-size:10px;font-family:var(--mono);color:var(--teal);letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px;}.cover-title{font-size:clamp(52px,7vw,88px);font-weight:800;line-height:.95;letter-spacing:-.03em;margin-bottom:8px;}.cover-title .accent{color:var(--green);display:block;}.cover-line{width:64px;height:3px;background:linear-gradient(90deg,var(--green),var(--teal));border-radius:2px;margin:24px 0;}.cover-sub{font-size:16px;color:var(--text2);font-weight:400;}.cover-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:12px;overflow:hidden;margin-top:auto;}.ckpi{background:var(--bg2);padding:24px 20px;position:relative;}.ckpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}.ckpi.g::before{background:var(--green);}.ckpi.t::before{background:var(--teal);}.ckpi.a::before{background:var(--amber);}.ckpi.p::before{background:var(--purple);}.ckpi-val{font-size:28px;font-weight:800;font-family:var(--mono);line-height:1;margin-bottom:4px;}.ckpi.g .ckpi-val{color:var(--green);}.ckpi.t .ckpi-val{color:var(--teal);}.ckpi.a .ckpi-val{color:var(--amber);}.ckpi.p .ckpi-val{color:var(--purple);}.ckpi-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--mono);}.ckpi-sub{font-size:11px;color:var(--text2);margin-top:6px;font-family:var(--mono);}.cover-bottom{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;}.cover-dest{font-size:11px;color:var(--text3);}.cover-dest strong{color:var(--text1);display:block;font-size:14px;margin-top:2px;}.cover-period{font-family:var(--mono);font-size:11px;color:var(--text2);text-align:right;}.section{padding:64px;border-bottom:1px solid var(--border);}.section:nth-child(even){background:var(--bg2);}.section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:16px;}.section-title{font-size:11px;font-family:var(--mono);color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px;}.section-h2{font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1.1;}.section-tag{font-size:10px;font-family:var(--mono);padding:4px 12px;border-radius:20px;letter-spacing:.08em;text-transform:uppercase;border:1px solid;}.tag-green{color:var(--green);border-color:rgba(0,230,118,.3);background:rgba(0,230,118,.06);}.tag-amber{color:var(--amber);border-color:rgba(255,171,0,.3);background:rgba(255,171,0,.06);}.tag-teal{color:var(--teal);border-color:rgba(0,188,212,.3);background:rgba(0,188,212,.06);}.tag-red{color:var(--red);border-color:rgba(255,82,82,.3);background:rgba(255,82,82,.06);}.kpi-grid{display:grid;gap:1px;background:var(--border);border-radius:12px;overflow:hidden;}.kpi-grid.cols4{grid-template-columns:repeat(4,1fr);}.kpi-grid.cols3{grid-template-columns:repeat(3,1fr);}.kpi-grid.cols2{grid-template-columns:repeat(2,1fr);}.kpi{background:var(--bg3);padding:28px 24px;position:relative;}.kpi-icon{font-size:20px;margin-bottom:12px;}.kpi-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--mono);margin-bottom:8px;}.kpi-val{font-size:30px;font-weight:800;font-family:var(--mono);line-height:1;margin-bottom:4px;}.kpi-detail{font-size:11px;color:var(--text2);font-family:var(--mono);}.kpi-bar{height:2px;border-radius:1px;margin-top:14px;background:var(--border2);}.kpi-bar-fill{height:100%;border-radius:1px;}.dre{display:grid;grid-template-columns:1fr 1fr;gap:32px;}.dre-table{background:var(--bg3);border-radius:12px;overflow:hidden;border:1px solid var(--border);}.dre-row{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid var(--border);}.dre-row:last-child{border-bottom:none;}.dre-row.result{background:rgba(0,230,118,.06);border-top:1px solid rgba(0,230,118,.2);}.dre-row.result .dre-lbl{color:var(--text1);font-weight:700;}.dre-lbl{font-size:13px;color:var(--text2);}.dre-lbl.main{color:var(--text1);font-weight:600;}.dre-val{font-family:var(--mono);font-size:14px;color:var(--text1);}.dre-val.neg{color:var(--red);}.dre-val.pos{color:var(--green);}.dre-row.result .dre-val{color:var(--green);font-size:20px;}.dist-box{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:28px;display:flex;flex-direction:column;gap:20px;}.dist-title{font-size:11px;font-family:var(--mono);color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:4px;}.dist-card{border-radius:10px;padding:24px;border:1px solid;}.dist-card.flbr{border-color:rgba(0,188,212,.3);background:rgba(0,188,212,.04);}.dist-card.hz{border-color:rgba(0,230,118,.3);background:rgba(0,230,118,.04);}.dist-who{font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-family:var(--mono);margin-bottom:8px;}.dist-card.flbr .dist-who{color:var(--teal);}.dist-card.hz .dist-who{color:var(--green);}.dist-amount{font-size:32px;font-weight:800;font-family:var(--mono);margin-bottom:6px;}.dist-card.flbr .dist-amount{color:var(--teal);}.dist-card.hz .dist-amount{color:var(--green);}.dist-note{font-size:11px;color:var(--text2);}.footer{padding:32px 64px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);}.footer-left{font-size:11px;color:var(--text3);font-family:var(--mono);}.footer-right{font-size:11px;color:var(--text3);font-family:var(--mono);text-align:right;}.payback-wrap{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;}.payback-bar-wrap{padding:16px 24px 20px;}.payback-bar-track{height:8px;background:var(--border2);border-radius:4px;overflow:hidden;margin-top:8px;}.payback-bar-fill{height:100%;background:linear-gradient(90deg,var(--teal),var(--green));border-radius:4px;}.payback-info{display:flex;flex-direction:column;gap:16px;}.pb-card{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:24px;}.pb-card-val{font-size:28px;font-weight:800;font-family:var(--mono);color:var(--green);margin-bottom:4px;}.pb-card-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--mono);margin-bottom:8px;}.pb-card-sub{font-size:12px;color:var(--text2);font-family:var(--mono);line-height:1.5;}.chart-grid{display:grid;gap:24px;}.chart-grid.cols2{grid-template-columns:1fr 1fr;}.chart-panel{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:24px;}.chart-title{font-size:10px;font-family:var(--mono);color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px;}.chart-wrap{position:relative;height:240px;}.demanda-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:32px;}.dem-card{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:20px;}.dem-card-tag{font-size:9px;font-family:var(--mono);letter-spacing:.15em;text-transform:uppercase;margin-bottom:10px;}.dem-card-val{font-size:22px;font-weight:800;font-family:var(--mono);margin-bottom:4px;}.dem-card-sub{font-size:11px;color:var(--text2);font-family:var(--mono);}.pico-tag{color:var(--amber);}.highlight-list{display:flex;flex-direction:column;gap:12px;}.highlight-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--bg3);border-radius:8px;border:1px solid var(--border);}.hi-icon{font-size:16px;flex-shrink:0;margin-top:1px;}.hi-text{font-size:13px;color:var(--text1);line-height:1.5;}.hi-text span{color:var(--text2);font-family:var(--mono);font-size:12px;}.alert-item{border-left:3px solid var(--amber);}.alert-item .hi-text{color:var(--text2);}.alert-item .hi-text strong{color:var(--amber);}.steps-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}.step-card{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:24px;position:relative;overflow:hidden;}.step-card::before{content:'';position:absolute;top:0;left:0;bottom:0;width:3px;}.step-card.pri1::before{background:var(--red);}.step-card.pri2::before{background:var(--amber);}.step-card.pri3::before{background:var(--teal);}.step-card.pri4::before{background:var(--purple);}.step-title{font-size:15px;font-weight:700;margin-bottom:6px;color:var(--text1);}.step-desc{font-size:12px;color:var(--text2);line-height:1.6;font-family:var(--mono);}.meta-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12px;}.meta-table th{background:rgba(255,255,255,.02);padding:10px 16px;text-align:left;color:var(--text3);font-size:10px;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--border);}.meta-table td{padding:12px 16px;border-bottom:1px solid rgba(26,35,51,.5);color:var(--text2);}.meta-table tr:last-child td{border-bottom:none;}.meta-table .val-ok{color:var(--green);}.meta-table .val-warn{color:var(--amber);}.meta-table .val-bad{color:var(--red);}.indicator{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:middle;}.ind-ok{background:var(--green);}.ind-warn{background:var(--amber);}.ind-bad{background:var(--red);}.kpi-invest{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px;}.ki{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:24px;position:relative;overflow:hidden;}.ki::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}.ki.g::before{background:var(--green);}.ki.t::before{background:var(--teal);}.ki.a::before{background:var(--amber);}.ki-lbl{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px;}.ki-val{font-size:26px;font-weight:800;font-family:var(--mono);margin-bottom:4px;}.ki.g .ki-val{color:var(--green);}.ki.t .ki-val{color:var(--teal);}.ki.a .ki-val{color:var(--amber);}.ki-sub{font-size:11px;color:var(--text2);font-family:var(--mono);}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:32px;}.network-hero{padding:80px 64px;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(0,188,212,.08) 0%,transparent 70%),var(--bg);text-align:center;border-bottom:1px solid var(--border);}.network-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border-radius:16px;overflow:hidden;max-width:800px;margin:0 auto;}.nk{background:var(--bg2);padding:28px 20px;text-align:center;}.nk-val{font-size:32px;font-weight:800;font-family:var(--mono);color:var(--green);margin-bottom:4px;}.nk-lbl{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.15em;font-family:var(--mono);}.station-row{display:flex;align-items:center;gap:20px;padding:20px 24px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);margin-bottom:12px;}.sr-score{font-size:28px;font-weight:800;font-family:var(--mono);min-width:60px;}.sr-bar{flex:1;height:4px;background:var(--border2);border-radius:2px;overflow:hidden;}.sr-fill{height:100%;border-radius:2px;}.sr-meta{font-size:11px;color:var(--text2);font-family:var(--mono);}.market-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-bottom:32px;}.market-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:28px;}.market-card-val{font-size:36px;font-weight:800;font-family:var(--mono);margin-bottom:6px;}.market-card-lbl{font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;}.market-card-desc{font-size:12px;color:var(--text2);line-height:1.7;font-family:var(--mono);}.gestao-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}.gestao-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:24px;}.gestao-icon{font-size:24px;margin-bottom:12px;}.gestao-title{font-size:14px;font-weight:700;margin-bottom:6px;}.gestao-desc{font-size:12px;color:var(--text2);line-height:1.6;font-family:var(--mono);}@media(max-width:640px){.cover{padding:32px 20px;}.cover-title{font-size:clamp(36px,10vw,56px);}.cover-kpis{grid-template-columns:1fr 1fr;}.section{padding:32px 20px;}.section-h2{font-size:22px;}.kpi-grid.cols4{grid-template-columns:1fr 1fr;}.kpi-grid.cols3{grid-template-columns:1fr 1fr;}.kpi-grid.cols2{grid-template-columns:1fr;}.dre{grid-template-columns:1fr;gap:16px;}.payback-wrap{grid-template-columns:1fr;}.two-col{grid-template-columns:1fr;}.steps-grid{grid-template-columns:1fr;}.market-grid{grid-template-columns:1fr;}.gestao-grid{grid-template-columns:1fr;}.kpi-invest{grid-template-columns:1fr 1fr;}.network-kpis{grid-template-columns:1fr;}.demanda-grid{grid-template-columns:1fr 1fr;}.footer{flex-direction:column;gap:12px;padding:24px 20px;}.cover-bottom{flex-direction:column;gap:12px;}.logo-block img{height:36px;}}`;

function calcDREv2(sessoes:Session[],cfg:DREConfig|null,periodDays:number){const dias30=30;const bruto=sessoes.reduce((a,s)=>a+s.value,0);const totalKwh=sessoes.reduce((a,s)=>a+s.energy,0);const totalSess=sessoes.length;const faturMensal=periodDays>0?bruto/periodDays*dias30:0;const faturAnual=faturMensal*12;const ticket=totalSess>0?bruto/totalSess:0;const priceKwh=totalKwh>0?bruto/totalKwh:0;if(!cfg)return{bruto,totalKwh,totalSess,faturMensal,faturAnual,ticket,priceKwh,ll:0,margem:0,repInv:0,repHz:bruto,retMensalInv:0,rentAnual:0,faltaAmort:0,mesesPay:Infinity,pTotal:0,custoEspaco:0,impostoVal:0,custoApp:0,custoEnergia:0,dreItems:[] as {lbl:string;val:number;main?:boolean;result?:boolean}[]};const aliq=cfg.modelo==="propria"?dreSimples(faturAnual):cfg.pctImposto;const custoEspaco=bruto*(cfg.pctEspaco/100);const impostoVal=bruto*(aliq/100);const custoApp=bruto*(cfg.pctApp/100);let custoEnergia=0;if(!cfg.solarProprio){if(cfg.energiaTipo==="kwh")custoEnergia=totalKwh*cfg.energiaKwh;if(cfg.energiaTipo==="usina")custoEnergia=cfg.usinaFixo;}const ll=bruto-custoEspaco-impostoVal-custoApp-custoEnergia-cfg.fixoInternet-cfg.fixoAluguel;const margem=bruto>0?(ll/bruto)*100:0;const repInv=cfg.modelo==="investidor"?ll*(cfg.invPct/100):0;const repHz=cfg.modelo==="investidor"?ll*((100-cfg.invPct)/100):ll;const retMensalInv=periodDays>0?repInv/periodDays*dias30:0;const rentAnual=cfg.invTotal>0?(retMensalInv*12/cfg.invTotal)*100:0;const faltaAmort=Math.max(0,cfg.invTotal-cfg.invAmort);const mesesPay=retMensalInv>0?faltaAmort/retMensalInv:Infinity;const tot=cfg.invDividaPrio+(cfg.invTotal-cfg.invPago);const pTotal=tot>0?Math.min(100,(cfg.invAmort/tot)*100):0;const dreItems:{lbl:string;val:number;main?:boolean;result?:boolean}[]=[];dreItems.push({lbl:"Receita Bruta",val:bruto,main:true});if(cfg.pctEspaco>0)dreItems.push({lbl:`(–) Custo Parceiro (${cfg.pctEspaco}%)`,val:-custoEspaco});dreItems.push({lbl:`(–) Impostos (${aliq.toFixed(0)}%)`,val:-impostoVal});dreItems.push({lbl:`(–) Taxa App (${cfg.pctApp}%)`,val:-custoApp});if(cfg.energiaTipo!=="incluido"&&!cfg.solarProprio&&custoEnergia>0)dreItems.push({lbl:"(–) Energia",val:-custoEnergia});if(cfg.fixoAluguel>0)dreItems.push({lbl:"(–) Aluguel",val:-cfg.fixoAluguel});if(cfg.fixoInternet>0)dreItems.push({lbl:"(–) Internet",val:-cfg.fixoInternet});dreItems.push({lbl:"= Lucro Líquido",val:ll,result:true});return{bruto,totalKwh,totalSess,faturMensal,faturAnual,ticket,priceKwh,ll,margem,repInv,repHz,retMensalInv,rentAnual,faltaAmort,mesesPay,pTotal,custoEspaco,impostoVal,custoApp,custoEnergia,dreItems};}
function brlFmt(v:number){return`R$\u00a0${Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function numFmt(v:number){return v.toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0});}
function gerarCoverHTML(eyebrow:string,titleLine1:string,titleAccent:string,subLine:string,destLabel:string,destName:string,stationLine:string,periodLine:string,kpis:{val:string;lbl:string;sub:string;cls:string}[],confTag="Confidencial · Uso Restrito"):string{const ckpisHtml=kpis.map(k=>`<div class="ckpi ${k.cls}"><div class="ckpi-val">${k.val}</div><div class="ckpi-lbl">${k.lbl}</div><div class="ckpi-sub">${k.sub}</div></div>`).join("");return`<div class="cover"><div class="cover-top"><div class="logo-block"><img src="${LOGO_URL_REL}" alt="HertzGo" crossorigin="anonymous"><div class="logo-sub">Rede de Eletropostos · Brasília</div></div><div class="badge-conf">${confTag}</div></div><div class="cover-main"><div class="cover-eyebrow">${eyebrow}</div><div class="cover-title">${titleLine1}<span class="accent">${titleAccent}</span></div><div class="cover-line"></div><div class="cover-sub">${subLine}</div></div><div class="cover-kpis">${ckpisHtml}</div><div class="cover-bottom"><div class="cover-dest">${destLabel}<strong>${destName}</strong></div><div class="cover-period">${stationLine}<br>${periodLine}</div></div></div>`;}
function gerarDreHTML(dreItems:{lbl:string;val:number;main?:boolean;result?:boolean}[],invNome:string,invPct:number,repInv:number,repHz:number,margem:number,ll:number):string{const rows=dreItems.map(r=>`<div class="dre-row${r.result?' result':''}"><span class="dre-lbl${r.main?' main':''}">${r.lbl}</span><span class="dre-val ${r.val>=0?'pos':'neg'}">${r.val>=0?brlFmt(r.val):"– "+brlFmt(r.val)}</span></div>`).join("");const distHtml=invPct>0?`<div class="dist-box"><div class="dist-title">Distribuição do Lucro · ${invPct}/${100-invPct}</div><div class="dist-card flbr"><div class="dist-who">🏢 ${invNome}</div><div class="dist-amount">${brlFmt(repInv)}</div><div class="dist-note">${invPct}% do lucro líquido<br><em>* Abatimento do aporte investido</em></div></div><div class="dist-card hz"><div class="dist-who">⚡ HertzGo</div><div class="dist-amount">${brlFmt(repHz)}</div><div class="dist-note">${100-invPct}% do lucro líquido</div></div></div>`:`<div class="dist-box"><div class="dist-title">Resultado HertzGo</div><div class="dist-card hz"><div class="dist-who">⚡ HertzGo</div><div class="dist-amount">${brlFmt(ll)}</div><div class="dist-note">100% lucro líquido · operação própria</div></div></div>`;return`<div class="dre"><div class="dre-table">${rows}<div class="dre-row" style="background:rgba(255,255,255,.015);"><span class="dre-lbl" style="color:var(--text3);font-size:11px;font-family:var(--mono);">Margem líquida</span><span class="dre-val" style="color:var(--text2);font-size:12px;">${margem.toFixed(1)}% da receita bruta</span></div></div>${distHtml}</div>`;}

// As funções gerarRelatorioEU, gerarRelatorioSocioV2, gerarRelatorioOpV2, gerarApresentacaoV2
// são idênticas à versão original — mantidas integralmente
// (omitidas aqui por tamanho — são copiadas do original abaixo via spread)

function gerarRelatorioEU(sessions:Session[],appState:AppState,station:string):string{
  const ok=sessions.filter(s=>s.hubKey===station&&!s.cancelled&&s.energy>0);
  const todos=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const cfg=appState.dreConfigs[station]||null;
  const datas=ok.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const d=calcDREv2(ok,cfg,periodDays);
  const users=classificarUsuarios(ok);
  const motoristas=users.filter(u=>u.isMotorista);
  const novos=users.slice(0,5);
  const meta=appState.metas["global"]||0;
  const pctMeta=meta>0?Math.min(150,(d.faturMensal/meta)*100):0;
  const metaColor=pctMeta>=100?"var(--green)":pctMeta>=75?"var(--amber)":"var(--red)";
  const hs=calcHealthScore(sessions,cfg,station);
  const hsColor=hs.status==="saudavel"?"var(--green)":hs.status==="atencao"?"var(--amber)":"var(--red)";
  const cover=gerarCoverHTML(
    "Relatório Executivo · Uso Interno",
    "Resumo",`Executivo.`,
    `${hubNome(station)} · Período ${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`,
    "Gestão Interna","HertzGo Operations",
    hubNome(station),`${periodDays} dias de operação`,
    [{val:brlFmt(d.bruto),lbl:"Receita Bruta",sub:`${brlFmt(d.faturMensal)}/mês proj.`,cls:"g"},
     {val:brlFmt(d.ll),lbl:"Lucro Líquido",sub:`${d.margem.toFixed(1)}% margem`,cls:"t"},
     {val:`${d.totalSess}`,lbl:"Sessões",sub:`${(d.totalSess/periodDays).toFixed(1)}/dia`,cls:"a"},
     {val:`${d.totalKwh.toFixed(0)} kWh`,lbl:"Energia",sub:`${(d.totalKwh/periodDays).toFixed(0)}/dia`,cls:"p"}]
  );
  const dreSection=cfg?`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">01 — Financeiro</div><h2 class="section-h2">DRE do Período</h2></div>
      <span class="section-tag tag-green">Atualizado</span>
    </div>
    ${gerarDreHTML(d.dreItems,cfg.invNome||"Investidor",cfg.modelo==="investidor"?cfg.invPct:0,d.repInv,d.repHz,d.margem,d.ll)}
  </div>`:"";
  const invSection=cfg&&cfg.modelo==="investidor"?`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">02 — Investimento</div><h2 class="section-h2">Retorno ao Investidor</h2></div>
      <span class="section-tag tag-amber">Mensal</span>
    </div>
    <div class="kpi-invest">
      <div class="ki g"><div class="ki-lbl">Retorno Período</div><div class="ki-val">${brlFmt(d.repInv)}</div><div class="ki-sub">${brlFmt(d.retMensalInv)}/mês projetado</div></div>
      <div class="ki t"><div class="ki-lbl">Rentabilidade Anual</div><div class="ki-val">${d.rentAnual.toFixed(1)}% a.a.</div><div class="ki-sub">Sobre ${brlFmt(cfg.invTotal)} investido</div></div>
      <div class="ki a"><div class="ki-lbl">Payback Estimado</div><div class="ki-val">${d.mesesPay===Infinity?"—":d.mesesPay<12?Math.ceil(d.mesesPay)+"m":(d.mesesPay/12).toFixed(1)+"a"}</div><div class="ki-sub">Saldo devedor: ${brlFmt(d.faltaAmort)}</div></div>
    </div>
    <div class="payback-bar-wrap" style="background:var(--bg3);border-radius:12px;border:1px solid var(--border);margin-bottom:16px;">
      <div style="padding:16px 24px 8px;font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;">Progresso de Amortização</div>
      <div style="padding:0 24px 20px;">
        <div class="payback-bar-track"><div class="payback-bar-fill" style="width:${d.pTotal.toFixed(1)}%"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;font-family:var(--mono);color:var(--text2);">
          <span>${d.pTotal.toFixed(1)}% amortizado</span><span>${brlFmt(d.faltaAmort)} restante</span>
        </div>
      </div>
    </div>
  </div>`:"";
  const opSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">03 — Operação</div><h2 class="section-h2">Indicadores Operacionais</h2></div>
      <span class="section-tag ${hs.status==="saudavel"?"tag-green":hs.status==="atencao"?"tag-amber":"tag-red"}">Health ${hs.total}/100</span>
    </div>
    <div class="kpi-grid cols4" style="margin-bottom:24px;">
      <div class="kpi"><div class="kpi-icon">⚡</div><div class="kpi-lbl">Sessões/Dia</div><div class="kpi-val" style="color:var(--green)">${(d.totalSess/periodDays).toFixed(1)}</div><div class="kpi-detail">Meta: 12/dia</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(100,(d.totalSess/periodDays)/12*100).toFixed(0)}%;background:var(--green)"></div></div></div>
      <div class="kpi"><div class="kpi-icon">💰</div><div class="kpi-lbl">Receita/Dia</div><div class="kpi-val" style="color:var(--teal)">${brlFmt(d.bruto/periodDays)}</div><div class="kpi-detail">Proj. ${brlFmt(d.faturMensal)}/mês</div></div>
      <div class="kpi"><div class="kpi-icon">🔋</div><div class="kpi-lbl">kWh/Dia</div><div class="kpi-val" style="color:var(--amber)">${(d.totalKwh/periodDays).toFixed(0)}</div><div class="kpi-detail">Preço: ${brlFmt(d.priceKwh)}/kWh</div></div>
      <div class="kpi"><div class="kpi-icon">🎟️</div><div class="kpi-lbl">Ticket Médio</div><div class="kpi-val" style="color:var(--purple)">${brlFmt(d.ticket)}</div><div class="kpi-detail">${d.totalSess} sessões totais</div></div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:20px;">
      <div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;">Diagnóstico Health Score</div>
      <p style="font-size:13px;color:var(--text2);line-height:1.7;font-family:var(--mono);">${hs.diagnostico}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:16px;">
        <div style="padding:12px;background:var(--bg2);border-radius:8px;"><div style="font-size:9px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Financeiro</div><div style="font-size:18px;font-weight:800;color:${hsColor};font-family:var(--mono)">${hs.financeiro}/40</div><div style="font-size:10px;color:var(--text2);font-family:var(--mono);margin-top:2px;">${hs.financeiroDet}</div></div>
        <div style="padding:12px;background:var(--bg2);border-radius:8px;"><div style="font-size:9px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Operacional</div><div style="font-size:18px;font-weight:800;color:${hsColor};font-family:var(--mono)">${hs.operacional}/35</div><div style="font-size:10px;color:var(--text2);font-family:var(--mono);margin-top:2px;">${hs.operacionalDet}</div></div>
        <div style="padding:12px;background:var(--bg2);border-radius:8px;"><div style="font-size:9px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Investidor</div><div style="font-size:18px;font-weight:800;color:${hsColor};font-family:var(--mono)">${hs.investidor}/25</div><div style="font-size:10px;color:var(--text2);font-family:var(--mono);margin-top:2px;">${hs.investidorDet}</div></div>
      </div>
    </div>
  </div>`;
  const usersSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">04 — Usuários</div><h2 class="section-h2">Base de Clientes</h2></div>
      <span class="section-tag tag-teal">${users.length} únicos</span>
    </div>
    <div class="kpi-grid cols4" style="margin-bottom:24px;">
      <div class="kpi"><div class="kpi-lbl">Total Usuários</div><div class="kpi-val" style="color:var(--green)">${users.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Motoristas App</div><div class="kpi-val" style="color:var(--red)">${motoristas.length}</div><div class="kpi-detail">${users.length>0?(motoristas.length/users.length*100).toFixed(0):0}% da base</div></div>
      <div class="kpi"><div class="kpi-lbl">Heavy Users</div><div class="kpi-val" style="color:var(--amber)">${users.filter(u=>u.isHeavy).length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Shoppers</div><div class="kpi-val" style="color:var(--teal)">${users.filter(u=>!u.isParceiro&&!u.isMotorista&&!u.isHeavy).length}</div></div>
    </div>
    <table class="meta-table">
      <thead><tr><th>#</th><th>Usuário</th><th>Perfil</th><th style="text-align:right">kWh</th><th style="text-align:right">Receita</th></tr></thead>
      <tbody>${users.sort((a,b)=>b.rev-a.rev).slice(0,10).map((u,i)=>`<tr><td>${i+1}</td><td>${u.user}</td><td>${u.perfil}</td><td style="text-align:right;font-family:var(--mono)">${u.kwh.toFixed(1)}</td><td style="text-align:right;font-family:var(--mono);color:var(--green)">${brlFmt(u.rev)}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
  const metaSection=meta>0?`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">05 — Metas</div><h2 class="section-h2">Pacing Mensal</h2></div>
      <span class="section-tag ${pctMeta>=100?"tag-green":pctMeta>=75?"tag-amber":"tag-red"}">${pctMeta.toFixed(0)}% da meta</span>
    </div>
    <div class="kpi-grid cols3" style="margin-bottom:24px;">
      <div class="kpi"><div class="kpi-lbl">Meta Mensal</div><div class="kpi-val" style="color:var(--amber)">${brlFmt(meta)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Projeção</div><div class="kpi-val" style="color:${metaColor}">${brlFmt(d.faturMensal)}</div><div class="kpi-detail">${pctMeta.toFixed(0)}% da meta</div></div>
      <div class="kpi"><div class="kpi-lbl">Resultado</div><div class="kpi-val" style="color:${pctMeta>=100?"var(--green)":"var(--red)"}">${pctMeta>=100?"✅ No alvo":"⚠️ Abaixo"}</div></div>
    </div>
    <div style="background:var(--bg3);border-radius:8px;border:1px solid var(--border);height:8px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:${Math.min(100,pctMeta).toFixed(0)}%;background:${metaColor};border-radius:8px;transition:width .3s"></div></div>
  </div>`:"";
  const planoSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">06 — Plano de Ação</div><h2 class="section-h2">Próximos Passos</h2></div>
    </div>
    <div class="steps-grid">
      <div class="step-card pri1"><div class="step-title">🔴 Ação Imediata</div><div class="step-desc">Contatar motoristas de app em risco de churn nas estações próprias. Prioridade máxima para VIPs com mais de 14 dias sem recarga.</div></div>
      <div class="step-card pri2"><div class="step-title">🟡 Curto Prazo (7 dias)</div><div class="step-desc">Enviar mensagens de boas-vindas para novos usuários nas estações próprias. Ativar cupons de fidelização para heavy users.</div></div>
      <div class="step-card pri3"><div class="step-title">🟢 Médio Prazo (30 dias)</div><div class="step-desc">Expandir cobertura de telefones na base de contatos. Meta: acima de 70% de cobertura para CRM efetivo.</div></div>
      <div class="step-card pri4"><div class="step-title">🔵 Estratégico (90 dias)</div><div class="step-desc">Avaliar expansão para novos pontos com base na demanda atual. Analisar viabilidade de novas parcerias na região.</div></div>
    </div>
  </div>`;
  return`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumo Executivo — ${hubNome(station)}</title><style>${FLBR_CSS}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>${cover}${dreSection}${invSection}${opSection}${usersSection}${metaSection}${planoSection}<footer class="footer"><div class="footer-left">HertzGo · CNPJ 27.713.035/0001-24 · Brasília · DF<br>Gerado em ${new Date().toLocaleString("pt-BR")}</div><div class="footer-right">Confidencial · Uso Interno<br>${hubNome(station)} · Vision v5.2</div></footer><script>document.querySelectorAll('.logo-block img').forEach(function(img){img.onerror=function(){this.style.display='none';var span=document.createElement('span');span.style.cssText='font-family:var(--font);font-size:22px;font-weight:800;color:#e8f0f8;letter-spacing:-.02em;';span.innerHTML='Hertz<span style="color:var(--green)">Go</span>';this.parentNode.insertBefore(span,this);};});</script></body></html>`;
}

function gerarRelatorioSocioV2(sessions:Session[],appState:AppState,station:string):string{
  const ok=sessions.filter(s=>s.hubKey===station&&!s.cancelled&&s.energy>0);
  const cfg=appState.dreConfigs[station]||null;
  if(!cfg)return`<!DOCTYPE html><html><body style="background:#080a0f;color:#e8edf5;font-family:sans-serif;padding:40px;"><h1>Configure o DRE para ${hubNome(station)} antes de gerar este relatório.</h1><script>document.querySelectorAll('.logo-block img').forEach(function(img){img.onerror=function(){this.style.display='none';var span=document.createElement('span');span.style.cssText='font-family:var(--font);font-size:22px;font-weight:800;color:#e8f0f8;letter-spacing:-.02em;';span.innerHTML='Hertz<span style="color:var(--green)">Go</span>';this.parentNode.insertBefore(span,this);};});</script></body></html>`;
  const datas=ok.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const d=calcDREv2(ok,cfg,periodDays);
  const cover=gerarCoverHTML(
    "Relatório de Sócio · Confidencial",
    "Relatório","Sócio.",
    `${hubNome(station)} · ${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`,
    "Destinatário",cfg.invNome||"Investidor",
    hubNome(station),`${periodDays} dias · Modelo ${cfg.modelo}`,
    [{val:brlFmt(d.bruto),lbl:"Receita Bruta",sub:"período",cls:"g"},
     {val:brlFmt(d.ll),lbl:"Lucro Líquido",sub:`${d.margem.toFixed(1)}% margem`,cls:"t"},
     {val:brlFmt(d.repInv),lbl:`Retorno ${cfg.invNome?.split(" ")[0]||"Investidor"}`,sub:`${cfg.invPct}% do LL`,cls:"a"},
     {val:brlFmt(d.faturMensal),lbl:"Proj. Mensal",sub:"base 30 dias",cls:"p"}]
  );
  const dreSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">01 — DRE</div><h2 class="section-h2">Demonstrativo de Resultado</h2></div>
      <span class="section-tag tag-green">Período ${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}</span>
    </div>
    ${gerarDreHTML(d.dreItems,cfg.invNome||"Investidor",cfg.invPct,d.repInv,d.repHz,d.margem,d.ll)}
  </div>`;
  const kpiSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">02 — KPIs</div><h2 class="section-h2">Indicadores do Período</h2></div>
    </div>
    <div class="kpi-grid cols4">
      <div class="kpi"><div class="kpi-lbl">Sessões</div><div class="kpi-val" style="color:var(--green)">${numFmt(d.totalSess)}</div><div class="kpi-detail">${(d.totalSess/periodDays).toFixed(1)}/dia</div></div>
      <div class="kpi"><div class="kpi-lbl">Energia</div><div class="kpi-val" style="color:var(--teal)">${numFmt(Math.round(d.totalKwh))} kWh</div><div class="kpi-detail">${(d.totalKwh/periodDays).toFixed(0)}/dia</div></div>
      <div class="kpi"><div class="kpi-lbl">Preço/kWh</div><div class="kpi-val" style="color:var(--amber)">${brlFmt(d.priceKwh)}</div><div class="kpi-detail">Ticket: ${brlFmt(d.ticket)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Proj. Anual</div><div class="kpi-val" style="color:var(--purple)">${brlFmt(d.faturAnual)}</div><div class="kpi-detail">receita bruta</div></div>
    </div>
  </div>`;
  const paybackSection=cfg.modelo==="investidor"?`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">03 — Retorno</div><h2 class="section-h2">Payback & Rentabilidade</h2></div>
      <span class="section-tag tag-amber">${cfg.invNome?.split(" ")[0]||"Investidor"}</span>
    </div>
    <div class="payback-wrap">
      <div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:16px;">
          <div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;">Amortização do Aporte</div>
          <div class="payback-bar-track"><div class="payback-bar-fill" style="width:${d.pTotal.toFixed(1)}%"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--text2);">
            <span>${d.pTotal.toFixed(1)}% pago</span><span>${brlFmt(d.faltaAmort)} restante</span>
          </div>
        </div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:20px;">
          <div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px;">Distribuição mensal projetada</div>
          <div style="font-size:28px;font-weight:800;font-family:var(--mono);color:var(--teal)">${brlFmt(d.retMensalInv)}<span style="font-size:14px;color:var(--text2)">/mês</span></div>
        </div>
      </div>
      <div class="payback-info">
        <div class="pb-card"><div class="pb-card-lbl">Rentabilidade Anual</div><div class="pb-card-val">${d.rentAnual.toFixed(1)}% a.a.</div><div class="pb-card-sub">Sobre ${brlFmt(cfg.invTotal)} investido<br>Acima do CDI (${d.rentAnual>13?"✅ sim":"⚠️ verificar"})</div></div>
        <div class="pb-card"><div class="pb-card-lbl">Payback Estimado</div><div class="pb-card-val">${d.mesesPay===Infinity?"—":d.mesesPay<12?Math.ceil(d.mesesPay)+" meses":(d.mesesPay/12).toFixed(1)+" anos"}</div><div class="pb-card-sub">Baseado no retorno atual<br>Saldo: ${brlFmt(d.faltaAmort)}</div></div>
      </div>
    </div>
  </div>`:"";
  return`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Sócio — ${hubNome(station)}</title><style>${FLBR_CSS}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>${cover}${dreSection}${kpiSection}${paybackSection}<footer class="footer"><div class="footer-left">HertzGo · CNPJ 27.713.035/0001-24 · Brasília · DF<br>Gerado em ${new Date().toLocaleString("pt-BR")}</div><div class="footer-right">Confidencial · ${cfg.invNome||"Investidor"}<br>${hubNome(station)} · Vision v5.2</div></footer><script>document.querySelectorAll('.logo-block img').forEach(function(img){img.onerror=function(){this.style.display='none';var span=document.createElement('span');span.style.cssText='font-family:var(--font);font-size:22px;font-weight:800;color:#e8f0f8;letter-spacing:-.02em;';span.innerHTML='Hertz<span style="color:var(--green)">Go</span>';this.parentNode.insertBefore(span,this);};});</script></body></html>`;
}

function gerarRelatorioOpV2(sessions:Session[],appState:AppState,station:string):string{
  const ok=sessions.filter(s=>s.hubKey===station&&!s.cancelled&&s.energy>0);
  const datas=ok.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const d=calcDREv2(ok,null,periodDays);
  const users=classificarUsuarios(ok);
  const hourData=Array(24).fill(0).map(()=>({sess:0}));
  ok.forEach(s=>{if(s.startHour!==null)hourData[s.startHour].sess++;});
  const picoHour=hourData.reduce((max,h,i)=>h.sess>hourData[max].sess?i:max,0);
  const cancelled=sessions.filter(s=>s.hubKey===station&&s.cancelled);
  const cancelRate=ok.length+cancelled.length>0?cancelled.length/(ok.length+cancelled.length):0;
  const withOv=ok.filter(s=>s.overstayMin!==null&&s.overstayMin>0);
  const avgOv=withOv.length>0?withOv.reduce((a,s)=>a+(s.overstayMin||0),0)/withOv.length:0;
  const cover=gerarCoverHTML(
    "Relatório Operacional · Uso Interno",
    "Relatório","Operacional.",
    `${hubNome(station)} · ${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`,
    "Equipe","Operações HertzGo",
    hubNome(station),`${periodDays} dias`,
    [{val:`${numFmt(d.totalSess)}`,lbl:"Sessões",sub:`${(d.totalSess/periodDays).toFixed(1)}/dia`,cls:"g"},
     {val:`${numFmt(Math.round(d.totalKwh))} kWh`,lbl:"Energia",sub:`${(d.totalKwh/periodDays).toFixed(0)}/dia`,cls:"t"},
     {val:`${(cancelRate*100).toFixed(1)}%`,lbl:"Cancelamentos",sub:cancelRate<=0.08?"✅ ok":"⚠️ atenção",cls:"a"},
     {val:`${picoHour}h`,lbl:"Pico de Uso",sub:`${hourData[picoHour].sess} sessões`,cls:"p"}]
  );
  const demandaSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">01 — Demanda</div><h2 class="section-h2">Padrão de Uso</h2></div>
    </div>
    <div class="demanda-grid">
      <div class="dem-card"><div class="dem-card-tag" style="color:var(--green)">Sessões/Dia</div><div class="dem-card-val" style="color:var(--green)">${(d.totalSess/periodDays).toFixed(1)}</div><div class="dem-card-sub">Total: ${numFmt(d.totalSess)}</div></div>
      <div class="dem-card"><div class="dem-card-tag" style="color:var(--amber)">kWh/Dia</div><div class="dem-card-val" style="color:var(--amber)">${(d.totalKwh/periodDays).toFixed(0)}</div><div class="dem-card-sub">Total: ${numFmt(Math.round(d.totalKwh))} kWh</div></div>
      <div class="dem-card"><div class="dem-card-tag pico-tag">Pico</div><div class="dem-card-val" style="color:var(--amber)">${picoHour}h–${picoHour+1}h</div><div class="dem-card-sub">${hourData[picoHour].sess} sessões no horário</div></div>
      <div class="dem-card"><div class="dem-card-tag" style="color:${cancelRate<=0.08?"var(--green)":"var(--red)"}">Cancelamentos</div><div class="dem-card-val" style="color:${cancelRate<=0.08?"var(--green)":"var(--red)"}">${(cancelRate*100).toFixed(1)}%</div><div class="dem-card-sub">${cancelled.length} de ${ok.length+cancelled.length}</div></div>
      <div class="dem-card"><div class="dem-card-tag" style="color:${avgOv<=5?"var(--green)":"var(--amber)"}">Overstay Médio</div><div class="dem-card-val" style="color:${avgOv<=5?"var(--green)":"var(--amber)"}">${avgOv.toFixed(0)} min</div><div class="dem-card-sub">${withOv.length} ocorrências</div></div>
      <div class="dem-card"><div class="dem-card-tag" style="color:var(--teal)">Ticket Médio</div><div class="dem-card-val" style="color:var(--teal)">${brlFmt(d.ticket)}</div><div class="dem-card-sub">${brlFmt(d.priceKwh)}/kWh</div></div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:20px;">
      <div style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;">Distribuição por Hora</div>
      <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;">
        ${hourData.map((h,hr)=>{const max=Math.max(...hourData.map(x=>x.sess),1);const pct=h.sess/max*100;return`<div title="${hr}h: ${h.sess}" style="height:48px;border-radius:3px;background:${h.sess>0?`rgba(0,229,160,${0.15+pct/100*0.85})`:"rgba(255,255,255,0.03)"};display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;"><span style="font-size:7px;color:rgba(255,255,255,0.5);font-family:var(--mono)">${h.sess>0?h.sess:""}</span></div>`;}).join("")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;margin-top:3px;">
        ${Array.from({length:24},(_,hr)=>`<div style="font-size:7px;color:var(--text3);text-align:center;font-family:var(--mono)">${hr%6===0?hr+"h":""}</div>`).join("")}
      </div>
    </div>
  </div>`;
  const usersSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">02 — Usuários</div><h2 class="section-h2">Fidelização & Perfis</h2></div>
      <span class="section-tag tag-teal">${users.length} usuários únicos</span>
    </div>
    <div class="kpi-grid cols4" style="margin-bottom:24px;">
      <div class="kpi"><div class="kpi-lbl">Motoristas App</div><div class="kpi-val" style="color:var(--red)">${users.filter(u=>u.isMotorista).length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Heavy Users</div><div class="kpi-val" style="color:var(--amber)">${users.filter(u=>u.isHeavy).length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Shoppers</div><div class="kpi-val" style="color:var(--green)">${users.filter(u=>!u.isParceiro&&!u.isMotorista&&!u.isHeavy).length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Parceiros</div><div class="kpi-val" style="color:var(--blue)">${users.filter(u=>u.isParceiro).length}</div></div>
    </div>
    <table class="meta-table">
      <thead><tr><th>#</th><th>Usuário</th><th>Perfil</th><th style="text-align:right">Sessões</th><th style="text-align:right">kWh</th></tr></thead>
      <tbody>${users.sort((a,b)=>b.kwh-a.kwh).slice(0,10).map((u,i)=>`<tr><td>${i+1}</td><td>${u.user}</td><td>${u.perfil}</td><td style="text-align:right;font-family:var(--mono)">${u.sess}</td><td style="text-align:right;font-family:var(--mono);color:var(--green)">${u.kwh.toFixed(1)}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
  return`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Operacional — ${hubNome(station)}</title><style>${FLBR_CSS}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>${cover}${demandaSection}${usersSection}<footer class="footer"><div class="footer-left">HertzGo · CNPJ 27.713.035/0001-24 · Brasília · DF<br>Gerado em ${new Date().toLocaleString("pt-BR")}</div><div class="footer-right">Uso Interno — Equipe Operações<br>${hubNome(station)} · Vision v5.2</div></footer><script>document.querySelectorAll('.logo-block img').forEach(function(img){img.onerror=function(){this.style.display='none';var span=document.createElement('span');span.style.cssText='font-family:var(--font);font-size:22px;font-weight:800;color:#e8f0f8;letter-spacing:-.02em;';span.innerHTML='Hertz<span style="color:var(--green)">Go</span>';this.parentNode.insertBefore(span,this);};});</script></body></html>`;
}

function gerarApresentacaoV2(sessions:Session[],appState:AppState):string{
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const datas=ok.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const totalKwh=ok.reduce((a,s)=>a+s.energy,0);
  const totalSess=ok.length;
  const hubs=Array.from(new Set(ok.map(s=>s.hubKey)));
  const users=classificarUsuarios(ok);
  const faturMensal=totalRev/periodDays*30;
  const cover=gerarCoverHTML(
    "Apresentação Institucional · 2026",
    "Rede","HertzGo.",
    "Infraestrutura de recarga inteligente · Brasília · DF",
    "Apresentado a","Investidores & Parceiros",
    "Rede Completa — Todas as Estações",`${hubs.length} estações ativas · ${periodDays} dias de dados`,
    [{val:`${hubs.length}`,lbl:"Estações Ativas",sub:"Brasília · DF",cls:"g"},
     {val:`${numFmt(totalSess)}`,lbl:"Sessões",sub:`${(totalSess/periodDays).toFixed(1)}/dia`,cls:"t"},
     {val:brlFmt(faturMensal),lbl:"Receita Mensal",sub:"projetada",cls:"a"},
     {val:`${users.length}`,lbl:"Usuários Únicos",sub:"base ativa",cls:"p"}],
    "Confidencial · Investidores"
  );
  const mercadoSection=`
  <div class="section network-hero" style="text-align:left;padding:64px;">
    <div style="font-size:10px;font-family:var(--mono);color:var(--teal);letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px;">01 — Mercado</div>
    <h2 style="font-size:clamp(28px,4vw,48px);font-weight:800;letter-spacing:-.02em;margin-bottom:24px;">O momento é <span style="color:var(--green)">agora.</span></h2>
    <div class="market-grid">
      <div class="market-card"><div class="market-card-lbl">Frota EV Brasil</div><div class="market-card-val" style="color:var(--green)">+150k</div><div class="market-card-desc">Veículos elétricos e híbridos plug-in em circulação no Brasil, com crescimento de 80% ao ano. Brasília lidera em concentração per capita.</div></div>
      <div class="market-card"><div class="market-card-lbl">Infraestrutura</div><div class="market-card-val" style="color:var(--amber)">Crítica</div><div class="market-card-desc">A infraestrutura de recarga pública cresce em ritmo 5x mais lento que a frota. A janela de oportunidade para ocupar posição está aberta agora.</div></div>
      <div class="market-card"><div class="market-card-lbl">Brasília</div><div class="market-card-val" style="color:var(--teal)">Top 3</div><div class="market-card-desc">Terceira cidade do Brasil em concentração de EVs, com renda per capita elevada e perfil de consumo compatível com a proposta HertzGo.</div></div>
      <div class="market-card"><div class="market-card-lbl">Mercado Endereçável</div><div class="market-card-val" style="color:var(--purple)">R$2B+</div><div class="market-card-desc">Mercado de recarga pública no Brasil até 2030, segundo projeções da ABVE. HertzGo está posicionada nos mercados de maior densidade.</div></div>
    </div>
  </div>`;
  const redeSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">02 — Rede</div><h2 class="section-h2">Nossa Presença em Brasília</h2></div>
      <span class="section-tag tag-green">${hubs.length} estações ativas</span>
    </div>
    <div class="network-kpis" style="margin-bottom:32px;">
      <div class="nk"><div class="nk-val">${hubs.length}</div><div class="nk-lbl">Estações</div></div>
      <div class="nk"><div class="nk-val">${numFmt(totalSess)}</div><div class="nk-lbl">Sessões Realizadas</div></div>
      <div class="nk"><div class="nk-val">${numFmt(Math.round(totalKwh))} kWh</div><div class="nk-lbl">Energia Entregue</div></div>
    </div>
    ${hubs.map(hub=>{
      const hs=calcHealthScore(sessions,appState.dreConfigs[hub]||null,hub);
      const color=hs.status==="saudavel"?"var(--green)":hs.status==="atencao"?"var(--amber)":"var(--red)";
      const hubOk=ok.filter(s=>s.hubKey===hub);
      const hubRev=hubOk.reduce((a,s)=>a+s.value,0);
      return`<div class="station-row"><div class="sr-score" style="color:${color}">${hs.total}</div><div style="flex:1"><div style="font-size:15px;font-weight:700;margin-bottom:4px">${hubNome(hub)}</div><div style="font-size:11px;color:var(--text2);font-family:var(--mono)">${hubOk.length} sessões · ${brlFmt(hubRev)} · ${(ESTACAO_TIPO as Record<string,string>)[hub]||"contratual"}</div></div><div class="sr-bar"><div class="sr-fill" style="width:${hs.total}%;background:${color}"></div></div></div>`;
    }).join("")}
  </div>`;
  const gestaoSection=`
  <div class="section">
    <div class="section-header">
      <div><div class="section-title">03 — Gestão</div><h2 class="section-h2">Tecnologia & Operação</h2></div>
      <span class="section-tag tag-teal">Vision v5.2</span>
    </div>
    <div class="gestao-grid">
      <div class="gestao-card"><div class="gestao-icon">📊</div><div class="gestao-title">Dashboard Proprietário</div><div class="gestao-desc">HertzGo Vision — painel operacional em tempo real com DRE por estação, CRM automatizado, Health Score e relatórios para investidores.</div></div>
      <div class="gestao-card"><div class="gestao-icon">📱</div><div class="gestao-title">CRM via WhatsApp</div><div class="gestao-desc">6 filas de comunicação automatizadas: qualificação de motoristas, migração para estações próprias, fidelização e recuperação de churn.</div></div>
      <div class="gestao-card"><div class="gestao-icon">⚡</div><div class="gestao-title">Multi-plataforma</div><div class="gestao-desc">Integração com Spott e Move — as duas principais plataformas de recarga do Brasil — garantindo compatibilidade universal com EVs.</div></div>
      <div class="gestao-card"><div class="gestao-icon">🔒</div><div class="gestao-title">Transparência Total</div><div class="gestao-desc">Relatórios mensais automáticos para investidores com DRE, payback, rentabilidade e distribuição do lucro líquido documentados.</div></div>
    </div>
  </div>`;
  const ctaSection=`
  <div class="section" style="text-align:center;padding:80px 64px;">
    <div style="font-size:10px;font-family:var(--mono);color:var(--teal);letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px;">04 — Próximo Passo</div>
    <h2 style="font-size:clamp(32px,5vw,64px);font-weight:800;letter-spacing:-.03em;margin-bottom:16px;">Vamos <span style="color:var(--green)">conversar.</span></h2>
    <p style="font-size:16px;color:var(--text2);max-width:600px;margin:0 auto 40px;line-height:1.7;">Uma conversa de 15 minutos. Apresentamos os números reais, o modelo de negócio e as oportunidades disponíveis.</p>
    <div style="display:inline-flex;align-items:center;gap:16px;background:var(--bg2);border:1px solid rgba(0,230,118,.3);border-radius:16px;padding:24px 32px;">
      <div style="font-size:32px">📱</div>
      <div style="text-align:left"><div style="font-size:12px;font-family:var(--mono);color:var(--text3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px">Wagner Miranda · Fundador</div><div style="font-size:22px;font-weight:700;color:var(--green)">(61) 99803-7361</div><div style="font-size:12px;font-family:var(--mono);color:var(--text2)">WhatsApp · wagnervomiranda@gmail.com</div></div>
    </div>
  </div>`;
  return`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pitch HertzGo — Rede de Eletropostos</title><style>${FLBR_CSS}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>${cover}${mercadoSection}${redeSection}${gestaoSection}${ctaSection}<footer class="footer"><div class="footer-left">HertzGo · CNPJ 27.713.035/0001-24 · Brasília · DF<br>Gerado em ${new Date().toLocaleString("pt-BR")}</div><div class="footer-right">Confidencial · Investidores & Parceiros<br>Vision v5.2 · (61) 99803-7361</div></footer><script>document.querySelectorAll('.logo-block img').forEach(function(img){img.onerror=function(){this.style.display='none';var span=document.createElement('span');span.style.cssText='font-family:var(--font);font-size:22px;font-weight:800;color:#e8f0f8;letter-spacing:-.02em;';span.innerHTML='Hertz<span style="color:var(--green)">Go</span>';this.parentNode.insertBefore(span,this);};});</script></body></html>`;
}

function abrirHTMLv2(html:string,nome:string){const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${nome}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);}

function TabRelatorio({sessions,appState,onAddSessions}:{sessions:Session[];appState:AppState;onAddSessions:(s:Session[])=>void}){
  const isMobile=useIsMobile();
  const hubs=useMemo(()=>Array.from(new Set(sessions.filter(s=>!s.cancelled&&s.energy>0).map(s=>s.hubKey))).sort(),[sessions]);
  const[station,setStation]=useState(hubs[0]||"");
  const[gerando,setGerando]=useState<string|null>(null);
  const[addingCsv,setAddingCsv]=useState(false);
  const addRef=useRef<HTMLInputElement>(null);
  const processAddCsv=async(file:File)=>{
    setAddingCsv(true);
    try{let newSessions:Session[]=[];if(file.name.toLowerCase().match(/\.xlsx?$/)){const{sessions:s}=await parseMove(file);newSessions=s;}else{const text=await file.text();newSessions=parseSpott(text);}const existingKeys=new Set(sessions.map(s=>`${s.user}_${s.date.getTime()}_${s.value}`));const unique=newSessions.filter(s=>!existingKeys.has(`${s.user}_${s.date.getTime()}_${s.value}`));onAddSessions([...sessions,...unique]);}
    catch(e){alert("Erro: "+(e as Error).message);}
    setAddingCsv(false);
  };
  const hs=station?calcHealthScore(sessions,appState.dreConfigs[station]||null,station):null;
  const hsColor=hs?.status==="saudavel"?T.green:hs?.status==="atencao"?T.amber:T.red;
  const pad=isMobile?"16px 14px":"24px 28px";
  const gerar=async(tipo:"eu"|"socio"|"op"|"pitch")=>{
    setGerando(tipo);
    await new Promise(r=>setTimeout(r,80));
    try{
      let html="";
      if(tipo==="eu") html=gerarRelatorioEU(sessions,appState,station);
      else if(tipo==="socio") html=gerarRelatorioSocioV2(sessions,appState,station);
      else if(tipo==="op") html=gerarRelatorioOpV2(sessions,appState,station);
      else if(tipo==="pitch") html=gerarApresentacaoV2(sessions,appState);
      if(html) abrirHTMLv2(html,`hertzgo_${tipo}_${hubNome(station).replace(/\s+/g,"_")}`);
    }catch(e){console.error(e);alert("Erro ao gerar relatório: "+(e as Error).message);}
    setGerando(null);
  };
  return(
    <div style={{padding:pad}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:4}}>Relatórios & Apresentações</div>
          <div style={{fontFamily:T.sans,fontSize:18,fontWeight:700,color:T.text,marginBottom:4}}>Central de Relatórios</div>
          <div style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>{sessions.length} sessões carregadas</div>
        </div>
        <div>
          <button onClick={()=>addRef.current?.click()} disabled={addingCsv} style={{background:addingCsv?"rgba(255,255,255,0.04)":"rgba(0,229,160,0.1)",border:`1px solid ${addingCsv?'rgba(255,255,255,0.1)':'rgba(0,229,160,0.3)'}`,color:addingCsv?T.text3:T.green,padding:"8px 14px",borderRadius:10,fontFamily:T.sans,fontSize:12,fontWeight:700,cursor:addingCsv?"not-allowed":"pointer"}}>
            {addingCsv?"⏳":"➕ Adicionar CSV"}
          </button>
          <input ref={addRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])processAddCsv(e.target.files[0]);}}/>
        </div>
      </div>
      {/* Seletor estação — scroll horizontal */}
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>Estação (relatórios operacionais)</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
          {hubs.map(h=>{
            const cfg=appState.dreConfigs[h]||null;const hs2=calcHealthScore(sessions,cfg,h);
            const color=hs2.status==="saudavel"?T.green:hs2.status==="atencao"?T.amber:T.red;
            return(<div key={h} onClick={()=>setStation(h)} style={{background:station===h?`${color}10`:T.bg2,border:`1px solid ${station===h?color+"60":T.border}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",flexShrink:0,minWidth:120,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:station===h?color:"transparent"}}/>
              <div style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:T.text,marginBottom:3}}>{hubNome(h)}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{(ESTACAO_TIPO as Record<string,string>)[h]||"contratual"}</span><span style={{fontFamily:T.mono,fontSize:14,fontWeight:800,color}}>{hs2.total}</span></div>
            </div>);
          })}
        </div>
      </div>
      {/* Relatórios operacionais */}
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,letterSpacing:"0.18em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,paddingBottom:8,marginBottom:12}}>📊 Relatórios Operacionais</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
          {[
            {tipo:"eu" as const,icon:"💡",title:"Resumo Executivo",sub:"DRE + Investimento + Operação + Usuários + Metas + Plano de Ação",color:T.green},
            {tipo:"socio" as const,icon:"🤝",title:"Relatório Sócio",sub:"DRE + Distribuição + KPIs + Payback + Rentabilidade",color:T.amber},
            {tipo:"op" as const,icon:"🔧",title:"Relatório Operacional",sub:"Demanda & Uso + Usuários · Sem dados financeiros",color:T.blue},
          ].map(r=>(
            <div key={r.tipo} onClick={()=>!gerando&&gerar(r.tipo)} style={{background:T.bg2,border:`1px solid ${gerando===r.tipo?r.color+"60":T.border}`,borderRadius:12,padding:"16px",cursor:gerando?"not-allowed":"pointer",position:"relative",overflow:"hidden",minHeight:80}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:gerando===r.tipo?r.color:"transparent"}}/>
              <div style={{fontSize:18,marginBottom:6}}>{gerando===r.tipo?"⏳":r.icon}</div>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:gerando===r.tipo?r.color:T.text,marginBottom:3}}>{gerando===r.tipo?"Gerando...":r.title}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,lineHeight:1.5}}>{r.sub}</div>
            </div>
          ))}
          <div style={{background:`${hsColor}08`,border:`1px solid ${hsColor}25`,borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,marginBottom:3}}>Estação selecionada</div>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{hubNome(station)}</div>
            {hs&&<div style={{fontFamily:T.mono,fontSize:11,color:hsColor,marginTop:3}}>Health Score: {hs.total}/100</div>}
          </div>
        </div>
      </div>
      {/* Pitch */}
      <div>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.text3,letterSpacing:"0.18em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,paddingBottom:8,marginBottom:12}}>🚀 Apresentação para Investidores</div>
        <div onClick={()=>!gerando&&gerar("pitch")} style={{background:gerando==="pitch"?"rgba(0,229,160,0.06)":T.bg2,border:`1px solid ${gerando==="pitch"?T.green+"60":"rgba(0,229,160,0.2)"}`,borderRadius:12,padding:"20px",cursor:gerando?"not-allowed":"pointer",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:gerando==="pitch"?T.green:"rgba(0,229,160,0.3)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <span style={{fontSize:28}}>{gerando==="pitch"?"⏳":"🚀"}</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:T.sans,fontSize:15,fontWeight:700,color:gerando==="pitch"?T.green:T.text,marginBottom:3}}>{gerando==="pitch"?"Gerando Apresentação...":"Pitch da Rede HertzGo"}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>Mercado EV · Rede · Gestão · Modelo de negócio · (61) 99803-7361</div>
            </div>
            <div style={{fontFamily:T.mono,fontSize:11,color:T.green,border:`1px solid ${T.green}40`,padding:"5px 14px",borderRadius:8}}>Gerar HTML</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
// ─── TAB GOALS & INTELIGÊNCIA ────────────────────────────────────────────────
function TabGoals({sessions,appState,onSave}:{sessions:Session[];appState:AppState;onSave:(p:Partial<AppState>)=>void}){
  const isMobile=useIsMobile();
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0&&s.value>0);
  const pad=isMobile?"16px 14px":"24px 28px";

  const allTs=ok.map(s=>s.date.getTime());
  const maxTs=allTs.length?Math.max(...allTs):Date.now();
  const maxDay=new Date(maxTs);maxDay.setHours(0,0,0,0);
  const mesAtual=maxDay.getMonth();
  const anoAtual=maxDay.getFullYear();
  const mesAnteriorDate=new Date(anoAtual,mesAtual-1,1);

  const mauAtual=new Set(ok.filter(s=>s.date.getMonth()===mesAtual&&s.date.getFullYear()===anoAtual).map(s=>s.user)).size;
  const mauAnterior=new Set(ok.filter(s=>s.date.getMonth()===mesAnteriorDate.getMonth()&&s.date.getFullYear()===mesAnteriorDate.getFullYear()).map(s=>s.user)).size;
  const mauDelta=mauAtual-mauAnterior;
  const todosUsers=Array.from(new Set(ok.map(s=>s.user)));

  const primeiraRecarga:Record<string,number>={};
  ok.forEach(s=>{if(!primeiraRecarga[s.user]||s.date.getTime()<primeiraRecarga[s.user])primeiraRecarga[s.user]=s.date.getTime();});
  const novosEsteMes=todosUsers.filter(u=>{const d=new Date(primeiraRecarga[u]);return d.getMonth()===mesAtual&&d.getFullYear()===anoAtual;}).length;

  const ativosAnterior=new Set(ok.filter(s=>s.date.getMonth()===mesAnteriorDate.getMonth()&&s.date.getFullYear()===mesAnteriorDate.getFullYear()).map(s=>s.user));
  const ativosAtual=new Set(ok.filter(s=>s.date.getMonth()===mesAtual&&s.date.getFullYear()===anoAtual).map(s=>s.user));
  const churnedEsteMes=Array.from(ativosAnterior).filter(u=>!ativosAtual.has(u)).length;
  const taxaChurn=mauAnterior>0?(churnedEsteMes/mauAnterior*100):0;
  const taxaRetencao=mauAnterior>0?((mauAnterior-churnedEsteMes)/mauAnterior*100):100;

  const userStats:Record<string,{rev:number;sess:number;firstTs:number;lastTs:number}>={};
  ok.forEach(s=>{
    if(!userStats[s.user])userStats[s.user]={rev:0,sess:0,firstTs:s.date.getTime(),lastTs:s.date.getTime()};
    userStats[s.user].rev+=s.value;userStats[s.user].sess++;
    if(s.date.getTime()<userStats[s.user].firstTs)userStats[s.user].firstTs=s.date.getTime();
    if(s.date.getTime()>userStats[s.user].lastTs)userStats[s.user].lastTs=s.date.getTime();
  });

  const usuarios=classificarUsuarios(ok);
  const motoristas=usuarios.filter(u=>u.isMotorista);
  const heavys=usuarios.filter(u=>u.isHeavy&&!u.isMotorista);
  const shoppers=usuarios.filter(u=>!u.isMotorista&&!u.isHeavy&&!u.isParceiro);

  const calcLTV=(users:UserData[])=>{
    if(users.length===0)return{real:0,proj:0,ticket:0,freqMes:0};
    const stats=users.map(u=>userStats[u.user]).filter(Boolean);
    const revTotal=stats.reduce((a,s)=>a+s.rev,0);
    const sessTotal=stats.reduce((a,s)=>a+s.sess,0);
    const ticket=sessTotal>0?revTotal/sessTotal:0;
    const periodoMeses=Math.max(1,(maxTs-Math.min(...stats.map(s=>s.firstTs)))/2592000000);
    const freqMes=sessTotal/(users.length*periodoMeses);
    return{real:revTotal/users.length,proj:ticket*freqMes*12,ticket,freqMes};
  };
  const ltvM=calcLTV(motoristas),ltvH=calcLTV(heavys),ltvS=calcLTV(shoppers);

  const revSeg=(seg:UserData[])=>ok.filter(s=>s.date.getMonth()===mesAtual&&s.date.getFullYear()===anoAtual&&seg.some(u=>u.user===s.user)).reduce((a,s)=>a+s.value,0);
  const revMot=revSeg(motoristas),revHvy=revSeg(heavys),revShp=revSeg(shoppers);
  const revTot=revMot+revHvy+revShp||1;

  const hubsAll=Array.from(new Set(ok.map(s=>s.hubKey)));
  const mauHub=hubsAll.map(h=>{
    const m=new Set(ok.filter(s=>s.hubKey===h&&s.date.getMonth()===mesAtual&&s.date.getFullYear()===anoAtual).map(s=>s.user)).size;
    const ma=new Set(ok.filter(s=>s.hubKey===h&&s.date.getMonth()===mesAnteriorDate.getMonth()&&s.date.getFullYear()===mesAnteriorDate.getFullYear()).map(s=>s.user)).size;
    return{hub:h,mau:m,delta:m-ma};
  }).sort((a,b)=>b.mau-a.mau);

  const churnRisco=todosUsers.map(u=>{
    const s=userStats[u];if(!s)return null;
    const dias=Math.round((maxTs-s.lastTs)/86400000);
    const score=dias>21?"crit":dias>14?"warn":dias>7?"watch":"ok";
    if(score==="ok")return null;
    const seg=motoristas.find(m=>m.user===u)?"Motorista":heavys.find(h=>h.user===u)?"Heavy":"Shopper";
    return{user:u,dias,score,seg,rev:s.rev,sess:s.sess};
  }).filter(Boolean).sort((a,b)=>b!.dias-a!.dias) as {user:string;dias:number;score:string;seg:string;rev:number;sess:number}[];

  const mesNome=maxDay.toLocaleDateString("pt-BR",{month:"long"});
  const sCol=(s:string)=>s==="crit"?T.red:s==="warn"?T.amber:s==="watch"?"#fb923c":T.green;
  const sLbl=(s:string)=>s==="crit"?"🔴 Crítico":s==="warn"?"🟡 Atenção":s==="watch"?"🟠 Observar":"🟢 Ativo";

  return(
    <div style={{padding:pad}}>
      <SectionLabel>Base Ativa — {mesNome}</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:24}}>
        <KpiCard label="MAU" value={`${mauAtual}`} sub={`${mauDelta>=0?"+":""}${mauDelta} vs mês ant.`} accent={mauDelta>=0?T.green:T.red}/>
        <KpiCard label="Novos" value={`${novosEsteMes}`} sub="1ª recarga este mês" accent={T.teal}/>
        <KpiCard label="Churn" value={`${churnedEsteMes}`} sub={`${taxaChurn.toFixed(1)}% da base`} accent={churnedEsteMes>0?T.amber:T.green}/>
        <KpiCard label="Retenção" value={`${taxaRetencao.toFixed(0)}%`} sub="vs mês anterior" accent={taxaRetencao>=80?T.green:taxaRetencao>=60?T.amber:T.red}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:24}}>
        <Panel>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:16}}>📈 Crescimento da Base</div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:10}}>
            <div style={{flex:novosEsteMes||1,height:28,background:`${T.green}25`,borderRadius:"6px 0 0 6px",display:"flex",alignItems:"center",justifyContent:"center",minWidth:40}}>
              <span style={{fontFamily:T.mono,fontSize:11,color:T.green,fontWeight:700}}>+{novosEsteMes}</span>
            </div>
            <div style={{flex:churnedEsteMes||1,height:28,background:`${T.red}25`,borderRadius:"0 6px 6px 0",display:"flex",alignItems:"center",justifyContent:"center",minWidth:40}}>
              <span style={{fontFamily:T.mono,fontSize:11,color:T.red,fontWeight:700}}>-{churnedEsteMes}</span>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:14}}>
            <span style={{color:T.green}}>✅ Novos</span>
            <span style={{color:T.red}}>❌ Não voltaram</span>
          </div>
          <div style={{background:T.bg3,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>
            <div style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>Saldo · <span style={{color:mauDelta>=0?T.green:T.red,fontWeight:700}}>{mauDelta>=0?"+":""}{mauDelta}</span></div>
            <div style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>Histórico · <span style={{color:T.text,fontWeight:700}}>{todosUsers.length}</span></div>
          </div>
        </Panel>
        <Panel>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:14}}>🏪 MAU por Estação</div>
          {mauHub.map(h=>(
            <div key={h.hub} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>{trunc(hubNome(h.hub),16)}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontFamily:T.mono,fontSize:11,color:T.text,fontWeight:700}}>{h.mau}</span>
                  {h.delta!==0&&<span style={{fontFamily:T.mono,fontSize:9,color:h.delta>0?T.green:T.red}}>{h.delta>0?"+":""}{h.delta}</span>}
                </div>
              </div>
              <div style={{height:4,background:T.bg3,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${mauHub[0].mau>0?(h.mau/mauHub[0].mau*100):0}%`,background:T.green,borderRadius:2}}/>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <SectionLabel>LTV — Valor por Usuário</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12,marginBottom:24}}>
        {[{seg:"Motorista",cor:T.red,qtd:motoristas.length,ltv:ltvM},{seg:"Heavy",cor:T.amber,qtd:heavys.length,ltv:ltvH},{seg:"Shopper",cor:T.green,qtd:shoppers.length,ltv:ltvS}].map(s=>(
          <div key={s.seg} style={{background:T.bg2,border:`1px solid ${s.cor}30`,borderRadius:14,padding:"16px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:s.cor}}/>
            <div style={{fontFamily:T.mono,fontSize:9,color:s.cor,letterSpacing:"0.15em",textTransform:"uppercase" as const,marginBottom:4}}>{s.seg} · {s.qtd}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{background:T.bg3,borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.text2,marginBottom:3}}>LTV Real</div>
                <div style={{fontFamily:T.sans,fontSize:16,fontWeight:800,color:s.cor}}>{brl(s.ltv.real)}</div>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.text3}}>gasto médio</div>
              </div>
              <div style={{background:T.bg3,borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.text2,marginBottom:3}}>Proj. 12m</div>
                <div style={{fontFamily:T.sans,fontSize:16,fontWeight:800,color:T.text}}>{brl(s.ltv.proj)}</div>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.text3}}>potencial anual</div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:10,color:T.text2}}>
              <span>Ticket <strong style={{color:T.text}}>{brl(s.ltv.ticket)}</strong></span>
              <span>Freq <strong style={{color:T.text}}>{s.ltv.freqMes.toFixed(1)}x/mês</strong></span>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Receita por Segmento — {mesNome}</SectionLabel>
      <Panel style={{marginBottom:24}}>
        {[{seg:"Motoristas",rev:revMot,cor:T.red,qtd:motoristas.length},{seg:"Heavy Users",rev:revHvy,cor:T.amber,qtd:heavys.length},{seg:"Shoppers",rev:revShp,cor:T.green,qtd:shoppers.length}].map(s=>(
          <div key={s.seg} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:2,background:s.cor}}/>
                <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{s.seg}</span>
                <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>({s.qtd})</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{(s.rev/revTot*100).toFixed(0)}%</span>
                <span style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:s.cor}}>{brl(s.rev)}</span>
              </div>
            </div>
            <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(s.rev/revTot*100)}%`,background:s.cor,borderRadius:3}}/>
            </div>
          </div>
        ))}
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:11,color:T.text2}}>
          <span>Total {mesNome}</span><span style={{color:T.green,fontWeight:700}}>{brl(revTot)}</span>
        </div>
      </Panel>

      <SectionLabel>⚠️ Receita em Risco — Churn</SectionLabel>
      {(()=>{
        // Calcular receita em risco por segmento
        const motRisco=churnRisco.filter(u=>u.seg==="Motorista");
        const hvyRisco=churnRisco.filter(u=>u.seg==="Heavy");
        const shpRisco=churnRisco.filter(u=>u.seg==="Shopper");
        const recRiscoMot=motRisco.reduce((a,u)=>a+(ltvM.proj||0),0);
        const recRiscoHvy=hvyRisco.reduce((a,u)=>a+(ltvH.proj||0),0);
        const recRiscoShp=shpRisco.reduce((a,u)=>a+(ltvS.proj||0),0);
        const totalRisco=recRiscoMot+recRiscoHvy+recRiscoShp;
        const custoRecuperacao=churnRisco.length*50; // desconto médio estimado R$50
        const roi=custoRecuperacao>0?(totalRisco/custoRecuperacao):0;
        return churnRisco.length===0?(
          <Panel style={{marginBottom:24}}>
            <div style={{textAlign:"center" as const,padding:"20px 0",fontFamily:T.mono,fontSize:12,color:T.green}}>✅ Nenhum usuário em risco — base saudável</div>
          </Panel>
        ):(
          <>
            {/* Cards de receita em risco */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12,marginBottom:16}}>
              {[
                {seg:"Motoristas",qtd:motRisco.length,rec:recRiscoMot,cor:T.red,dias:motRisco[0]?.dias||0},
                {seg:"Heavy Users",qtd:hvyRisco.length,rec:recRiscoHvy,cor:T.amber,dias:hvyRisco[0]?.dias||0},
                {seg:"Shoppers",qtd:shpRisco.length,rec:recRiscoShp,cor:T.green,dias:shpRisco[0]?.dias||0},
              ].filter(s=>s.qtd>0).map(s=>(
                <div key={s.seg} style={{background:T.bg2,border:`1px solid ${s.cor}30`,borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:s.cor}}/>
                  <div style={{fontFamily:T.mono,fontSize:9,color:s.cor,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:6}}>{s.seg}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
                    <div>
                      <div style={{fontFamily:T.sans,fontSize:20,fontWeight:800,color:s.cor}}>{s.qtd}</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.text2}}>em risco · {s.dias}d+ sem recarregar</div>
                    </div>
                    <div style={{textAlign:"right" as const}}>
                      <div style={{fontFamily:T.sans,fontSize:16,fontWeight:700,color:T.text}}>{brl(s.rec)}</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.text2}}>receita anual em risco</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* ROI de recuperação */}
            <Panel style={{marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
                <div style={{background:T.bg3,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,marginBottom:4}}>Total em Risco</div>
                  <div style={{fontFamily:T.sans,fontSize:18,fontWeight:800,color:T.red}}>{brl(totalRisco)}</div>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>receita anual projetada</div>
                </div>
                <div style={{background:T.bg3,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,marginBottom:4}}>Custo de Recuperação</div>
                  <div style={{fontFamily:T.sans,fontSize:18,fontWeight:800,color:T.amber}}>{brl(custoRecuperacao)}</div>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>~R$50 desconto/usuário</div>
                </div>
                <div style={{background:T.bg3,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,marginBottom:4}}>ROI da Ação</div>
                  <div style={{fontFamily:T.sans,fontSize:18,fontWeight:800,color:roi>=10?T.green:T.amber}}>{roi.toFixed(0)}x</div>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>retorno sobre o investimento</div>
                </div>
                <div style={{background:`${T.green}08`,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.green}30`}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.green,marginBottom:4}}>Ação Recomendada</div>
                  <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>Disparar MSG Risco</div>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,marginTop:2}}>{churnRisco.length} usuários · ir para Ações</div>
                </div>
              </div>
              {/* Lista resumida top riscos */}
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>Top usuários em risco por LTV:</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {churnRisco.slice(0,5).map(u=>{
                  const cor=sCol(u.score);
                  const ltvU=u.seg==="Motorista"?ltvM.proj:u.seg==="Heavy"?ltvH.proj:ltvS.proj;
                  return(
                    <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:T.bg3,borderRadius:8,border:`1px solid ${cor}20`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:T.mono,fontSize:10,padding:"2px 6px",borderRadius:4,background:`${cor}15`,color:cor}}>{sLbl(u.score)}</span>
                        <span style={{fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,isMobile?14:24)}</span>
                        <span style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{u.seg}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontFamily:T.mono,fontSize:10,color:cor,fontWeight:700}}>{u.dias}d</span>
                        <span style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{brl(ltvU)}/ano</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {churnRisco.length>5&&<div style={{textAlign:"center" as const,fontFamily:T.mono,fontSize:10,color:T.text3,marginTop:8}}>+{churnRisco.length-5} outros em risco</div>}
            </Panel>
          </>
        );
      })()}

      {/* ── 1. RESULTADOS DAS CAMPANHAS ──────────────────────────────────── */}
      <SectionLabel>📊 Resultados das Campanhas</SectionLabel>
      {(()=>{
        const disparos=appState.disparos||[];
        const enviados=disparos.filter(d=>d.status==="ok");
        if(enviados.length===0)return(
          <Panel style={{marginBottom:24}}><div style={{textAlign:"center" as const,padding:"20px",fontFamily:T.mono,fontSize:11,color:T.text3}}>Nenhum disparo registrado ainda</div></Panel>
        );
        // Cruzar disparos com sessões posteriores
        const convertidos=enviados.filter(d=>{
          const tsDisparo=new Date(d.ts).getTime();
          return ok.some(s=>s.user===d.nome&&s.date.getTime()>tsDisparo);
        });
        // respostas são processadas via webhook — usar disparos como proxy
        const responderam=enviados.filter(d=>ok.some(s=>s.user===d.nome)).length;
        const taxaResposta=enviados.length>0?(responderam/enviados.length*100):0;
        const taxaConversao=enviados.length>0?(convertidos.length/enviados.length*100):0;
        // Tempo médio de retorno
        const temposRetorno=convertidos.map(d=>{
          const tsDisparo=new Date(d.ts).getTime();
          const primeiraApos=ok.filter(s=>s.user===d.nome&&s.date.getTime()>tsDisparo).sort((a,b)=>a.date.getTime()-b.date.getTime())[0];
          return primeiraApos?(primeiraApos.date.getTime()-tsDisparo)/86400000:null;
        }).filter(Boolean) as number[];
        const tempoMedio=temposRetorno.length>0?temposRetorno.reduce((a,b)=>a+b,0)/temposRetorno.length:0;
        // Receita gerada pós-campanha
        const receitaPos=convertidos.reduce((a,d)=>{
          const tsDisparo=new Date(d.ts).getTime();
          return a+ok.filter(s=>s.user===d.nome&&s.date.getTime()>tsDisparo).reduce((b,s)=>b+s.value,0);
        },0);
        return(
          <>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
              {[
                {label:"Enviados",val:`${enviados.length}`,sub:"total de disparos",cor:T.text},
                {label:"Convertidos",val:`${convertidos.length}`,sub:`${taxaConversao.toFixed(0)}% voltaram a carregar`,cor:T.green},
                {label:"Tempo Médio",val:tempoMedio>0?`${tempoMedio.toFixed(1)}d`:"—",sub:"dias até retornar",cor:T.amber},
                {label:"Receita Gerada",val:brl(receitaPos),sub:"pós-campanha",cor:T.teal},
              ].map((k,i)=>(
                <div key={i} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:k.cor}}/>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>{k.label}</div>
                  <div style={{fontFamily:T.sans,fontSize:22,fontWeight:800,color:k.cor,marginBottom:4}}>{k.val}</div>
                  <div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{k.sub}</div>
                </div>
              ))}
            </div>
            {/* Top convertidos */}
            {convertidos.length>0&&(
              <Panel style={{marginBottom:24}}>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>✅ Usuários que retornaram após contato</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                  {convertidos.slice(0,5).map(d=>{
                    const tsDisparo=new Date(d.ts).getTime();
                    const sessApos=ok.filter(s=>s.user===d.nome&&s.date.getTime()>tsDisparo);
                    const receitaU=sessApos.reduce((a,s)=>a+s.value,0);
                    const diasRet=sessApos.length>0?Math.round((sessApos[0].date.getTime()-tsDisparo)/86400000):0;
                    return(
                      <div key={d.ts+d.nome} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:T.bg3,borderRadius:8,border:"1px solid rgba(0,229,160,0.15)"}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:500,color:T.text}}>{trunc(d.nome,isMobile?16:28)}</div>
                          <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>retornou em {diasRet}d · {sessApos.length} sess</div>
                        </div>
                        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.green}}>{brl(receitaU)}</div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </>
        );
      })()}

      {/* ── 2. MELHOR HORÁRIO DE DISPARO ─────────────────────────────────── */}
      <SectionLabel>⏰ Melhor Horário de Disparo</SectionLabel>
      {(()=>{
        // Calcular taxa de resposta por hora de início de sessão
        const horaDist=Array(24).fill(0).map(()=>({sess:0,rev:0}));
        ok.forEach(s=>{if(s.startHour!==null){horaDist[s.startHour].sess++;horaDist[s.startHour].rev+=s.value;}});
        const maxSess=Math.max(...horaDist.map(h=>h.sess),1);
        // Motoristas por hora
        const motoristasSet=new Set(classificarUsuarios(ok).filter(u=>u.isMotorista).map(u=>u.user));
        const horaMotoristas=Array(24).fill(0);
        ok.filter(s=>motoristasSet.has(s.user)).forEach(s=>{if(s.startHour!==null)horaMotoristas[s.startHour]++;});
        const maxMot=Math.max(...horaMotoristas,1);
        // Top 3 horas
        const topHoras=horaDist.map((h,i)=>({hora:i,sess:h.sess,mot:horaMotoristas[i]})).sort((a,b)=>b.mot-a.mot).slice(0,3);
        return(
          <Panel style={{marginBottom:24}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Atividade dos motoristas por hora do dia</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:14}}>
              Melhores horários para disparar: {topHoras.map(h=>`${h.hora}h`).join(" · ")}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:2,marginBottom:4}}>
              {horaMotoristas.map((mot,hr)=>{
                const pct=maxMot>0?(mot/maxMot*100):0;
                const isTop=topHoras.some(t=>t.hora===hr);
                return(
                  <div key={hr} title={`${hr}h: ${mot} motoristas`} style={{height:isMobile?32:44,borderRadius:4,background:isTop?`${T.green}`:pct>50?"rgba(0,229,160,0.35)":pct>20?"rgba(0,229,160,0.15)":"rgba(255,255,255,0.04)",display:"flex",alignItems:"flex-end",justifyContent:"center",position:"relative",cursor:"default"}}>
                    {isTop&&<div style={{position:"absolute",top:2,width:"100%",textAlign:"center" as const,fontFamily:T.mono,fontSize:7,color:T.bg,fontWeight:700}}>★</div>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:2,marginBottom:14}}>
              {Array.from({length:24},(_,hr)=>(<div key={hr} style={{fontSize:7,color:T.text3,textAlign:"center" as const,fontFamily:T.mono}}>{hr%6===0?`${hr}h`:""}</div>))}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {topHoras.map(h=>(
                <div key={h.hora} style={{background:"rgba(0,229,160,0.08)",border:"1px solid rgba(0,229,160,0.2)",borderRadius:10,padding:"8px 14px",display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontFamily:T.sans,fontSize:18,fontWeight:800,color:T.green}}>{h.hora}h</span>
                  <div>
                    <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{h.mot} motoristas ativos</div>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>horário ideal p/ disparo</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })()}

      {/* ── 3. PREVISÃO DE CHURN ─────────────────────────────────────────── */}
      <SectionLabel>🔮 Previsão de Churn</SectionLabel>
      {(()=>{
        // Calcular frequência histórica por usuário e prever churn
        const previsoes=classificarUsuarios(ok).filter(u=>u.isMotorista||u.isHeavy).map(u=>{
          const uSess=ok.filter(s=>s.user===u.user).sort((a,b)=>a.date.getTime()-b.date.getTime());
          if(uSess.length<2)return null;
          // Intervalo médio entre sessões
          const intervalos:number[]=[];
          for(let i=1;i<uSess.length;i++){
            intervalos.push((uSess[i].date.getTime()-uSess[i-1].date.getTime())/86400000);
          }
          const intervaloMedio=intervalos.reduce((a,b)=>a+b,0)/intervalos.length;
          const ultimaTs=uSess[uSess.length-1].date.getTime();
          const diasSem=Math.round((maxTs-ultimaTs)/86400000);
          // Probabilidade de churn baseada em desvio da frequência
          const desvio=diasSem/intervaloMedio;
          const probChurn=Math.min(100,Math.round((desvio-1)*50));
          if(probChurn<20)return null; // só mostra quem tem risco real
          const previsaoRetorno=new Date(ultimaTs+(intervaloMedio*86400000));
          const atrasoDias=Math.max(0,diasSem-intervaloMedio);
          return{
            user:u.user,seg:u.isMotorista?"Motorista":"Heavy",
            intervaloMedio:intervaloMedio.toFixed(1),
            diasSem,probChurn,previsaoRetorno,atrasoDias:atrasoDias.toFixed(0),
            ltv:ok.filter(s=>s.user===u.user).reduce((a,s)=>a+s.value,0),
          };
        }).filter(Boolean).sort((a,b)=>b!.probChurn-a!.probChurn) as {user:string;seg:string;intervaloMedio:string;diasSem:number;probChurn:number;previsaoRetorno:Date;atrasoDias:string;ltv:number}[];

        if(previsoes.length===0)return(
          <Panel style={{marginBottom:24}}><div style={{textAlign:"center" as const,padding:"20px",fontFamily:T.mono,fontSize:11,color:T.green}}>✅ Nenhum usuário com risco elevado de churn</div></Panel>
        );
        return(
          <Panel style={{marginBottom:24}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Probabilidade de não retornar baseada na frequência histórica</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:14}}>Frequência esperada vs dias sem recarregar</div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?420:undefined}}>
                <thead><tr style={{background:T.bg3}}>
                  <th style={TH}>Usuário</th>
                  <th style={TH}>Segmento</th>
                  <th style={THR}>Freq. média</th>
                  <th style={THR}>Dias sem</th>
                  <th style={THR}>Risco</th>
                  <th style={THR}>LTV</th>
                </tr></thead>
                <tbody>
                  {previsoes.slice(0,10).map(p=>{
                    const cor=p.probChurn>=75?T.red:p.probChurn>=50?T.amber:"#fb923c";
                    return(
                      <tr key={p.user} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                        <td style={TD}><div style={{fontWeight:500,fontSize:12}}>{trunc(p.user,isMobile?14:22)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>esperado a cada {p.intervaloMedio}d</div></td>
                        <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 6px",borderRadius:4,background:p.seg==="Motorista"?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.15)",color:p.seg==="Motorista"?T.red:T.amber}}>{p.seg}</span></td>
                        <td style={{...TDR,color:T.text2,fontSize:11}}>{p.intervaloMedio}d</td>
                        <td style={{...TDR,color:cor,fontWeight:700}}>{p.diasSem}d</td>
                        <td style={TDR}>
                          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                            <div style={{width:40,height:5,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${p.probChurn}%`,background:cor,borderRadius:3}}/>
                            </div>
                            <span style={{fontFamily:T.mono,fontSize:11,color:cor,fontWeight:700,minWidth:32}}>{p.probChurn}%</span>
                          </div>
                        </td>
                        <td style={{...TDR,color:T.text2,fontSize:11}}>{brl(p.ltv)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {previsoes.length>10&&<div style={{textAlign:"center" as const,fontFamily:T.mono,fontSize:10,color:T.text3,padding:"10px 0"}}>+{previsoes.length-10} outros com risco elevado</div>}
          </Panel>
        );
      })()}

      {/* ── 4. ARGUMENTO COMERCIAL POR ESTAÇÃO ───────────────────────────── */}
      {/* ── INTELIGÊNCIA DE PREÇOS ──────────────────────────────────────── */}
      <SectionLabel>💰 Inteligência de Preços</SectionLabel>
      {(()=>{
        const concorrentes=appState.mercado?.concorrentes||[];
        const meuPrecoMedio=ok.reduce((a,s)=>a+s.value,0)/Math.max(1,ok.reduce((a,s)=>a+s.energy,0));
        const[novoConcorrente,setNovoConcorrente]=useState({nome:"",rede:"",precoKwh:0,tipo:"DC"});
        const[salvandoConc,setSalvandoConc]=useState(false);

        const adicionarConcorrente=()=>{
          if(!novoConcorrente.nome||!novoConcorrente.precoKwh)return;
          const updated=[...concorrentes,{...novoConcorrente,lat:undefined,lng:undefined,atualizadoEm:new Date().toISOString()}];
          onSave({mercado:{...appState.mercado,concorrentes:updated}});
          setNovoConcorrente({nome:"",rede:"",precoKwh:0,tipo:"DC"});
          setSalvandoConc(true);setTimeout(()=>setSalvandoConc(false),1500);
        };

        const removerConcorrente=(i:number)=>{
          const updated=concorrentes.filter((_:typeof concorrentes[0],j:number)=>j!==i);
          onSave({mercado:{...appState.mercado,concorrentes:updated}});
        };

        const precoMedioConc=concorrentes.length>0?concorrentes.reduce((a:number,c:typeof concorrentes[0])=>a+c.precoKwh,0)/concorrentes.length:0;
        const diffPct=precoMedioConc>0?((meuPrecoMedio-precoMedioConc)/precoMedioConc*100):0;
        const posicao=diffPct>5?"acima da média":diffPct<-5?"abaixo da média":"na média";
        const posicaoCor=diffPct>5?T.green:diffPct<-5?T.red:T.amber;

        return(
          <>
            {/* Resumo posicionamento */}
            {concorrentes.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"Seu Preço Médio",val:`R$${meuPrecoMedio.toFixed(2)}/kWh`,cor:T.green},
                  {label:"Média Concorrência",val:`R$${precoMedioConc.toFixed(2)}/kWh`,cor:T.text},
                  {label:"Posicionamento",val:`${diffPct>0?"+":""}${diffPct.toFixed(1)}% ${posicao}`,cor:posicaoCor},
                ].map((k,i)=>(
                  <div key={i} style={{background:T.bg2,border:`1px solid ${k.cor}30`,borderRadius:12,padding:"12px 16px",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:k.cor}}/>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,textTransform:"uppercase" as const,marginBottom:6}}>{k.label}</div>
                    <div style={{fontFamily:T.sans,fontSize:16,fontWeight:800,color:k.cor}}>{k.val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabela concorrentes */}
            {concorrentes.length>0&&(
              <Panel style={{marginBottom:16}}>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Concorrentes monitorados</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:T.bg3}}>
                      <th style={TH}>Estação</th><th style={TH}>Rede</th><th style={TH}>Tipo</th>
                      <th style={THR}>R$/kWh</th><th style={THR}>vs Meu</th><th style={TH}>Atualizado</th><th style={TH}></th>
                    </tr></thead>
                    <tbody>
                      {concorrentes.map((c:typeof concorrentes[0],i:number)=>{
                        const diff=meuPrecoMedio-c.precoKwh;
                        const diffCor=diff>0?T.green:diff<0?T.red:T.amber;
                        return(
                          <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                            <td style={TD}><span style={{fontSize:12,fontWeight:500}}>{c.nome}</span></td>
                            <td style={{...TD,color:T.text2,fontSize:11}}>{c.rede||"—"}</td>
                            <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 6px",borderRadius:4,background:`${T.border}`,color:T.text2}}>{c.tipo}</span></td>
                            <td style={{...TDR,color:T.text,fontWeight:700}}>R${c.precoKwh.toFixed(2)}</td>
                            <td style={{...TDR,color:diffCor,fontSize:11}}>{diff>0?"+":""}{diff.toFixed(2)}</td>
                            <td style={{...TD,fontSize:10,color:T.text3}}>{new Date(c.atualizadoEm).toLocaleDateString("pt-BR")}</td>
                            <td style={TDR}><button onClick={()=>removerConcorrente(i)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:T.red,padding:"3px 8px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:T.mono}}>×</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            {/* Formulário novo concorrente */}
            <Panel style={{marginBottom:24}}>
              <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text,marginBottom:10}}>➕ Adicionar concorrente</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8,marginBottom:10}}>
                {[
                  {label:"Nome da Estação",key:"nome",type:"text"},
                  {label:"Rede (Spott/Move)",key:"rede",type:"text"},
                  {label:"Preço R$/kWh",key:"precoKwh",type:"number"},
                  {label:"Tipo",key:"tipo",type:"select"},
                ].map(f=>(
                  <div key={f.key}>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,marginBottom:3}}>{f.label}</div>
                    {f.type==="select"?(
                      <select value={novoConcorrente.tipo} onChange={e=>setNovoConcorrente(p=>({...p,tipo:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"7px 9px",borderRadius:8,fontSize:12,fontFamily:T.mono,boxSizing:"border-box" as const}}>
                        <option>DC</option><option>AC</option><option>DC+AC</option>
                      </select>
                    ):(
                      <input type={f.type} value={(novoConcorrente as Record<string,string|number>)[f.key]} placeholder={f.label} onChange={e=>setNovoConcorrente(p=>({...p,[f.key]:f.type==="number"?+e.target.value:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"7px 9px",borderRadius:8,fontSize:12,fontFamily:T.mono,boxSizing:"border-box" as const}}/>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={adicionarConcorrente} style={{background:salvandoConc?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${salvandoConc?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>
                {salvandoConc?"✅ Adicionado!":"💾 Salvar"}
              </button>
            </Panel>
          </>
        );
      })()}

      {/* ── MAPA DE OPORTUNIDADES ─────────────────────────────────────────── */}
      <SectionLabel>🗺️ Mapa de Oportunidades — Brasília</SectionLabel>
      {(()=>{
        const[buscandoOCM,setBuscandoOCM]=useState(false);
        const[ocmErro,setOcmErro]=useState("");
        const estacoesOCM=appState.mercado?.estacoesOCM||[];
        const ocmAtualizado=appState.mercado?.ocmAtualizadoEm;

        const buscarOCM=async()=>{
          setBuscandoOCM(true);setOcmErro("");
          try{
            // Open Charge Map API — gratuita, sem autenticação necessária para uso básico
            // Brasília: lat -15.7801, lng -47.9292, raio 50km
            const res=await fetch("https://api.openchargemap.io/v3/poi/?output=json&countrycode=BR&latitude=-15.7801&longitude=-47.9292&distance=50&distanceunit=km&maxresults=200&compact=true&verbose=false");
            if(!res.ok)throw new Error("Erro na API");
            const data=await res.json();
            const estacoes=data.map((e:Record<string,unknown>)=>({
              nome:(e.AddressInfo as Record<string,unknown>)?.Title as string||"Sem nome",
              lat:(e.AddressInfo as Record<string,unknown>)?.Latitude as number||0,
              lng:(e.AddressInfo as Record<string,unknown>)?.Longitude as number||0,
              rede:((e.OperatorInfo as Record<string,unknown>)?.Title as string)||"Desconhecida",
              tipo:(((e.Connections as Record<string,unknown>[])?.[0] as Record<string,unknown>)?.ConnectionType as Record<string,unknown>)?.Title as string||"AC",
            }));
            onSave({mercado:{...appState.mercado,estacoesOCM:estacoes,ocmAtualizadoEm:new Date().toISOString()}});
            setBuscandoOCM(false);
          }catch(e){
            setOcmErro("Erro ao buscar dados. Tente novamente.");
            setBuscandoOCM(false);
          }
        };

        // Calcular densidade por região (grid simplificado)
        const minhasPosicoes=[
          {nome:"Park Way",lat:-15.8674,lng:-47.9869},
          {nome:"Cidade do Automóvel",lat:-15.8274,lng:-47.9369},
          {nome:"Costa Atacadão",lat:-15.8374,lng:-48.0469},
        ];

        // Redes mais presentes
        const redesCount:Record<string,number>={};
        estacoesOCM.forEach((e:typeof estacoesOCM[0])=>{redesCount[e.rede]=(redesCount[e.rede]||0)+1;});
        const topRedes=Object.entries(redesCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

        return(
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>
                  {estacoesOCM.length>0?`${estacoesOCM.length} estações encontradas em Brasília`:"Dados não carregados"}
                </div>
                {ocmAtualizado&&<div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>Atualizado: {new Date(ocmAtualizado).toLocaleDateString("pt-BR")}</div>}
              </div>
              <button onClick={buscarOCM} disabled={buscandoOCM} style={{padding:"8px 18px",borderRadius:10,fontFamily:T.sans,fontSize:12,fontWeight:600,cursor:"pointer",background:T.greenDim,border:"1px solid rgba(0,229,160,0.3)",color:T.green}}>
                {buscandoOCM?"⏳ Buscando...":"🔄 Buscar Estações de Brasília"}
              </button>
            </div>
            {ocmErro&&<div style={{fontFamily:T.mono,fontSize:11,color:T.red,marginBottom:12}}>{ocmErro}</div>}

            {estacoesOCM.length>0&&(
              <>
                {/* KPIs do mercado */}
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[
                    {label:"Estações no DF",val:`${estacoesOCM.length}`,cor:T.blue},
                    {label:"Suas Estações",val:`${minhasPosicoes.length}`,cor:T.green},
                    {label:"Market Share",val:`${(minhasPosicoes.length/Math.max(1,estacoesOCM.length)*100).toFixed(1)}%`,cor:T.teal},
                    {label:"Redes Ativas",val:`${Object.keys(redesCount).length}`,cor:T.amber},
                  ].map((k,i)=>(
                    <div key={i} style={{background:T.bg2,border:`1px solid ${k.cor}25`,borderRadius:12,padding:"12px 16px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:k.cor}}/>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,textTransform:"uppercase" as const,marginBottom:6}}>{k.label}</div>
                      <div style={{fontFamily:T.sans,fontSize:22,fontWeight:800,color:k.cor}}>{k.val}</div>
                    </div>
                  ))}
                </div>

                {/* Top redes concorrentes */}
                <Panel style={{marginBottom:16}}>
                  <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Principais redes no DF</div>
                  {topRedes.map(([rede,qtd])=>(
                    <div key={rede} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>{trunc(rede,24)}</span>
                        <span style={{fontFamily:T.mono,fontSize:11,color:T.text,fontWeight:700}}>{qtd} estações</span>
                      </div>
                      <div style={{height:4,background:T.bg3,borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${(qtd/estacoesOCM.length*100)}%`,background:T.blue,borderRadius:2}}/>
                      </div>
                    </div>
                  ))}
                </Panel>

                {/* Lista estações próximas às suas */}
                <Panel style={{marginBottom:24}}>
                  <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>Concorrentes próximos às suas estações</div>
                  <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:12}}>Estações de outras redes no raio de 5km</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?360:undefined}}>
                      <thead><tr style={{background:T.bg3}}>
                        <th style={TH}>Estação</th><th style={TH}>Rede</th><th style={TH}>Tipo</th><th style={THR}>Dist.</th>
                      </tr></thead>
                      <tbody>
                        {estacoesOCM.flatMap((e:typeof estacoesOCM[0])=>
                          minhasPosicoes.map(m=>{
                            const dist=Math.sqrt(Math.pow((e.lat-m.lat)*111,2)+Math.pow((e.lng-m.lng)*92,2));
                            return dist<5?{...e,distKm:dist.toFixed(1),minhaEstacao:m.nome}:null;
                          })
                        ).filter(Boolean).sort((a:Record<string,unknown>|null,b:Record<string,unknown>|null)=>+(a?.distKm||99)- +(b?.distKm||99)).slice(0,10).map((e:Record<string,unknown>|null,i:number)=>(
                          <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                            <td style={TD}><div style={{fontSize:12,fontWeight:500}}>{trunc(e?.nome as string||"",isMobile?14:22)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>perto de {e?.minhaEstacao as string}</div></td>
                            <td style={{...TD,fontSize:11,color:T.text2}}>{trunc(e?.rede as string||"",12)}</td>
                            <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 6px",borderRadius:4,background:T.border,color:T.text2}}>{e?.tipo as string}</span></td>
                            <td style={{...TDR,color:T.amber,fontSize:11}}>{e?.distKm as string}km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}

            {estacoesOCM.length===0&&!buscandoOCM&&(
              <Panel style={{marginBottom:24}}>
                <div style={{textAlign:"center" as const,padding:"20px",fontFamily:T.mono,fontSize:11,color:T.text3}}>
                  Clique em "Buscar Estações de Brasília" para carregar os dados do mercado
                </div>
              </Panel>
            )}
          </>
        );
      })()}

      <SectionLabel>🤝 Argumento Comercial por Estação</SectionLabel>
      {(()=>{
        const hubsAll=Array.from(new Set(ok.map(s=>s.hubKey)));
        return(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:24}}>
            {hubsAll.map(h=>{
              const hSess=ok.filter(s=>s.hubKey===h);
              const totalSess=hSess.length;
              const totalRev=hSess.reduce((a,s)=>a+s.value,0);
              const usuarios=new Set(hSess.map(s=>s.user)).size;
              const motoristasH=new Set(hSess.filter(s=>classificarUsuarios(ok).some(u=>u.user===s.user&&u.isMotorista)).map(s=>s.user)).size;
              const ticketMedio=totalSess>0?totalRev/totalSess:0;
              const datas=hSess.map(s=>s.date.getTime());
              const diasOp=datas.length?Math.round((Math.max(...datas)-Math.min(...datas))/86400000)+1:1;
              const revDia=totalRev/Math.max(1,diasOp);
              const tipo=hubTipo(h,appState.estacoesCustom);
              const tipoCor=tipo==="propria"?T.green:tipo==="parceria"?T.amber:T.blue;
              const tipoLabel=tipo==="propria"?"🏠 Própria":tipo==="parceria"?"🤝 Parceria":"📋 Contratual";
              return(
                <div key={h} style={{background:T.bg2,border:`1px solid ${tipoCor}25`,borderRadius:14,padding:"16px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:tipoCor}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:T.text}}>{hubNome(h)}</div>
                      <span style={{fontFamily:T.mono,fontSize:9,color:tipoCor}}>{tipoLabel}</span>
                    </div>
                    <div style={{textAlign:"right" as const}}>
                      <div style={{fontFamily:T.sans,fontSize:18,fontWeight:800,color:T.green}}>{brl(totalRev)}</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>receita total</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                    {[
                      {l:"Sessões",v:`${totalSess}`},
                      {l:"Usuários",v:`${usuarios}`},
                      {l:"Motoristas",v:`${motoristasH}`},
                    ].map((k,i)=>(
                      <div key={i} style={{background:T.bg3,borderRadius:8,padding:"8px 10px",textAlign:"center" as const}}>
                        <div style={{fontFamily:T.mono,fontSize:8,color:T.text2,marginBottom:2}}>{k.l}</div>
                        <div style={{fontFamily:T.sans,fontSize:16,fontWeight:700,color:T.text}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:`${tipoCor}08`,border:`1px solid ${tipoCor}20`,borderRadius:8,padding:"8px 12px",fontFamily:T.mono,fontSize:10,color:T.text2,lineHeight:1.6}}>
                    💬 <em>"{usuarios} clientes EV utilizaram este ponto em {diasOp} dias, com ticket médio de {brl(ticketMedio)} e receita de {brl(revDia)}/dia. {motoristasH} são motoristas profissionais."</em>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

    </div>
  );
}

export default function Home() {
  useFonts();
  usePWA();
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [appState, setAppState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>("dash");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSave = useCallback((partial: Partial<AppState>) => {
    setAppState(prev => {
      const next = { ...prev, ...partial };
      // deep merge dreConfigs e contatos
      if (partial.dreConfigs) next.dreConfigs = { ...prev.dreConfigs, ...partial.dreConfigs };
      if (partial.contatos) next.contatos = { ...prev.contatos, ...partial.contatos };
      if (partial.baseMestre) next.baseMestre = { ...prev.baseMestre, ...partial.baseMestre };
      if (partial.userOverrides) next.userOverrides = { ...prev.userOverrides, ...partial.userOverrides };
      saveState(next);
      return next;
    });
  }, []);

  const meta = appState.metas["global"] || 0;
  const onMetaChange = (v: number) => handleSave({ metas: { ...appState.metas, global: v } });

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dash",     label: "Dashboard",    icon: "📊" },
    { id: "goals",    label: "Inteligência", icon: "🧠" },
    { id: "acoes",    label: "Ações",        icon: "📤" },
    { id: "dre",      label: "DRE",          icon: "💼" },
    { id: "relatorio",label: "Relatórios",   icon: "📋" },
    { id: "config",   label: "Config",       icon: "⚙️"  },
  ];

  if (!sessions.length) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", color: T.text }}>
        <style>{`
          * { -webkit-tap-highlight-color: transparent; }
          input, textarea, select { outline: none; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
          @media (max-width: 767px) {
            body { font-size: 14px; }
          }
        `}</style>
        <UploadScreen onFile={setSessions} />
      </div>
    );
  }

  const activeLabel = TABS.find(t => t.id === tab)?.label || "";

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: T.sans }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input, textarea, select { outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        @media (max-width: 767px) {
          body { font-size: 14px; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(8,10,15,0.96)",
        borderBottom: `1px solid ${T.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        {isMobile ? (
          /* HEADER MOBILE */
          <div style={{ padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <HertzGoLogo size={28} />
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, letterSpacing: "0.15em", textTransform: "uppercase" }}>Vision</div>
                <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1 }}>{activeLabel}</div>
              </div>
            </div>
            {/* Botão hamburguer */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", color: T.text2, fontSize: 16, lineHeight: 1 }}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        ) : (
          /* HEADER DESKTOP */
          <div style={{ padding: "0 28px", height: 56, display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32 }}>
              <HertzGoLogo size={30} />
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.text3, letterSpacing: "0.18em", textTransform: "uppercase" }}>Vision v5.2</div>
            </div>
            <nav style={{ display: "flex", gap: 2, flex: 1 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: tab === t.id ? T.greenDim : "transparent",
                  color: tab === t.id ? T.green : T.text2,
                  fontFamily: T.mono, fontSize: 11, cursor: "pointer",
                  fontWeight: tab === t.id ? 600 : 400,
                  borderBottom: tab === t.id ? `2px solid ${T.green}` : "2px solid transparent",
                }}>{t.icon} {t.label}</button>
              ))}
            </nav>
            <button onClick={() => setSessions([])} style={{
              background: "transparent", border: `1px solid ${T.border}`, color: T.text3,
              padding: "5px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: T.mono,
            }}>↩ Novo</button>
          </div>
        )}

        {/* MENU MOBILE DROPDOWN */}
        {isMobile && menuOpen && (
          <div style={{
            position: "absolute", top: 56, left: 0, right: 0,
            background: T.bg1, borderBottom: `1px solid ${T.border}`,
            zIndex: 200, padding: "8px 16px 16px",
          }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setMenuOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "12px 14px", marginBottom: 4,
                borderRadius: 10, border: `1px solid ${tab === t.id ? T.green + "60" : T.border}`,
                background: tab === t.id ? T.greenDim : "transparent",
                color: tab === t.id ? T.green : T.text,
                fontFamily: T.sans, fontSize: 14, fontWeight: tab === t.id ? 700 : 400,
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 4 }}>
              <button onClick={() => { setSessions([]); setMenuOpen(false); }} style={{
                width: "100%", padding: "10px", borderRadius: 8,
                border: `1px solid ${T.border}`, background: "transparent",
                color: T.text3, fontFamily: T.mono, fontSize: 12, cursor: "pointer",
              }}>↩ Carregar novo CSV</button>
            </div>
          </div>
        )}
      </header>

      {/* ── CONTEÚDO DAS ABAS ── */}
      <main style={{ paddingBottom: isMobile ? 80 : 40 }}>
        {tab === "dash"      && <TabDashboard sessions={sessions} meta={meta} onMetaChange={onMetaChange} appState={appState} />}
        {tab === "dre"       && <TabDRE sessions={sessions} appState={appState} />}
        {tab === "acoes"     && <TabAcoes sessions={sessions} appState={appState} onSaveDisparos={d => handleSave({ disparos: d })} onSaveState={handleSave} />}
        {tab === "relatorio" && <TabRelatorio sessions={sessions} appState={appState} onAddSessions={setSessions} />}
        {tab === "config"    && <TabConfig appState={appState} onSave={handleSave} />}
        {tab === "goals"     && <TabGoals sessions={sessions} appState={appState} onSave={handleSave} />}
      </main>

      {/* ── BOTTOM NAV (MOBILE APENAS) ── */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "rgba(8,10,15,0.97)",
          borderTop: `1px solid ${T.border}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setMenuOpen(false); }} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 2, padding: "8px 2px",
              background: "transparent", border: "none", cursor: "pointer",
              borderTop: `2px solid ${tab === t.id ? T.green : "transparent"}`,
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{
                fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em",
                color: tab === t.id ? T.green : T.text3,
                fontWeight: tab === t.id ? 700 : 400,
              }}>{t.label.slice(0, 6)}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}