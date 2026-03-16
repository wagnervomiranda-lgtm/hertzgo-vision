"use client";
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

// ─── LOGO SVG ────────────────────────────────────────────────────────────────
function HertzGoLogo({ size = 32 }: { size?: number }) {
  const scale = size / 32;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(2 * scale) }}>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: Math.round(22 * scale), color: "#ffffff", letterSpacing: "-0.04em", lineHeight: 1 }}>Hertz</span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: Math.round(22 * scale), color: "#016070", letterSpacing: "-0.04em", lineHeight: 1 }}>Go</span>
      <svg width={Math.round(14 * scale)} height={Math.round(14 * scale)} viewBox="0 0 14 14" fill="none" style={{ marginLeft: Math.round(1 * scale) }}>
        <circle cx="7" cy="7" r="5.5" stroke="#016070" strokeWidth="1.5"/>
        <line x1="1.5" y1="7" x2="0" y2="7" stroke="#016070" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="12.5" y1="7" x2="14" y2="7" stroke="#016070" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
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
interface AppState {
  metas: Record<string, number>;
  dreConfigs: Record<string, DREConfig>;
  contatos: Contatos;
  mensagens: Mensagens;
  disparos: { ts: string; nome: string; msgId: string; status: "ok" | "err"; msg?: string }[];
  zapi: ZAPIConfig;
  cupons: CupomRegistro[];
  estacoesCustom: EstacaoCustom[];
}
type Tab = "dash" | "dre" | "usuarios" | "acoes" | "config";

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
// Estações que participam de ações CRM (DF only, sem SP)
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

// ─── PREÇO PRATICADO (percentil 90) ──────────────────────────────────────────
function calcPrecoPraticado(sessions: Session[], hubK: string): number {
  const pagas = sessions.filter(s => s.hubKey===hubK && !s.cancelled && s.energy>0 && s.value>0);
  if (!pagas.length) return 0;
  const precos = pagas.map(s => s.value/s.energy).sort((a,b)=>a-b);
  const p90idx = Math.floor(precos.length * 0.9);
  return precos[Math.min(p90idx, precos.length-1)];
}

// ─── DETECÇÃO DE CUPOM ───────────────────────────────────────────────────────
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
    <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent}}/>
      <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>{label}</div>
      <div style={{fontFamily:T.sans,fontSize:small?20:26,fontWeight:700,color:accent,lineHeight:1,marginBottom:4}}>{value}</div>
      {sub&&<div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{sub}</div>}
    </div>
  );
}
function SectionLabel({children}:{children:string}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,fontFamily:T.mono,fontSize:9,color:T.text3,letterSpacing:"0.18em",textTransform:"uppercase" as const,margin:"28px 0 14px"}}>
      {children}<div style={{flex:1,height:1,background:T.border}}/>
    </div>
  );
}
function Panel({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){
  return<div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px 22px",...style}}>{children}</div>;
}
const TH:React.CSSProperties={fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase",letterSpacing:"0.1em",padding:"0 12px 12px",textAlign:"left",borderBottom:`1px solid ${T.border}`,fontWeight:500};
const THR:React.CSSProperties={...TH,textAlign:"right"};
const TD:React.CSSProperties={padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:12,verticalAlign:"middle",color:T.text};
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
  const[expanded,setExpanded]=useState(true);
  return(
    <div style={{marginBottom:20}}>
      <div onClick={()=>setExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:c.bg,border:`1px solid ${c.border}`,borderRadius:14,cursor:"pointer",marginBottom:expanded?10:0,transition:"all 0.2s"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:26,lineHeight:1}}>{emoji}</div>
          <div><div style={{fontFamily:T.sans,fontSize:15,fontWeight:700,color:c.dot}}>{c.label}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:2}}>{c.sub}</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {["crit","warn","ok"].map(tipo=>{const count=alertas.filter(a=>a.tipo===tipo).length;if(!count)return null;const color=tipo==="crit"?T.red:tipo==="warn"?T.amber:T.green;return<span key={tipo} style={{fontFamily:T.mono,fontSize:10,padding:"2px 9px",borderRadius:20,background:`${color}20`,color,border:`1px solid ${color}40`}}>{tipo==="crit"?"🔴":tipo==="warn"?"⚠️":"✅"} {count}</span>;})}
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>
      {expanded&&(<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>{alertas.map((a,i)=>{const color=a.tipo==="crit"?T.red:a.tipo==="warn"?T.amber:T.green;return(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:`${color}08`,border:`1px solid ${color}25`,borderRadius:10}}><span style={{fontSize:15,flexShrink:0,marginTop:1}}>{a.icon}</span><div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color,marginBottom:2}}>{a.titulo}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,lineHeight:1.5}}>{a.desc}</div></div></div>);})}</div>)}
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
    if(pctMeta>=110)return`🚀 Ritmo excelente — projeção ${pctMeta.toFixed(0)}% da meta. Vai superar em R$\u00a0${(projRev-meta).toFixed(0)}.`;
    if(pctMeta>=100)return`✅ No alvo — mantenha ${avgSessDay.toFixed(1)} sessões/dia.`;
    if(pctMeta>=75){if(ritmoDiff>0)return`⚠️ Para bater a meta, precisa de R$\u00a0${ritmoNecessario.toFixed(0)}/dia nos próximos ${diasRestantes} dias.`;return`⚠️ Projeção em ${pctMeta.toFixed(0)}%. Faltam R$\u00a0${faltaMeta.toFixed(0)} — ${diasRestantes} dias.`;}
    return`🔴 Ritmo crítico — ${pctMeta.toFixed(0)}% da meta. Precisa de +${Math.ceil(ritmoDiff>0?ritmoDiff/(avgRevDay/avgSessDay):2)} sessões/dia.`;
  };
  const[editando,setEditando]=useState(false);
  const[metaInput,setMetaInput]=useState(String(meta));
  return(
    <div style={{marginBottom:24,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>🔮</span><div><div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:T.text}}>Projeção do Mês</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginTop:1}}>base: {avgRevDay.toFixed(0)}/dia · {days} dias · {diasRestantes} dias restantes</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>Meta:</span>
          {editando?(<div style={{display:"flex",gap:6}}><input autoFocus type="number" value={metaInput} onChange={e=>setMetaInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onMetaChange(+metaInput||0);setEditando(false);}if(e.key==="Escape")setEditando(false);}} style={{width:90,background:T.bg3,border:`1px solid ${T.green}`,color:T.text,padding:"4px 8px",borderRadius:6,fontSize:12,fontFamily:T.mono}}/><button onClick={()=>{onMetaChange(+metaInput||0);setEditando(false);}} style={{background:T.greenDim,border:`1px solid rgba(0,229,160,0.3)`,color:T.green,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:T.mono}}>✓</button></div>)
          :(<button onClick={()=>{setMetaInput(String(meta));setEditando(true);}} style={{background:"transparent",border:`1px solid ${T.border}`,color:meta>0?T.amber:T.text3,padding:"4px 12px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:T.mono,transition:"all 0.2s"}}>{meta>0?brlK(meta):"Definir meta"} ✏️</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border}}>
        {[{label:"Receita Projetada",value:brlK(projRev),sub:`R$\u00a0${avgRevDay.toFixed(0)}/dia × 30`,color:metaColor},{label:"kWh Projetados",value:`${Math.round(projKwh).toLocaleString("pt-BR")} kWh`,sub:`${avgKwhDay.toFixed(0)} kWh/dia × 30`,color:T.amber},{label:"Sessões Projetadas",value:`${projSess}`,sub:`${avgSessDay.toFixed(1)} sess/dia × 30`,color:T.blue},{label:"Pacing vs Meta",value:meta>0?`${pacingPct.toFixed(0)}%`:"—",sub:meta>0?(pacingDiff>=0?`▲ R$\u00a0${pacingDiff.toFixed(0)} à frente`:`▼ R$\u00a0${Math.abs(pacingDiff).toFixed(0)} atrás`):"configure uma meta",color:meta>0?(pacingPct>=100?T.green:pacingPct>=75?T.amber:T.red):T.text3}].map((k,i)=>(
          <div key={i} style={{background:T.bg2,padding:"14px 16px"}}><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>{k.label}</div><div style={{fontFamily:T.sans,fontSize:20,fontWeight:700,color:k.color,lineHeight:1,marginBottom:4}}>{k.value}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{k.sub}</div></div>
        ))}
      </div>
      {meta>0&&(<div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:6}}><span>Projeção vs Meta <span style={{color:metaColor,fontWeight:600}}>{pctMeta.toFixed(0)}%</span></span><span>{brlK(projRev)} <span style={{color:T.text3}}>/ meta {brlK(meta)}</span></span></div><div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pctMeta)}%`,background:metaColor,borderRadius:3,transition:"width 0.6s ease"}}/></div><div style={{marginTop:10,padding:"10px 14px",background:`${metaColor}08`,border:`1px solid ${metaColor}20`,borderRadius:10,fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:1.6}}>{gerarInsight()}</div></div>)}
      {meta===0&&(<div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,fontFamily:T.mono,fontSize:11,color:T.text3,textAlign:"center"}}>👆 Clique em <strong style={{color:T.amber}}>Definir meta</strong> para ativar o pacing inteligente</div>)}
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
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,minHeight:"100vh"}}>
      <div style={{textAlign:"center",marginBottom:52}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:16}}>
          <HertzGoLogo size={44}/>
        </div>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,letterSpacing:"0.18em",textTransform:"uppercase",marginTop:8}}>Vision · Painel Operacional</div>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)process(f);}} onClick={()=>inputRef.current?.click()} style={{width:"100%",maxWidth:560,background:drag?"rgba(0,229,160,0.06)":T.bg1,border:`1.5px dashed ${drag?T.green:T.border2}`,borderRadius:24,padding:"48px 40px",textAlign:"center",cursor:"pointer",transition:"all 0.2s"}}>
        <div style={{fontSize:40,marginBottom:16}}>{loading?"⏳":"📂"}</div>
        <div style={{fontFamily:T.sans,fontSize:18,fontWeight:600,marginBottom:8,color:T.text}}>{loading?"Processando...":"Carregar CSV ou Excel"}</div>
        <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:1.8,marginBottom:24}}>Arraste ou clique · <span style={{color:T.green}}>Spott CSV · Move XLSX · Multi-estação</span></div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <div style={{padding:"10px 24px",background:T.green,color:T.bg,borderRadius:10,fontFamily:T.sans,fontWeight:700,fontSize:13}}>Spott CSV</div>
          <div style={{padding:"10px 24px",background:"rgba(59,130,246,0.15)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,fontFamily:T.sans,fontWeight:700,fontSize:13}}>Move XLSX</div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])process(e.target.files[0]);}}/>
      {err&&<div style={{marginTop:16,padding:"10px 18px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,color:T.red,fontFamily:T.mono,fontSize:12}}>❌ {err}</div>}
    </div>
  );
}

// ─── TAB DASHBOARD ───────────────────────────────────────────────────────────
function TabDashboard({sessions,meta,onMetaChange}:{sessions:Session[];meta:number;onMetaChange:(v:number)=>void}){
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
  const dcSess=ok.filter(s=>/DC/i.test(s.charger)),acSess=ok.filter(s=>/AC/i.test(s.charger));
  const dcRev=dcSess.reduce((a,s)=>a+s.value,0),acRev=acSess.reduce((a,s)=>a+s.value,0);
  const dcKwh=dcSess.reduce((a,s)=>a+s.energy,0),acKwh=acSess.reduce((a,s)=>a+s.energy,0);
  const byDay:Record<string,{date:Date;rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{const k=s.date.toDateString();if(!byDay[k])byDay[k]={date:s.date,rev:0,kwh:0,sess:0};byDay[k].rev+=s.value;byDay[k].kwh+=s.energy;byDay[k].sess++;});
  const dayData=Object.values(byDay).sort((a,b)=>a.date.getTime()-b.date.getTime()).map(d=>({date:fmtDate(d.date),rev:+d.rev.toFixed(2),kwh:+d.kwh.toFixed(0),sess:d.sess}));
  const avgRev=totalRev/days;
  const hubMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!hubMap[s.hubKey])hubMap[s.hubKey]={rev:0,kwh:0,sess:0};hubMap[s.hubKey].rev+=s.value;hubMap[s.hubKey].kwh+=s.energy;hubMap[s.hubKey].sess++;});
  const hubData=Object.entries(hubMap).sort((a,b)=>b[1].rev-a[1].rev).map(([key,d])=>({name:trunc(hubNome(key),20),rev:+d.rev.toFixed(0),sess:d.sess,kwh:+d.kwh.toFixed(0)}));
  const userMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!userMap[s.user])userMap[s.user]={rev:0,kwh:0,sess:0};userMap[s.user].rev+=s.value;userMap[s.user].kwh+=s.energy;userMap[s.user].sess++;});
  const top5=Object.entries(userMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);
  const hourData=Array(24).fill(0).map(()=>({sess:0,kwh:0}));
  ok.forEach(s=>{if(s.startHour!==null){hourData[s.startHour].sess++;hourData[s.startHour].kwh+=s.energy;}});
  const maxHour=Math.max(...hourData.map(h=>h.sess),1);
  const hasMove=sessions.some(s=>s.source==="move"),hasSpott=sessions.some(s=>s.source==="spott");
  const[chartMode,setChartMode]=useState<"rev"|"kwh"|"sess">("rev");
  return(
    <div style={{padding:"24px 28px"}}>
      {hubs.length>1&&(<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>{["__all__",...hubs].map(h=>(<button key={h} onClick={()=>setActiveHub(h)} style={{padding:"5px 14px",borderRadius:20,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeHub===h?T.green:T.border2}`,background:activeHub===h?T.greenDim:"transparent",color:activeHub===h?T.green:T.text2,transition:"all 0.18s"}}>{h==="__all__"?`🌐 Todas (${hubs.length})`:`📍 ${hubNome(h)}`}</button>))}</div>)}
      <div style={{display:"flex",alignItems:"center",gap:10,fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:16}}>
        <span>📅 {fmtDate(minDate)} → {fmtDate(maxDate)} · {days} dias · {totalSess} sessões</span>
        {hasSpott&&<span style={{background:"rgba(0,229,160,0.1)",color:T.green,padding:"2px 8px",borderRadius:4,fontSize:9,border:"1px solid rgba(0,229,160,0.2)"}}>Spott</span>}
        {hasMove&&<span style={{background:"rgba(59,130,246,0.1)",color:"#60a5fa",padding:"2px 8px",borderRadius:4,fontSize:9,border:"1px solid rgba(59,130,246,0.2)"}}>Move</span>}
      </div>
      <Semaforo sessions={filtered}/>
      <ProjecaoMensal sessions={filtered} meta={meta} onMetaChange={onMetaChange}/>
      <SectionLabel>KPIs do Período</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KpiCard label="Faturamento Bruto" value={brl(totalRev)} sub={`R$\u00a0${(totalRev/days).toFixed(0)}/dia`} accent={T.green}/>
        <KpiCard label="Energia Entregue" value={`${totalKwh.toFixed(0)} kWh`} sub={`${(totalKwh/days).toFixed(0)} kWh/dia`} accent={T.amber}/>
        <KpiCard label="Total Sessões" value={`${totalSess}`} sub={`${(totalSess/days).toFixed(1)} sess/dia`} accent={T.blue}/>
        <KpiCard label="Preço Médio / kWh" value={`R$\u00a0${priceKwh.toFixed(2).replace(".",",")}`} sub={`Ticket: ${brl(ticket)}`} accent={T.red}/>
      </div>
      {dcSess.length>0&&acSess.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:28}}>
          {[{label:"⚡ DC 120kW",sess:dcSess,rev:dcRev,kwh:dcKwh,color:T.purple,bg:"rgba(139,92,246,0.08)",border:"rgba(139,92,246,0.25)"},{label:"🔌 AC 22kW",sess:acSess,rev:acRev,kwh:acKwh,color:T.green,bg:"rgba(0,229,160,0.08)",border:"rgba(0,229,160,0.25)"}].map((dc,i)=>(
            <div key={i} style={{background:dc.bg,border:`1px solid ${dc.border}`,borderRadius:14,padding:"14px 18px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><span style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:dc.color}}>{dc.label}</span><span style={{fontFamily:T.mono,fontSize:10,color:dc.color,padding:"2px 8px",borderRadius:4,background:`${dc.color}20`}}>{dc.sess.length} sessões</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[{l:"Receita",v:brl(dc.rev)},{l:"kWh",v:dc.kwh.toFixed(0)},{l:"Ticket",v:brl(dc.sess.length>0?dc.rev/dc.sess.length:0)}].map((k,j)=>(<div key={j}><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginBottom:3}}>{k.l}</div><div style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:dc.color}}>{k.v}</div></div>))}
              </div>
              <div style={{marginTop:10,height:3,background:T.bg3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${totalRev>0?(dc.rev/totalRev*100).toFixed(0):0}%`,background:dc.color,borderRadius:2}}/></div>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginTop:3}}>{totalRev>0?(dc.rev/totalRev*100).toFixed(0):0}% da receita total</div>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16,marginBottom:28}}>
        <Panel>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
            <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>Performance por Hub</div>
            <div style={{display:"flex",gap:4}}>{([["rev","Receita"],["kwh","kWh"],["sess","Sessões"]] as [typeof chartMode,string][]).map(([m,l])=>(<button key={m} onClick={()=>setChartMode(m)} style={{padding:"3px 10px",borderRadius:6,fontFamily:T.mono,fontSize:10,cursor:"pointer",border:`1px solid ${chartMode===m?T.green:T.border}`,background:chartMode===m?T.greenDim:"transparent",color:chartMode===m?T.green:T.text3}}>{l}</button>))}</div>
          </div>
          <ResponsiveContainer width="100%" height={220}><BarChart data={hubData} barCategoryGap="30%"><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="name" tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false}/><YAxis tickFormatter={v=>chartMode==="rev"?`R$${(v/1000).toFixed(0)}k`:`${v}`} tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={52}/><Tooltip content={<CustomTooltip suffix={chartMode==="rev"?"R$":chartMode==="kwh"?"kWh":""}/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/><Bar dataKey={chartMode} fill={chartMode==="rev"?"rgba(0,229,160,0.65)":chartMode==="kwh"?"rgba(245,158,11,0.65)":"rgba(59,130,246,0.65)"} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,marginBottom:18,color:T.text}}>Top 5 Usuários</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>#</th><th style={TH}>Usuário</th><th style={THR}>Sess.</th><th style={THR}>Total</th></tr></thead><tbody>{top5.map(([name,d],i)=>{const rc=["#f59e0b","#94a3b8","#b47c3c"][i]||T.text3;return(<tr key={name}><td style={TD}><span style={{fontFamily:T.mono,fontWeight:700,color:rc,fontSize:11}}>{i+1}</span></td><td style={TD}><span style={{fontSize:12,fontWeight:500}}>{trunc(name,16)}</span></td><td style={TDR}><span style={{background:T.greenDim,color:T.green,padding:"2px 7px",borderRadius:5,fontSize:10}}>{d.sess}</span></td><td style={{...TDR,color:T.green,fontWeight:600}}>{brl(d.rev)}</td></tr>);})}</tbody></table>
        </Panel>
      </div>
      <SectionLabel>Receita & Sessões Diárias</SectionLabel>
      <Panel style={{marginBottom:28}}>
        <ResponsiveContainer width="100%" height={200}><LineChart data={dayData}><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="date" tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis yAxisId="rev" tickFormatter={v=>`R$${v.toLocaleString("pt-BR",{minimumFractionDigits:0})}`} tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={68}/><YAxis yAxisId="sess" orientation="right" tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={30}/><Tooltip contentStyle={{background:T.bg3,border:`1px solid ${T.border2}`,borderRadius:10,fontFamily:T.mono,fontSize:11}}/><ReferenceLine yAxisId="rev" y={avgRev} stroke="rgba(245,158,11,0.4)" strokeDasharray="5 4" strokeWidth={1.5}/><Line yAxisId="rev" dataKey="rev" stroke={T.green} strokeWidth={2} dot={{r:2,fill:T.green}} activeDot={{r:5}} name="Receita"/><Line yAxisId="sess" dataKey="sess" stroke={T.blue} strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Sessões"/></LineChart></ResponsiveContainer>
      </Panel>
      <SectionLabel>Heatmap de Atividade por Hora</SectionLabel>
      <Panel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:3}}>{hourData.map((h,hr)=>(<div key={hr} title={`${hr}h: ${h.sess} sessões`} style={{height:36,borderRadius:4,background:heatColor(h.sess,maxHour),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,0.8)",cursor:"default"}}>{h.sess>0?h.sess:""}</div>))}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:3,marginTop:4}}>{Array.from({length:24},(_,hr)=>(<div key={hr} style={{fontSize:8,color:T.text3,textAlign:"center",fontFamily:T.mono}}>{hr}h</div>))}</div>
      </Panel>
    </div>
  );
}


// ─── NOVOS COLAPSÁVEL ────────────────────────────────────────────────────────
function NovosColapsavel({novosNaRede,novosNaEstacao,getTel}:{novosNaRede:UserData[];novosNaEstacao:UserData[];getTel:(n:string)=>string|null}){
  const[openRede,setOpenRede]=useState(false);
  const[openEstacao,setOpenEstacao]=useState(false);
  const grupos=[
    {label:"🌱 Novos na Rede",sub:"1ª vez em qualquer estação HertzGo",color:T.teal,lista:novosNaRede,tipo:"rede",open:openRede,setOpen:setOpenRede},
    {label:"📍 Novos na Estação",sub:"Já eram clientes, chegaram num novo ponto",color:T.blue,lista:novosNaEstacao,tipo:"estacao",open:openEstacao,setOpen:setOpenEstacao},
  ];
  return(
    <div>
      {grupos.map(grupo=>(
        <div key={grupo.tipo} style={{marginBottom:12,background:T.bg2,border:`1px solid ${grupo.open?grupo.color+"40":T.border}`,borderRadius:14,overflow:"hidden"}}>
          <div onClick={()=>grupo.setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",cursor:"pointer"}}>
            <div>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{grupo.label}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{grupo.sub}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontFamily:T.mono,fontSize:11,padding:"3px 10px",borderRadius:20,background:`${grupo.color}20`,color:grupo.color,border:`1px solid ${grupo.color}40`}}>{grupo.lista.length} usuários</span>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{grupo.open?"▲":"▼"}</span>
            </div>
          </div>
          {grupo.open&&(
            <div style={{borderTop:`1px solid ${T.border}`}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr><th style={TH}>Usuário</th><th style={TH}>Estação</th><th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Telefone</th><th style={TH}>Ação</th></tr></thead>
                <tbody>
                  {grupo.lista.length===0&&<tr><td colSpan={6} style={{...TD,textAlign:"center",color:T.text3,padding:"20px"}}>Nenhum usuário no período</td></tr>}
                  {grupo.lista.map(u=>{
                    const tel=getTel(u.user);
                    const isPropria=ESTACAO_PROPRIA.includes(u.localFreqKey);
                    return(<tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                      <td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,20)}</span></td>
                      <td style={TD}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:isPropria?"rgba(1,96,112,0.2)":"rgba(255,255,255,0.05)",color:isPropria?T.teal:T.text3,fontFamily:T.mono}}>{hubNome(u.localFreqKey)}</span></td>
                      <td style={{...TDR,color:T.text2}}>{u.kwh.toFixed(1)}</td>
                      <td style={{...TDR,color:T.green,fontWeight:600}}>{brl(u.rev)}</td>
                      <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel||"—"}</td>
                      <td style={TD}>{grupo.tipo==="rede"&&isPropria&&tel?<span style={{fontFamily:T.mono,fontSize:10,color:T.green}}>📤 Boas-vindas rede</span>:!isPropria?<span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>→ MSG 1</span>:<span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>sem tel</span>}</td>
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
    <div style={{display:"grid",gap:10}}>
      {cats.map(cat=>{
        const lista=motoristasOrdenados.filter(u=>vipScores[u.user]?.status===cat.status);
        return(
          <div key={cat.status} style={{background:T.bg2,border:`1px solid ${cat.open?cat.color+"50":T.border}`,borderRadius:12,overflow:"hidden",transition:"all 0.2s"}}>
            <div onClick={()=>cat.setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`${cat.color}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontFamily:T.sans,fontSize:18,fontWeight:800,color:cat.color}}>{lista.length}</span>
                </div>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:cat.color}}>{cat.label}</div>
              </div>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{cat.open?"▲":"▼ ver usuários"}</span>
            </div>
            {cat.open&&lista.length>0&&(
              <div style={{borderTop:`1px solid ${T.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr><th style={TH}>Motorista</th><th style={TH}>Hub</th><th style={THR}>Score</th><th style={THR}>Freq/sem</th><th style={THR}>Dias s/ recarga</th><th style={TH}>Telefone</th></tr></thead>
                  <tbody>
                    {lista.map(u=>{
                      const v=vipScores[u.user];const tel=getTel(u.user);
                      return(<tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                        <td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,20)}</span></td>
                        <td style={{...TD,fontSize:11,color:T.text2}}>{hubNome(u.localFreqKey)}</td>
                        <td style={TDR}><div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}><div style={{width:40,height:4,background:T.bg3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${v?.score||0}%`,background:cat.color,borderRadius:2}}/></div><span style={{color:cat.color,fontWeight:600,fontSize:11}}>{v?.score||0}</span></div></td>
                        <td style={{...TDR,color:T.text2}}>{v?.freqAtual||0}x</td>
                        <td style={{...TDR,color:v&&v.diasSemRecarga>14?T.red:v&&v.diasSemRecarga>7?T.amber:T.text2}}>{v?.diasSemRecarga||0}d</td>
                        <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel?`📞 ${tel}`:"—"}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {cat.open&&lista.length===0&&<div style={{padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:T.text3,borderTop:`1px solid ${T.border}`}}>Nenhum motorista nesta categoria</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB USUÁRIOS ────────────────────────────────────────────────────────────
function TabUsuarios({sessions,appState}:{sessions:Session[];appState:AppState}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const parceiros=users.filter(u=>u.isParceiro),motoristas=users.filter(u=>u.isMotorista);
  const heavys=users.filter(u=>u.isHeavy),shoppers=users.filter(u=>!u.isParceiro&&!u.isMotorista&&!u.isHeavy);

  // Telefones
  const telMap:Record<string,string>={};
  Object.values(appState.contatos).forEach(c=>{c.dados.forEach(d=>{if(d.telefone)telMap[d.nome.trim().toLowerCase()]=d.telefone;});});
  const getTel=(nome:string)=>{const n=nome.trim().toLowerCase();if(telMap[n])return telMap[n];const found=Object.keys(telMap).find(k=>k.includes(n)||n.includes(k));return found?telMap[found]:null;};

  // Novos usuários
  const datas=ok.map(s=>s.date.getTime());
  const maxData=datas.length?new Date(Math.max(...datas)):new Date();
  const periodoInicio=datas.length?new Date(Math.min(...datas)):new Date();
  const diasTotal=Math.max(1,Math.round((maxData.getTime()-periodoInicio.getTime())/86400000)+1);
  const cortNovosDias=Math.min(14,Math.ceil(diasTotal*0.2));
  const cortNovos=new Date(maxData.getTime()-cortNovosDias*86400000);

  // Usuários que aparecem em QUALQUER sessão antes do corte
  const usersAntes=new Set(ok.filter(s=>s.date<cortNovos).map(s=>s.user));
  const novosNaRede=users.filter(u=>!usersAntes.has(u.user));

  // Novos por estação (aparece num hub novo nos últimos dias)
  const novosNaEstacao=users.filter(u=>{
    if(novosNaRede.some(n=>n.user===u.user))return false;
    const sessRecentes=ok.filter(s=>s.user===u.user&&s.date>=cortNovos);
    const hubsRecentes=new Set(sessRecentes.map(s=>s.hubKey));
    const hubsAntigos=new Set(ok.filter(s=>s.user===u.user&&s.date<cortNovos).map(s=>s.hubKey));
    return Array.from(hubsRecentes).some(h=>!hubsAntigos.has(h));
  });

  // Cobertura telefone
  const totalComTel=users.filter(u=>getTel(u.user)).length;
  const pctCobertura=users.length>0?(totalComTel/users.length*100).toFixed(0):"0";

  // VIP Score
  const vipScores:Record<string,ReturnType<typeof calcVipScore>>={};
  motoristas.forEach(u=>{vipScores[u.user]=calcVipScore(u.user,ok);});
  const vipOrder:{[k:string]:number}={em_risco:0,churned:1,regular:2,ativo:3};
  const motoristasOrdenados=[...motoristas].sort((a,b)=>(vipOrder[vipScores[a.user]?.status||"ativo"]??3)-(vipOrder[vipScores[b.user]?.status||"ativo"]??3));

  // Índice de concentração
  const top10Rev=Object.values(users).sort((a,b)=>b.rev-a.rev).slice(0,10).reduce((a,u)=>a+u.rev,0);
  const concPct=totalRev>0?(top10Rev/totalRev*100):0;

  // Detecção de cupom
  const hubKeys=Array.from(new Set(ok.map(s=>s.hubKey)));
  const precosPraticados:Record<string,number>={};
  hubKeys.forEach(h=>{precosPraticados[h]=calcPrecoPraticado(ok,h);});
  const usersComCupom=users.filter(u=>{
    const hk=u.localFreqKey;
    if(!hk||!precosPraticados[hk])return false;
    return u.precoMedioKwh>0&&u.precoMedioKwh<precosPraticados[hk]*0.90;
  });

  // Painel Parceiros
  const[parceirosExpanded,setParceirosExpanded]=useState(false);
  const custoParceiroPadrao=0.80;
  const parceirosDetalhado=parceiros.map(u=>{
    const hk=u.localFreqKey;
    const custoParceiro=(appState.dreConfigs[hk]?.custoParceiro)||custoParceiroPadrao;
    const precoPraticado=precosPraticados[hk]||1.39;
    const custo=u.kwh*custoParceiro;
    const potencial=u.kwh*precoPraticado;
    return{...u,custo,potencial,delta:potencial-custo,precoPraticado,custoParceiro};
  }).sort((a,b)=>b.kwh-a.kwh);
  const totalKwhParceiros=parceirosDetalhado.reduce((a,u)=>a+u.kwh,0);
  const totalCustoParceiros=parceirosDetalhado.reduce((a,u)=>a+u.custo,0);
  const totalPotencialParceiros=parceirosDetalhado.reduce((a,u)=>a+u.potencial,0);
  const totalKwhGeral=ok.reduce((a,s)=>a+s.energy,0);

  // Matriz Esforço × Impacto
  const matrizData=[
    {x:15,y:88,z:Math.max(motoristas.length,1),label:"Reter Motoristas VIP",quadrante:"Quick Win"},
    {x:65,y:85,z:Math.max(heavys.length,1),label:"Converter Heavy → Motorista",quadrante:"Estratégico"},
    {x:25,y:72,z:Math.max(novosNaRede.length,1),label:"Boas-vindas Novos",quadrante:"Quick Win"},
    {x:20,y:65,z:Math.max(totalComTel,1),label:"Disparar MSG 1",quadrante:"Quick Win"},
    {x:75,y:55,z:Math.max(shoppers.length,1),label:"Fidelizar Shoppers",quadrante:"Estratégico"},
    {x:40,y:40,z:Math.max(parceiros.length,1),label:"Auditar Parceiros",quadrante:"Atenção"},
    {x:80,y:30,z:Math.max(users.length-totalComTel,1),label:"Capturar Telefones",quadrante:"Preencher"},
  ];

  const[activeSection,setActiveSection]=useState<"centro"|"novos"|"vip"|"parceiros"|"cupons">("centro");

  return(
    <div style={{padding:"24px 28px"}}>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24}}>
        <KpiCard label="Total Usuários" value={`${users.length}`} sub="únicos no período" accent={T.green}/>
        <KpiCard label="Novos na Rede" value={`${novosNaRede.length}`} sub={`últimos ${cortNovosDias} dias`} accent={T.teal}/>
        <KpiCard label="Motoristas App" value={`${motoristas.length}`} sub="alvos prioritários" accent={T.red}/>
        <KpiCard label="Cobertura Tel." value={`${pctCobertura}%`} sub={`${totalComTel} de ${users.length}`} accent={+pctCobertura>=70?T.green:T.amber}/>
        <KpiCard label="Concentração" value={`${concPct.toFixed(0)}%`} sub={`Top 10 usuários · ${concPct>40?"⚠️ risco":"ok"}`} accent={concPct>40?T.red:T.green}/>
      </div>

      {/* Navegação interna */}
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        {([["centro","🎯 Centro de Decisão"],["novos","🆕 Novos Usuários"],["vip","🏆 VIP Score"],["parceiros","🔵 Parceiros"],["cupons","🎟️ Cupons"]] as [string,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setActiveSection(id as typeof activeSection)} style={{padding:"6px 14px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeSection===id?T.green:T.border}`,background:activeSection===id?T.greenDim:"transparent",color:activeSection===id?T.green:T.text2,transition:"all 0.2s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* CENTRO DE DECISÃO */}
      {activeSection==="centro"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:28}}>
            {/* VIPs em risco */}
            <Panel style={{borderLeft:`3px solid ${T.red}`}}>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.red,marginBottom:12}}>🔴 Requer Ação Agora</div>
              {motoristasOrdenados.filter(u=>["em_risco","churned"].includes(vipScores[u.user]?.status||"")).slice(0,5).map(u=>{
                const v=vipScores[u.user];const tel=getTel(u.user);
                const sc=v?.status==="em_risco"?"#fb923c":T.red;
                return(<div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{v?.diasSemRecarga}d sem recarga · {hubNome(u.localFreqKey)}</div></div>
                  <span style={{fontFamily:T.mono,fontSize:10,padding:"2px 8px",borderRadius:4,background:`${sc}20`,color:sc}}>{v?.status}</span>
                </div>);
              })}
              {motoristasOrdenados.filter(u=>["em_risco","churned"].includes(vipScores[u.user]?.status||"")).length===0&&<div style={{fontFamily:T.mono,fontSize:11,color:T.text3}}>✅ Nenhum motorista em risco</div>}
            </Panel>
            {/* Heavy Users próximos */}
            <Panel style={{borderLeft:`3px solid ${T.amber}`}}>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.amber,marginBottom:12}}>🟡 Oportunidade Quente</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>Heavy Users com potencial de virar motorista</div>
              {heavys.filter(u=>u.kwh>60||u.sess>=3).slice(0,5).map(u=>(
                <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{u.kwh.toFixed(0)} kWh · {u.sess} sessões</div></div>
                  <span style={{fontFamily:T.mono,fontSize:9,color:T.amber}}>{brl(u.rev)}</span>
                </div>
              ))}
              {heavys.length===0&&<div style={{fontFamily:T.mono,fontSize:11,color:T.text3}}>Sem heavy users no período</div>}
            </Panel>
            {/* Novos pendentes */}
            <Panel style={{borderLeft:`3px solid ${T.teal}`}}>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.teal,marginBottom:12}}>🆕 Boas-vindas Pendentes</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>Apenas estações próprias (PW + CidAuto)</div>
              {novosNaRede.filter(u=>ESTACAO_PROPRIA.includes(u.localFreqKey)&&getTel(u.user)).slice(0,5).map(u=>(
                <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{hubNome(u.localFreqKey)} · 1ª vez na rede</div></div>
                  <span style={{fontFamily:T.mono,fontSize:9,color:T.green}}>📞 pronto</span>
                </div>
              ))}
              {novosNaRede.filter(u=>ESTACAO_PROPRIA.includes(u.localFreqKey)).length===0&&<div style={{fontFamily:T.mono,fontSize:11,color:T.text3}}>Sem novos nas estações próprias</div>}
            </Panel>
            {/* Sem telefone */}
            <Panel style={{borderLeft:`3px solid ${T.text3}`}}>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text2,marginBottom:12}}>📵 Cobertura CRM</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>{users.length-totalComTel} usuários sem telefone</div>
              {users.filter(u=>!getTel(u.user)&&u.rev>50).sort((a,b)=>b.rev-a.rev).slice(0,5).map(u=>(
                <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{u.perfil} · {brl(u.rev)}</div></div>
                  <span style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>sem tel</span>
                </div>
              ))}
            </Panel>
          </div>

          {/* Matriz Esforço × Impacto */}
          <SectionLabel>🎯 Matriz de Priorização — Esforço × Impacto</SectionLabel>
          <Panel style={{marginBottom:28}}>
            <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:24,alignItems:"start"}}>
              <div>
                <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8,textAlign:"center"}}>Tamanho do ponto = usuários afetados · Passe o mouse para detalhes</div>
                {/* Legenda quadrantes */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8}}>
                  {[{l:"⚡ Quick Win",c:T.green},{l:"🎯 Estratégico",c:T.amber},{l:"👁️ Atenção",c:T.blue},{l:"⬇️ Preencher",c:T.text3}].map((q,i)=>(<div key={i} style={{fontFamily:T.mono,fontSize:9,color:q.c,background:`${q.c}10`,padding:"3px 8px",borderRadius:4,textAlign:"center"}}>{q.l}</div>))}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{top:10,right:10,bottom:30,left:10}}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)"/>
                    <ReferenceLine x={50} stroke="rgba(255,255,255,0.12)" strokeDasharray="6 4"/>
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.12)" strokeDasharray="6 4"/>
                    <XAxis type="number" dataKey="x" domain={[0,100]} tick={{fill:T.text3,fontSize:8,fontFamily:T.mono}} axisLine={false} tickLine={false} label={{value:"← Baixo Esforço · Alto Esforço →",position:"insideBottom",offset:-15,style:{fill:T.text3,fontSize:9,fontFamily:T.mono}}}/>
                    <YAxis type="number" dataKey="y" domain={[0,100]} tick={{fill:T.text3,fontSize:8,fontFamily:T.mono}} axisLine={false} tickLine={false} label={{value:"Impacto",angle:-90,position:"insideLeft",style:{fill:T.text3,fontSize:9,fontFamily:T.mono}}}/>
                    <ZAxis type="number" dataKey="z" range={[60,350]}/>
                    <Tooltip cursor={{strokeDasharray:"3 3",stroke:T.border2}} content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0]?.payload;if(!d)return null;
                      const qColor=d.quadrante==="Quick Win"?T.green:d.quadrante==="Estratégico"?T.amber:d.quadrante==="Preencher"?T.text3:T.blue;
                      return(<div style={{background:T.bg3,border:`1px solid ${T.border2}`,borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11}}><div style={{color:qColor,fontWeight:700,marginBottom:4}}>{d.label}</div><div style={{color:T.text2}}>Impacto: {d.y}% · Esforço: {d.x}%</div><div style={{color:T.text3}}>{d.z} usuários · {d.quadrante}</div></div>);
                    }}/>
                    <Scatter data={matrizData.filter(d=>d.quadrante==="Quick Win")} fill={T.green} fillOpacity={0.85}/>
                    <Scatter data={matrizData.filter(d=>d.quadrante==="Estratégico")} fill={T.amber} fillOpacity={0.85}/>
                    <Scatter data={matrizData.filter(d=>d.quadrante==="Preencher")} fill={T.text3} fillOpacity={0.85}/>
                    <Scatter data={matrizData.filter(d=>d.quadrante==="Atenção")} fill={T.blue} fillOpacity={0.85}/>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>Ações Priorizadas</div>
                {matrizData.sort((a,b)=>b.y-a.y).map((item,i)=>{
                  const qColor=item.quadrante==="Quick Win"?T.green:item.quadrante==="Estratégico"?T.amber:item.quadrante==="Preencher"?T.text3:T.blue;
                  return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:`${qColor}06`,border:`1px solid ${qColor}20`,borderRadius:8,marginBottom:8}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:`${qColor}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:T.mono,fontSize:10,fontWeight:700,color:qColor}}>{i+1}</span></div>
                    <div style={{flex:1}}><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{item.label}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{item.z} usuários · {item.quadrante}</div></div>
                    <span style={{fontFamily:T.mono,fontSize:9,padding:"2px 8px",borderRadius:4,background:`${qColor}20`,color:qColor,whiteSpace:"nowrap"}}>{item.quadrante}</span>
                  </div>);
                })}
              </div>
            </div>
          </Panel>
        </>
      )}

      {/* NOVOS USUÁRIOS */}
      {activeSection==="novos"&&(
        <>
          <div style={{background:"rgba(1,96,112,0.08)",border:"1px solid rgba(1,96,112,0.25)",borderRadius:12,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#5eead4",marginBottom:20}}>
            💡 Boas-vindas apenas nas <strong>estações próprias</strong> (PW + CidAuto). Demais entram na fila MSG 1.
          </div>
          <NovosColapsavel
            novosNaRede={novosNaRede}
            novosNaEstacao={novosNaEstacao}
            getTel={getTel}
          />
        </>
      )}

      {/* VIP SCORE */}
      {activeSection==="vip"&&(
        <>
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"16px 20px",marginBottom:16}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:"#60a5fa",marginBottom:10}}>📊 O que é o VIP Score?</div>
            <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:1.8,marginBottom:12}}>Score de 0–100 calculado automaticamente. Mede a saúde do relacionamento com cada motorista.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[{status:"🟠 Em Risco",score:"26–50",acao:"AGIR AGORA — frequência caindo.",cor:"#fb923c"},{status:"🔴 Churn",score:"0–25",acao:"Última tentativa de resgate.",cor:T.red},{status:"🟡 Regular",score:"51–75",acao:"Monitorar. Enviar novidade.",cor:T.amber},{status:"🟢 VIP Ativo",score:"76–100",acao:"Reconhecer e fidelizar.",cor:T.green}].map((s,i)=>(<div key={i} style={{background:`${s.cor}08`,border:`1px solid ${s.cor}25`,borderRadius:10,padding:"10px 12px"}}><div style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:s.cor,marginBottom:4}}>{s.status}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginBottom:6}}>Score: {s.score}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,lineHeight:1.5}}>{s.acao}</div></div>))}
            </div>
          </div>
          <VipCategorias
            motoristasOrdenados={motoristasOrdenados}
            vipScores={vipScores}
            getTel={getTel}
          />
        </>
      )}

      {/* PARCEIROS */}
      {activeSection==="parceiros"&&(
        <>
          <SectionLabel>🔵 Auditoria de Parceria — Impacto na Operação</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
            <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:14,padding:"16px 18px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.blue,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>⚡ Volume Parceria</div>
              <div style={{fontFamily:T.sans,fontSize:28,fontWeight:800,color:T.blue,marginBottom:4}}>{totalKwhParceiros.toFixed(0)} <span style={{fontSize:14}}>kWh</span></div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{parceiros.length} parceiro(s) · {totalKwhGeral>0?(totalKwhParceiros/totalKwhGeral*100).toFixed(1):0}% do total de energia</div>
            </div>
            <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:14,padding:"16px 18px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.amber,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>💰 Custo Energético</div>
              <div style={{fontFamily:T.sans,fontSize:28,fontWeight:800,color:T.amber,marginBottom:4}}>{brl(totalCustoParceiros)}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>Estimativa: {totalKwhParceiros.toFixed(0)} kWh × R${(totalCustoParceiros/Math.max(totalKwhParceiros,1)).toFixed(2)} (custo médio)</div>
            </div>
            <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"16px 18px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.red,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>📊 Faturamento Renunciado</div>
              <div style={{fontFamily:T.sans,fontSize:28,fontWeight:800,color:T.red,marginBottom:4}}>{brl(totalPotencialParceiros)}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>Se cobrado à maior tarifa do local · margem deixada na mesa</div>
            </div>
          </div>
          <Panel style={{padding:0,overflow:"hidden"}}>
            <div onClick={()=>setParceirosExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",cursor:"pointer",borderBottom:parceirosExpanded?`1px solid ${T.border}`:"none"}}>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>📋 Detalhamento de Consumo de Parceiros</div>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{parceirosExpanded?"▲ Recolher":"▼ Expandir"} ({parceiros.length} usuários)</span>
            </div>
            {parceirosExpanded&&(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr><th style={TH}>Usuário</th><th style={THR}>kWh Consumidos</th><th style={THR}>Custo (R$/kWh)</th><th style={THR}>Potencial</th><th style={TH}>Razão da Blindagem</th></tr></thead>
                <tbody>
                  {parceirosDetalhado.map(u=>(
                    <tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                      <td style={TD}><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.teal}}>{u.user.split(" ")[0]}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{trunc(u.user,28)}</div></td>
                      <td style={{...TDR,color:T.blue,fontWeight:600}}>{u.kwh.toFixed(1)}</td>
                      <td style={{...TDR,color:T.amber}}>{brl(u.custo)}</td>
                      <td style={{...TDR,color:T.red,fontWeight:600}}>{brl(u.potencial)}</td>
                      <td style={TD}><span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>💳 Sessão com valor R$0</span></td>
                    </tr>
                  ))}
                  <tr style={{borderTop:`2px solid ${T.border}`}}>
                    <td style={{...TD,fontWeight:700,color:T.text}}>TOTAL</td>
                    <td style={{...TDR,color:T.blue,fontWeight:700}}>{totalKwhParceiros.toFixed(1)}</td>
                    <td style={{...TDR,color:T.amber,fontWeight:700}}>{brl(totalCustoParceiros)}</td>
                    <td style={{...TDR,color:T.red,fontWeight:700}}>{brl(totalPotencialParceiros)}</td>
                    <td style={{...TD,fontFamily:T.mono,fontSize:10,color:T.text3}}>custo pago vs potencial comercial</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      {/* CUPONS */}
      {activeSection==="cupons"&&(
        <>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#fcd34d",marginBottom:20}}>
            ℹ️ Cupons detectados automaticamente: sessões com preço/kWh abaixo de 90% da média da estação. Configure cupons manuais na aba Config → Cupons.
          </div>
          <Panel style={{padding:0,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><th style={TH}>Usuário</th><th style={TH}>Estação</th><th style={THR}>Preço/kWh médio</th><th style={THR}>Preço praticado</th><th style={THR}>Desconto</th><th style={TH}>Origem</th></tr></thead>
              <tbody>
                {usersComCupom.length===0&&<tr><td colSpan={6} style={{...TD,textAlign:"center",color:T.text3,padding:"24px"}}>Nenhum cupom detectado no período</td></tr>}
                {usersComCupom.map(u=>{
                  const hk=u.localFreqKey;
                  const preco=precosPraticados[hk]||0;
                  const desc=preco>0?((1-(u.precoMedioKwh/preco))*100):0;
                  const cupomManual=appState.cupons.find(c=>c.usuario.toLowerCase()===u.user.toLowerCase());
                  return(<tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                    <td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,20)}</span></td>
                    <td style={TD}><span style={{fontSize:10,fontFamily:T.mono,color:T.text2}}>{hubNome(hk)}</span></td>
                    <td style={{...TDR,color:T.text2}}>R${preco.toFixed(2)}/kWh</td>
                    <td style={{...TDR,color:T.amber,fontWeight:600}}>R${u.precoMedioKwh.toFixed(2)}/kWh</td>
                    <td style={{...TDR,color:T.red,fontWeight:600}}>{desc.toFixed(0)}% off</td>
                    <td style={TD}>
                      {cupomManual?<span style={{fontFamily:T.mono,fontSize:9,color:T.amber,background:"rgba(245,158,11,0.15)",padding:"2px 8px",borderRadius:4}}>📋 {cupomManual.motivo} · até {cupomManual.validade}</span>:<span style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>🔍 detectado por preço</span>}
                    </td>
                  </tr>);
                })}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}

// ─── TAB DRE ─────────────────────────────────────────────────────────────────
function TabDRE({sessions,appState}:{sessions:Session[];appState:AppState}){
  const hubs=useMemo(()=>Array.from(new Set(sessions.map(s=>s.hubKey))).sort(),[sessions]);
  const[station,setStation]=useState(hubs[0]||"");
  const cfg=appState.dreConfigs[station]||null;
  const sessoes=sessions.filter(s=>!s.cancelled&&s.energy>0&&s.hubKey===station);
  const datas=sessoes.map(s=>s.date.getTime());
  const dtMin=datas.length?new Date(Math.min(...datas)):new Date();
  const dtMax=datas.length?new Date(Math.max(...datas)):new Date();
  const periodDays=Math.max(1,Math.round((dtMax.getTime()-dtMin.getTime())/86400000)+1);
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
    if(cfg.pctEspaco>0)dreRows.push({label:`(−) Parceiro Espaço (${cfg.pctEspaco}%)`,val:-custoEspaco});
    dreRows.push({label:`(−) Imposto (${aliq.toFixed(1)}%${cfg.modelo==="propria"?" Simples":" bruto"})`,val:-impostoVal});
    dreRows.push({label:`(−) App/Plataforma (${cfg.pctApp}%)`,val:-custoApp});
    if(cfg.energiaTipo!=="incluido")dreRows.push({label:"(−) Energia",val:-custoEnergia});
    if(cfg.fixoAluguel>0)dreRows.push({label:"(−) Aluguel",val:-cfg.fixoAluguel});
    if(cfg.fixoInternet>0)dreRows.push({label:"(−) Internet / Adm",val:-cfg.fixoInternet});
    dreRows.push({label:"= Lucro Líquido",val:ll,bold:true,sep:true});
    if(cfg.modelo==="investidor")dreRows.push({label:`→ ${cfg.invNome||"Investidor"} (${cfg.invPct}%)`,val:repInv,accent:T.amber});
    dreRows.push({label:`→ HertzGo (${cfg.modelo==="investidor"?100-cfg.invPct:100}%)`,val:repHz,accent:T.green});
  }
  const allHealthScores=hubs.map(h=>({hub:h,hs:calcHealthScore(sessions,appState.dreConfigs[h]||null,h)}));
  const hs=calcHealthScore(sessions,cfg,station);
  const radarData=[{subject:"Financeiro",value:hs.financeiro,fullMark:40},{subject:"Operacional",value:hs.operacional,fullMark:35},{subject:"Investidor",value:hs.investidor,fullMark:25}];
  return(
    <div style={{padding:"24px 28px"}}>
      <SectionLabel>🏥 Station Health Score — Rede HertzGo</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(hubs.length,6)},1fr)`,gap:10,marginBottom:28}}>
        {allHealthScores.map(({hub,hs:h})=>{
          const color=h.status==="saudavel"?T.green:h.status==="atencao"?T.amber:T.red;
          const emoji=h.status==="saudavel"?"🟢":h.status==="atencao"?"🟡":"🔴";
          const tipo=ESTACAO_TIPO[hub]||"contratual";
          return(
            <div key={hub} onClick={()=>setStation(hub)} style={{background:`${color}06`,border:`1px solid ${color}${station===hub?"60":"25"}`,borderRadius:14,padding:"14px",cursor:"pointer",transition:"all 0.2s",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><span style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:T.text}}>{hubNome(hub)}</span><span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:`${color}20`,color,fontFamily:T.mono}}>{tipo}</span></div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:22}}>{emoji}</span><div><div style={{fontFamily:T.sans,fontSize:26,fontWeight:800,color,lineHeight:1}}>{h.total}</div><div style={{fontFamily:T.mono,fontSize:8,color:T.text3}}>/ 100</div></div></div>
              <div style={{height:3,background:T.bg3,borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${h.total}%`,background:color,borderRadius:2,transition:"width 0.8s ease"}}/></div>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,lineHeight:1.4}}>{h.diagnostico}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div style={{fontFamily:T.sans,fontSize:16,fontWeight:700,color:T.text}}>📋 DRE — {hubNome(station)}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{hubs.map(h=>(<button key={h} onClick={()=>setStation(h)} style={{padding:"4px 12px",borderRadius:8,fontFamily:T.mono,fontSize:10,cursor:"pointer",border:`1px solid ${station===h?T.green:T.border}`,background:station===h?T.greenDim:"transparent",color:station===h?T.green:T.text2}}>{hubNome(h)}</button>))}</div>
      </div>
      {sessoes.length>0&&(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}><KpiCard label="Receita Bruta" value={brl(bruto)} sub={`${dtMin.toLocaleDateString("pt-BR")} → ${dtMax.toLocaleDateString("pt-BR")}`} accent={T.green}/><KpiCard label="Lucro Líquido" value={brl(ll)} sub={`Margem ${margem.toFixed(1)}%`} accent={ll>=0?T.green:T.red}/><KpiCard label="Proj. Mensal" value={brl(faturMensal)} sub="base 30 dias" accent={T.amber}/><KpiCard label="Proj. Anual" value={brl(faturAnual)} sub="receita bruta" accent={T.blue}/></div>)}
      {!cfg&&(<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"14px 18px",marginBottom:20,fontFamily:T.mono,fontSize:12,color:T.amber}}>⚙️ Configure o DRE desta estação em <strong>Config → DRE Config</strong> para ver análise financeira completa.</div>)}
      <div style={{display:"grid",gridTemplateColumns:cfg?"1fr 1fr":"1fr",gap:20}}>
        <div>
          {sessoes.length===0?(<Panel><div style={{fontFamily:T.mono,fontSize:12,color:T.text3,padding:"24px 0",textAlign:"center"}}>Nenhuma sessão encontrada para {hubNome(station)}.</div></Panel>):cfg?(
            <Panel>
              <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,marginBottom:16,color:T.text}}>Resultado Financeiro</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:T.mono,fontSize:12}}><thead><tr><th style={TH}>Item</th><th style={THR}>Período</th><th style={THR}>Proj. Mensal</th><th style={THR}>%</th></tr></thead><tbody>{dreRows.map((r,i)=>(<tr key={i} style={{borderTop:r.sep?`1px solid ${T.border}`:"none",borderBottom:"1px solid rgba(255,255,255,0.02)"}}><td style={{...TD,fontWeight:r.bold?700:400,color:r.accent||(r.val>=0?T.text:T.red)}}>{r.label}</td><td style={{...TDR,color:r.accent||(r.val>=0?T.green:T.red),fontWeight:r.bold?700:400}}>{brl(r.val)}</td><td style={{...TDR,color:T.text2}}>{brl(r.val*(diasNoMes/periodDays))}</td><td style={{...TDR,color:T.text3}}>{bruto>0?`${(Math.abs(r.val)/bruto*100).toFixed(1)}%`:"—"}</td></tr>))}</tbody></table>
            </Panel>
          ):(
            <Panel><div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,marginBottom:14,color:T.text}}>Dados do Período</div><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}><KpiCard label="Receita Bruta" value={brl(bruto)} accent={T.green} small/><KpiCard label="kWh Total" value={`${totalKwh.toFixed(0)} kWh`} accent={T.amber} small/><KpiCard label="Sessões" value={`${sessoes.length}`} accent={T.blue} small/><KpiCard label="Preço/kWh" value={`R$\u00a0${(totalKwh>0?bruto/totalKwh:0).toFixed(2)}`} accent={T.purple} small/></div></Panel>
          )}
        </div>
        {cfg&&sessoes.length>0&&(
          <div>
            <Panel style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>🏥 Health Score — {hubNome(station)}</div><div style={{fontFamily:T.sans,fontSize:22,fontWeight:800,color:hs.status==="saudavel"?T.green:hs.status==="atencao"?T.amber:T.red}}>{hs.total}/100</div></div>
              <ResponsiveContainer width="100%" height={180}><RadarChart data={radarData}><PolarGrid stroke={T.border}/><PolarAngleAxis dataKey="subject" tick={{fill:T.text2,fontSize:11,fontFamily:T.mono}}/><Radar name="Score" dataKey="value" stroke={hs.status==="saudavel"?T.green:hs.status==="atencao"?T.amber:T.red} fill={hs.status==="saudavel"?T.green:hs.status==="atencao"?T.amber:T.red} fillOpacity={0.2}/></RadarChart></ResponsiveContainer>
              <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:10}}>{hs.diagnostico}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{[{l:"💰 Financeiro",v:hs.financeiroDet},{l:"⚡ Operacional",v:hs.operacionalDet},{l:"🤝 Investidor",v:hs.investidorDet}].map((d,i)=>(<div key={i} style={{background:T.bg3,borderRadius:8,padding:"8px 10px"}}><div style={{fontFamily:T.mono,fontSize:9,color:T.text2,marginBottom:3}}>{d.l}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,lineHeight:1.4}}>{d.v}</div></div>))}</div>
            </Panel>
            {cfg.modelo==="investidor"&&(
              <Panel>
                <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,marginBottom:14,color:T.text}}>👤 Painel do Investidor — {cfg.invNome}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  <KpiCard label="Retorno Período" value={brl(repInv)} sub={`${brl(retMensalInv)}/mês proj.`} accent={T.amber} small/>
                  <KpiCard label="Rentabilidade Anual" value={`${rentAnual.toFixed(1)}%`} sub="sobre capital total" accent={rentAnual>=12?T.green:T.amber} small/>
                  <KpiCard label="Payback Estimado" value={mesesPay===Infinity?"—":mesesPay<12?`${Math.ceil(mesesPay)} meses`:`${(mesesPay/12).toFixed(1)} anos`} sub="para amortizar saldo" accent={mesesPay<=36?T.green:T.amber} small/>
                  <KpiCard label="Saldo Devedor" value={faltaAmort<=0?"✅ Quitado":brl(faltaAmort)} sub={faltaAmort<=0?"Payback completo!":"restante"} accent={faltaAmort<=0?T.green:T.red} small/>
                </div>
                <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>📊 Progresso do Payback</div>
                <div style={{background:T.bg3,borderRadius:6,height:22,overflow:"hidden",position:"relative",border:`1px solid ${T.border}`}}>
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

// ─── TAB AÇÕES ───────────────────────────────────────────────────────────────
function TabAcoes({sessions,appState,onSaveDisparos}:{sessions:Session[];appState:AppState;onSaveDisparos:(d:AppState["disparos"])=>void}){
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const[zapiStatus,setZapiStatus]=useState<"unknown"|"ok"|"err">("unknown");
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

  const enviarUm=async(user:string,hubK:string,msgId:string,template:string,cupom:string="")=>{
    const tel=getTel(user);if(!tel)return;
    setSending(p=>({...p,[`${user}_${msgId}`]:true}));
    const msg=montarMsg(template,user,hubK,cupom);
    try{
      const r=await fetch("/api/zapi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:tel,message:msg})});
      const d=await r.json();
      const entry={ts:new Date().toISOString(),nome:user,msgId,status:d.ok?"ok" as const:"err" as const,msg:d.erro};
      const updated=[entry,...localDisparos.slice(0,199)];setLocalDisparos(updated);onSaveDisparos(updated);
    }catch{
      const entry={ts:new Date().toISOString(),nome:user,msgId,status:"err" as const,msg:"Erro de rede"};
      const updated=[entry,...localDisparos.slice(0,199)];setLocalDisparos(updated);onSaveDisparos(updated);
    }
    setSending(p=>({...p,[`${user}_${msgId}`]:false}));
  };

  const[selecionados,setSelecionados]=useState<Record<string,string[]>>({});
  const getSel=(section:string)=>new Set(selecionados[section]||[]);
  const toggleSel=(section:string,user:string)=>setSelecionados(p=>{const s=new Set(p[section]||[]);s.has(user)?s.delete(user):s.add(user);return{...p,[section]:Array.from(s)};});
  const toggleTodos=(section:string,lista:UserData[])=>setSelecionados(p=>{const curr=new Set(p[section]||[]);const comTel=lista.filter(u=>getTel(u.user)).map(u=>u.user);const updated=curr.size===comTel.length?new Set<string>():new Set(comTel);return{...p,[section]:Array.from(updated)};});

  const[enviandoLote,setEnviandoLote]=useState<Record<string,boolean>>({});
  const enviarLote=async(section:string,lista:UserData[],msgId:string,template:string,cupom:string="")=>{
    const sel=getSel(section);
    const elegíveis=lista.filter(u=>sel.has(u.user)&&getTel(u.user));
    if(!elegíveis.length){alert("Nenhum selecionado com telefone.");return;}
    if(!confirm(`Disparar para ${elegíveis.length} usuários? Delay de 3s entre envios.`))return;
    setEnviandoLote(p=>({...p,[section]:true}));
    for(let i=0;i<elegíveis.length;i++){await enviarUm(elegíveis[i].user,elegíveis[i].localFreqKey,msgId,template,cupom);if(i<elegíveis.length-1)await new Promise(r=>setTimeout(r,3000));}
    setSelecionados(p=>({...p,[section]:[]}));setEnviandoLote(p=>({...p,[section]:false}));
  };

  // Definição das seções
  const leads1=users.filter(u=>!u.isParceiro&&isCrmAtiva(u.localFreqKey)&&!jaContatado(u.user,"msg1"));
  const motoristasMigracao=users.filter(u=>u.isMotorista&&isCrmAtiva(u.localFreqKey)&&(ESTACAO_PARCERIA.includes(u.localFreqKey)||["mamute","madeiro_sia"].includes(u.localFreqKey))&&!jaContatado(u.user,"msg2a",60));
  const fidelizacao=users.filter(u=>!u.isParceiro&&!u.isMotorista&&(ESTACAO_PROPRIA.includes(u.localFreqKey)||ESTACAO_PARCERIA.includes(u.localFreqKey))&&!jaContatado(u.user,"msg2b",60));
  const vipsAtivos=users.filter(u=>u.isMotorista&&ESTACAO_PROPRIA.includes(u.localFreqKey)&&vipScores[u.user]?.status==="ativo"&&!jaContatado(u.user,"msg_vip",30));
  const emRisco=users.filter(u=>u.isMotorista&&isCrmAtiva(u.localFreqKey)&&["em_risco"].includes(vipScores[u.user]?.status||"")&&!jaContatado(u.user,"msg_risco",14));
  const churned=users.filter(u=>u.isMotorista&&isCrmAtiva(u.localFreqKey)&&vipScores[u.user]?.status==="churned"&&!jaContatado(u.user,"msg_churn",30));

  const secoes=[
    {id:"msg1",emoji:"📤",title:"MSG 1 — Qualificação",sub:"Novos usuários nunca contatados",color:T.red,count:leads1.length,lista:leads1,msgKey:"msg1",cupomKey:"",msgId:"msg1"},
    {id:"msg2a",emoji:"🟢",title:"MSG 2A — Migração Motoristas",sub:"De parceiras/contratuais → estações próprias",color:T.green,count:motoristasMigracao.length,lista:motoristasMigracao,msgKey:"msg2a_parkway",cupomKey:"cupom_parkway",msgId:"msg2a"},
    {id:"msg2b",emoji:"🛒",title:"MSG 2B — Fidelização",sub:"Não motoristas nas estações ativas",color:T.blue,count:fidelizacao.length,lista:fidelizacao,msgKey:"msg2b_parkway",cupomKey:"cupom_parkway",msgId:"msg2b"},
    {id:"msg_vip",emoji:"🏆",title:"MSG VIP — Reengajamento",sub:"Motoristas VIP ativos nas estações próprias",color:T.amber,count:vipsAtivos.length,lista:vipsAtivos,msgKey:"msg2a_vip_parkway",cupomKey:"cupom_vip",msgId:"msg_vip"},
    {id:"msg_risco",emoji:"🟠",title:"MSG Risco — Em risco",sub:"VIPs com frequência caindo",color:"#fb923c",count:emRisco.length,lista:emRisco,msgKey:"msg_risco",cupomKey:"",msgId:"msg_risco"},
    {id:"msg_churn",emoji:"🔴",title:"MSG Churn — Resgatar",sub:"Sumidos há 14+ dias",color:T.red,count:churned.length,lista:churned,msgKey:"msg_churn",cupomKey:"",msgId:"msg_churn"},
  ];

  return(
    <div style={{padding:"24px 28px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <KpiCard label="Z-API Status" value={zapiStatus==="ok"?"✅ Conectada":zapiStatus==="err"?"⚠️ Verificar":"⏳ Testando"} sub="via API Route Vercel" accent={zapiStatus==="ok"?T.green:T.amber} small/>
        <KpiCard label="Fila Total" value={`${secoes.reduce((a,s)=>a+s.count,0)}`} sub="usuários elegíveis" accent={T.red} small/>
        <KpiCard label="Gap Zero Ativo" value={`${localDisparos.filter(d=>d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<30*86400000).length}`} sub="contatados 30d" accent={T.amber} small/>
        <KpiCard label="Total Enviados" value={`${localDisparos.filter(d=>d.status==="ok").length}`} sub="confirmados Z-API" accent={T.green} small/>
      </div>
      {zapiStatus==="err"&&(<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"14px 18px",marginBottom:20,fontFamily:T.mono,fontSize:12,color:T.amber}}>⚠️ Configure em Config → Z-API: <strong>INSTANCE_ID</strong> · <strong>TOKEN</strong> · <strong>CLIENT_TOKEN</strong></div>)}
  {Object.keys(appState.contatos).length===0&&(<div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"14px 18px",marginBottom:20,fontFamily:T.mono,fontSize:12,color:"#60a5fa"}}>ℹ️ Importe o CSV de usuários em <strong>Config → Contatos</strong> para habilitar os disparos por telefone.</div>)}

      {secoes.map(sec=>{
        const isOpen=expandedSection===sec.id;
        const sel=getSel(sec.id);
        const comTel=sec.lista.filter(u=>getTel(u.user));
        const template=getMsgTemplate(sec.msgKey);
        const cupom=sec.cupomKey?getMsgTemplate(sec.cupomKey):"";
        return(
          <div key={sec.id} style={{marginBottom:12,background:T.bg2,border:`1px solid ${isOpen?sec.color+"40":T.border}`,borderRadius:14,overflow:"hidden",transition:"all 0.2s"}}>
            {/* Header colapsável */}
            <div onClick={()=>setExpandedSection(isOpen?null:sec.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:20}}>{sec.emoji}</span>
                <div>
                  <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{sec.title}</div>
                  <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{sec.sub}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:T.mono,fontSize:11,padding:"3px 10px",borderRadius:20,background:`${sec.color}20`,color:sec.color,border:`1px solid ${sec.color}40`}}>{sec.count} elegíveis</span>
                <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>

            {isOpen&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:"16px 18px"}}>
                {/* Mensagem editável inline */}
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:6}}>✉️ Mensagem — editável (não salva no Config)</div>
                  <textarea value={template} onChange={e=>setMsgEdits(p=>({...p,[sec.msgKey]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"10px 12px",borderRadius:10,fontSize:12,fontFamily:T.mono,resize:"vertical",minHeight:80,lineHeight:1.6}}/>
                  {sec.cupomKey&&(<div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}><span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>🎟️ Cupom:</span><input value={cupom} onChange={e=>setMsgEdits(p=>({...p,[sec.cupomKey]:e.target.value}))} style={{background:T.bg3,border:`1px solid ${T.border}`,color:T.amber,padding:"4px 8px",borderRadius:6,fontSize:12,fontFamily:T.mono,width:120}}/></div>)}
                </div>

                {/* Barra de seleção em lote */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"8px 12px",background:T.bg3,borderRadius:8}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:T.mono,fontSize:11,color:T.text2}}>
                    <input type="checkbox" checked={comTel.length>0&&comTel.every(u=>sel.has(u.user))} onChange={()=>toggleTodos(sec.id,sec.lista)} style={{accentColor:sec.color,width:13,height:13}}/>
                    Selecionar todos com telefone ({comTel.length})
                  </label>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {sel.size>0&&<span style={{fontFamily:T.mono,fontSize:11,color:T.text2}}>{sel.size} selecionado(s)</span>}
                    <button onClick={()=>enviarLote(sec.id,sec.lista,sec.msgId,template,cupom)} disabled={enviandoLote[sec.id]||sel.size===0} style={{padding:"5px 14px",borderRadius:8,fontFamily:T.mono,fontSize:11,cursor:sel.size===0?"not-allowed":"pointer",background:sel.size>0?`${sec.color}20`:"rgba(255,255,255,0.04)",border:`1px solid ${sel.size>0?sec.color+"50":T.border}`,color:sel.size>0?sec.color:T.text3,transition:"all 0.2s",opacity:enviandoLote[sec.id]?0.6:1}}>
                      {enviandoLote[sec.id]?"⏳ Enviando...":`🚀 Disparar (${sel.size})`}
                    </button>
                  </div>
                </div>

                {/* Lista usuários */}
                {sec.lista.length===0?(
                  <div style={{fontFamily:T.mono,fontSize:11,color:T.text3,textAlign:"center",padding:"16px"}}>✅ Nenhum usuário elegível nesta fila</div>
                ):(
                  <div style={{maxHeight:280,overflowY:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr><th style={{...TH,width:20}}></th><th style={TH}>Usuário</th><th style={TH}>Hub</th><th style={THR}>kWh</th><th style={THR}>Receita</th><th style={TH}>Telefone</th><th style={THR}>Ação</th></tr></thead>
                      <tbody>
                        {sec.lista.map(u=>{
                          const tel=getTel(u.user);const isSel=sel.has(u.user);
                          const sendKey=`${u.user}_${sec.msgId}`;
                          return(<tr key={u.user} style={{borderBottom:"1px solid rgba(255,255,255,0.02)",background:isSel?`${sec.color}06`:""}}>
                            <td style={{...TD,width:20,textAlign:"center"}}>{tel&&<input type="checkbox" checked={isSel} onChange={()=>toggleSel(sec.id,u.user)} style={{accentColor:sec.color,width:13,height:13,cursor:"pointer"}}/>}</td>
                            <td style={TD}><span style={{fontWeight:500,fontSize:12}}>{trunc(u.user,22)}</span></td>
                            <td style={{...TD,fontSize:11,color:T.text2}}>{hubNome(u.localFreqKey)}</td>
                            <td style={{...TDR,color:T.text2}}>{u.kwh.toFixed(1)}</td>
                            <td style={{...TDR,color:T.green,fontWeight:600}}>{brl(u.rev)}</td>
                            <td style={{...TD,fontSize:11,color:tel?T.green:T.text3}}>{tel||"⚠️ sem tel"}</td>
                            <td style={TDR}>{tel?(<button onClick={()=>enviarUm(u.user,u.localFreqKey,sec.msgId,template,cupom)} disabled={sending[sendKey]} style={{padding:"4px 10px",borderRadius:6,fontFamily:T.mono,fontSize:10,cursor:sending[sendKey]?"not-allowed":"pointer",background:sending[sendKey]?"rgba(255,255,255,0.05)":`${sec.color}20`,border:`1px solid ${sending[sendKey]?T.border:sec.color+"50"}`,color:sending[sendKey]?T.text3:sec.color,transition:"all 0.2s"}}>{sending[sendKey]?"⏳":"📤"}</button>):<span style={{color:T.text3,fontSize:10,fontFamily:T.mono}}>sem tel</span>}</td>
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

      {localDisparos.length>0&&(<><SectionLabel>📋 Histórico de Disparos</SectionLabel><Panel style={{maxHeight:200,overflowY:"auto"}}>{localDisparos.slice(0,50).map((l,i)=>(<div key={i} style={{display:"flex",gap:12,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontFamily:T.mono,fontSize:11}}><span style={{color:T.text3}}>{new Date(l.ts).toLocaleString("pt-BR")}</span><span style={{color:l.status==="ok"?T.green:T.red}}>{l.status==="ok"?"✅":"❌"}</span><span style={{color:T.text}}>{l.nome}</span><span style={{color:T.text3,fontSize:9}}>{l.msgId}</span>{l.msg&&<span style={{color:T.red,fontSize:10}}>{l.msg}</span>}</div>))}</Panel></>)}
    </div>
  );
}

// ─── TAB CONFIG ──────────────────────────────────────────────────────────────
function TabConfig({appState,onSave}:{appState:AppState;onSave:(partial:Partial<AppState>)=>void}){
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
  const inputRef=useRef<HTMLInputElement>(null);

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
  useEffect(()=>{setCfg({...defaultCFG,...(dreDefaults[dreStation]||{}),...(appState.dreConfigs[dreStation]||{})});},[dreStation]);

  // Cupons
  const[cupons,setCupons]=useState<CupomRegistro[]>(appState.cupons||[]);
  const[novoCupom,setNovoCupom]=useState<CupomRegistro>({usuario:"",motivo:"",validade:"",estacao:""});
  const[cupomSaved,setCupomSaved]=useState(false);

  // Estações customizadas
  const[estacoesCustom,setEstacoesCustom]=useState<EstacaoCustom[]>(appState.estacoesCustom||[]);
  const[novaEstacao,setNovaEstacao]=useState<EstacaoCustom>({key:"",nome:"",tipo:"propria",ativa:true});
  const[estacaoSaved,setEstacaoSaved]=useState(false);

  const handleContactUpload=async(file:File)=>{
    try{const text=await file.text();const dados=parseContatos(text);const estacaoKey=detectEstacao(file.name,dados);const comTel=dados.filter(d=>d.telefone).length;const updated:Contatos={...appState.contatos,[estacaoKey]:{importadoEm:new Date().toISOString(),total:dados.length,comTelefone:comTel,dados}};onSave({contatos:updated});setUploadStatus(`✅ ${dados.length} usuários · ${comTel} com telefone · Estação: ${hubNome(estacaoKey)}`);}
    catch(e){setUploadStatus(`❌ Erro: ${(e as Error).message}`);}
  };
  const testarZapi=async()=>{setZapiTesting(true);setZapiTestResult("");try{const r=await fetch("/api/zapi");const d=await r.json();setZapiTestResult(d.connected?"✅ Conectada e funcionando":d.configured?"⚠️ Configurada mas desconectada":"❌ Não configurada");}catch{setZapiTestResult("❌ Erro de conexão");}setZapiTesting(false);};
  const exportarBackup=()=>{const data=JSON.stringify(appState,null,2);const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`hertzgo-backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.json`;a.click();URL.revokeObjectURL(url);};

  const inp=(id:keyof DREConfig,label:string,type:"number"|"text"|"select",opts?:string[])=>(
    <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>{label}</div>{type==="select"?(<select value={cfg[id] as string} onChange={e=>setCfg(p=>({...p,[id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}}>{opts?.map(o=><option key={o} value={o}>{o}</option>)}</select>):(<input type={type} min={0} value={cfg[id] as string|number} onChange={e=>setCfg(p=>({...p,[id]:type==="number"?+e.target.value:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}}/>)}</div>
  );

  const msgFields:[keyof Mensagens,string][]=[
    ["msg1","📤 MSG 1 — Qualificação"],["msg2a_parkway","🟢 MSG 2A — Motorista → Park Way"],["msg2a_cidadeauto","🟢 MSG 2A — Motorista → Cidade do Automóvel"],
    ["msg2a_vip_parkway","🏆 MSG VIP — Park Way"],["msg2a_vip_cidadeauto","🏆 MSG VIP — Cidade Auto"],
    ["msg2b_costa","🛒 MSG 2B — Costa (supermercado)"],["msg2b_parkway","💚 MSG 2B — Park Way"],["msg2b_cidadeauto","💚 MSG 2B — Cidade Auto"],
    ["msg_boasvindas_rede","🌱 Boas-vindas — 1ª vez na rede"],["msg_boasvindas_estacao","📍 Boas-vindas — 1ª vez na estação"],
    ["msg_risco","🟠 MSG Risco"],["msg_churn","🔴 MSG Churn"],
    ["cupom_parkway","🎟️ Cupom Park Way"],["cupom_cidadeauto","🎟️ Cupom Cidade do Automóvel"],["cupom_costa","🎟️ Cupom Costa Atacadão"],["cupom_vip","🎟️ Cupom VIP"],
  ];

  const estacoesDRE=[
    {key:"costa",nome:"Costa Atacadão",tipo:"Parceria"},{key:"parkway",nome:"Park Way",tipo:"Própria"},
    {key:"cidadeauto",nome:"Cidade do Automóvel",tipo:"Própria"},{key:"mamute",nome:"Lava Jato do Mamute",tipo:"Contratual"},
    {key:"madeiro_sia",nome:"Madeiro & Jerônimo SIA",tipo:"Contratual"},{key:"madeiro_sp",nome:"Madeiro & Jerônimo SP",tipo:"Contratual"},
    ...estacoesCustom.map(e=>({key:e.key,nome:e.nome,tipo:e.tipo})),
  ];

  return(
    <div style={{padding:"24px 28px"}}>
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        {([["contatos","📱 Contatos"],["mensagens","✉️ Mensagens"],["dre","💼 DRE Config"],["cupons","🎟️ Cupons"],["estacoes","🏪 Estações"],["zapi","🔌 Z-API"]] as [string,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setActiveSection(id as typeof activeSection)} style={{padding:"7px 16px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeSection===id?T.green:T.border}`,background:activeSection===id?T.greenDim:"transparent",color:activeSection===id?T.green:T.text2,transition:"all 0.2s"}}>{label}</button>
        ))}
        <button onClick={exportarBackup} style={{marginLeft:"auto",padding:"7px 16px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:"1px solid rgba(59,130,246,0.3)",background:"rgba(59,130,246,0.08)",color:"#60a5fa"}}>⬇️ Exportar Backup</button>
      </div>

      {/* CONTATOS */}
      {activeSection==="contatos"&&(
        <>
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#93c5fd",marginBottom:20}}>ℹ️ Importe o CSV de usuários. A estação é detectada automaticamente. Faça 1x por semana.</div>
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:14,padding:"24px",marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>📂</div>
            <div style={{fontFamily:T.sans,fontSize:15,fontWeight:600,color:T.text,marginBottom:6}}>Importar CSV de Usuários</div>
            <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,marginBottom:20}}>Estação detectada automaticamente</div>
            <input ref={inputRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleContactUpload(e.target.files[0]);}}/>
            <button onClick={()=>inputRef.current?.click()} style={{background:T.greenDim,border:"1px solid rgba(0,229,160,0.3)",color:T.green,padding:"10px 28px",borderRadius:10,fontSize:13,cursor:"pointer",fontFamily:T.sans,fontWeight:600}}>Selecionar CSV</button>
            {uploadStatus&&<div style={{marginTop:14,fontFamily:T.mono,fontSize:11,color:uploadStatus.startsWith("✅")?T.green:T.red}}>{uploadStatus}</div>}
          </div>
          {Object.keys(appState.contatos).length>0&&(<><SectionLabel>Contatos Importados</SectionLabel><div style={{display:"grid",gap:10}}>{Object.entries(appState.contatos).map(([key,c])=>(<div key={key} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{hubNome(key)}</div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{c.total} usuários · {c.comTelefone} com telefone · {new Date(c.importadoEm).toLocaleDateString("pt-BR")}</div></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{height:6,width:80,background:T.bg3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${c.total>0?(c.comTelefone/c.total*100).toFixed(0):0}%`,background:T.green,borderRadius:3}}/></div><span style={{fontFamily:T.mono,fontSize:10,color:T.green}}>{c.total>0?(c.comTelefone/c.total*100).toFixed(0):0}%</span></div></div>))}</div></>)}
        </>
      )}

      {/* MENSAGENS */}
      {activeSection==="mensagens"&&(
        <>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#fcd34d",marginBottom:20}}>ℹ️ Use [nome], [local], [cupom] e [beneficio] — substituídos automaticamente no envio.</div>
          {msgFields.map(([key,label])=>(<div key={key} style={{marginBottom:16}}><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:6}}>{label}</div><textarea value={msgs[key]} onChange={e=>setMsgs(p=>({...p,[key]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"10px 12px",borderRadius:10,fontSize:12,fontFamily:T.mono,resize:"vertical",minHeight:key.startsWith("cupom")?40:80,lineHeight:1.6}}/></div>))}
          <button onClick={()=>{onSave({mensagens:msgs});setMsgSaved(true);setTimeout(()=>setMsgSaved(false),2000);}} style={{background:msgSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${msgSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 20px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono,transition:"all 0.3s"}}>{msgSaved?"✅ Mensagens salvas!":"💾 Salvar Mensagens"}</button>
        </>
      )}

      {/* DRE CONFIG */}
      {activeSection==="dre"&&(
        <>
          <div style={{background:"rgba(0,229,160,0.06)",border:"1px solid rgba(0,229,160,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:T.green,marginBottom:20}}>ℹ️ Configure uma vez por estação. Valores pré-carregados. Só altere quando houver mudança contratual.</div>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>{estacoesDRE.map(e=>(<button key={e.key} onClick={()=>setDreStation(e.key)} style={{padding:"6px 14px",borderRadius:8,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${dreStation===e.key?T.green:T.border}`,background:dreStation===e.key?T.greenDim:"transparent",color:dreStation===e.key?T.green:T.text2,transition:"all 0.2s"}}>{e.nome} <span style={{fontSize:9,opacity:0.7}}>({e.tipo})</span></button>))}</div>
          <Panel>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontFamily:T.sans,fontSize:15,fontWeight:600,color:T.text}}>⚙️ {hubNome(dreStation)}</div>
              <button onClick={()=>{onSave({dreConfigs:{...appState.dreConfigs,[dreStation]:cfg}});setDreSaved(true);setTimeout(()=>setDreSaved(false),2000);}} style={{background:dreSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${dreSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"6px 18px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:T.mono,transition:"all 0.3s"}}>{dreSaved?"✅ Salvo":"💾 Salvar"}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              {inp("modelo","Modelo","select",["investidor","propria"])}{inp("pctEspaco","% Parceiro Espaço","number")}{inp("pctImposto","% Imposto","number")}
              {inp("pctApp","% App/Plataforma","number")}{inp("fixoInternet","Internet / Adm (R$)","number")}{inp("fixoAluguel","Aluguel (R$)","number")}
              {inp("energiaTipo","Custo Energia","select",["incluido","kwh","usina"])}{cfg.energiaTipo==="kwh"&&inp("energiaKwh","R$ / kWh","number")}{cfg.energiaTipo==="usina"&&inp("usinaFixo","Custo Usina (R$)","number")}
              {inp("custoParceiro","Custo kWh Parceiro (R$)","number")}
            </div>
            {cfg.modelo==="investidor"&&(<><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"16px 0 12px",borderTop:`1px solid ${T.border}`,paddingTop:14}}>Investidor / Split</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{inp("invNome","Nome Investidor","text")}{inp("invPct","% Investidor do LL","number")}{inp("invTotal","Investimento Total","number")}{inp("invPago","Já Investido","number")}{inp("invDividaPrio","Dívida Prioritária","number")}{inp("invAmort","Já Amortizado","number")}</div></>)}
            {cfg.modelo==="propria"&&(<><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,letterSpacing:"0.12em",textTransform:"uppercase" as const,margin:"16px 0 12px",borderTop:`1px solid ${T.border}`,paddingTop:14}}>Loja Própria</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{inp("propriaInstalacao","Custo Instalação","number")}{inp("propriaAmort","Já Amortizado","number")}</div></>)}
            <label style={{display:"flex",alignItems:"center",gap:8,marginTop:16,cursor:"pointer",fontFamily:T.mono,fontSize:11,color:T.text2}}><input type="checkbox" checked={cfg.solarProprio} onChange={e=>setCfg(p=>({...p,solarProprio:e.target.checked}))} style={{accentColor:"#ffd600",width:14,height:14}}/>☀️ Investidor com Usina Solar Própria (energia = R$0)</label>
          </Panel>
        </>
      )}

      {/* CUPONS */}
      {activeSection==="cupons"&&(
        <>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#fcd34d",marginBottom:20}}>
            ℹ️ Registre cupons manuais aqui. Cupons automáticos são detectados na aba Usuários → Cupons por análise de preço.
          </div>
          <Panel style={{marginBottom:16}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>➕ Adicionar Cupom Manual</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              {[{id:"usuario",label:"Usuário"},{id:"motivo",label:"Motivo"},{id:"validade",label:"Validade (ex: 2026-06-30)"},{id:"estacao",label:"Estação"}].map(f=>(<div key={f.id}><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>{f.label}</div><input value={novoCupom[f.id as keyof CupomRegistro]} onChange={e=>setNovoCupom(p=>({...p,[f.id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}}/></div>))}
            </div>
            <button onClick={()=>{if(!novoCupom.usuario)return;const updated=[...cupons,novoCupom];setCupons(updated);onSave({cupons:updated});setNovoCupom({usuario:"",motivo:"",validade:"",estacao:""});setCupomSaved(true);setTimeout(()=>setCupomSaved(false),1500);}} style={{background:cupomSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${cupomSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"7px 18px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:T.mono}}>{cupomSaved?"✅ Adicionado!":"➕ Adicionar"}</button>
          </Panel>
          <Panel style={{padding:0,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><th style={TH}>Usuário</th><th style={TH}>Motivo</th><th style={TH}>Estação</th><th style={TH}>Validade</th><th style={TH}>Status</th><th style={THR}>Ação</th></tr></thead>
              <tbody>
                {cupons.length===0&&<tr><td colSpan={6} style={{...TD,textAlign:"center",color:T.text3,padding:"20px"}}>Nenhum cupom registrado</td></tr>}
                {cupons.map((c,i)=>{
                  const vencido=c.validade&&new Date(c.validade)<new Date();
                  return(<tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.02)"}}><td style={TD}>{trunc(c.usuario,20)}</td><td style={{...TD,color:T.text2,fontSize:11}}>{c.motivo}</td><td style={{...TD,fontSize:11,color:T.text2}}>{c.estacao||"—"}</td><td style={{...TD,fontSize:11,fontFamily:T.mono,color:vencido?T.red:T.green}}>{c.validade||"—"}</td><td style={TD}><span style={{fontFamily:T.mono,fontSize:10,padding:"2px 8px",borderRadius:4,background:vencido?"rgba(239,68,68,0.15)":"rgba(0,229,160,0.15)",color:vencido?T.red:T.green}}>{vencido?"⚠️ Vencido":"✅ Ativo"}</span></td><td style={TDR}><button onClick={()=>{const updated=cupons.filter((_,j)=>j!==i);setCupons(updated);onSave({cupons:updated});}} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:T.red,padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:T.mono}}>Remover</button></td></tr>);
                })}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {/* ESTAÇÕES */}
      {activeSection==="estacoes"&&(
        <>
          <div style={{background:"rgba(0,229,160,0.06)",border:"1px solid rgba(0,229,160,0.2)",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:T.green,marginBottom:20}}>
            ℹ️ Adicione novas estações aqui. Elas aparecerão automaticamente no dashboard, DRE e Ações sem precisar alterar o código.
          </div>
          <Panel style={{marginBottom:16}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>➕ Adicionar Nova Estação</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>Nome da Estação</div><input value={novaEstacao.nome} onChange={e=>setNovaEstacao(p=>({...p,nome:e.target.value,key:e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"_")}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}} placeholder="Ex: Park Way Norte"/></div>
              <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>Tipo</div><select value={novaEstacao.tipo} onChange={e=>setNovaEstacao(p=>({...p,tipo:e.target.value as EstacaoCustom["tipo"]}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}}><option value="propria">Própria</option><option value="parceria">Parceria</option><option value="contratual">Contratual</option></select></div>
              <div><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>Key (auto)</div><input value={novaEstacao.key} readOnly style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text3,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}}/></div>
              <div style={{display:"flex",alignItems:"flex-end"}}><button onClick={()=>{if(!novaEstacao.nome||!novaEstacao.key)return;const updated=[...estacoesCustom,novaEstacao];setEstacoesCustom(updated);onSave({estacoesCustom:updated});setNovaEstacao({key:"",nome:"",tipo:"propria",ativa:true});setEstacaoSaved(true);setTimeout(()=>setEstacaoSaved(false),1500);}} style={{background:estacaoSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${estacaoSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"7px 18px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:T.mono,width:"100%"}}>{estacaoSaved?"✅ Adicionada!":"➕ Adicionar"}</button></div>
            </div>
          </Panel>
          <SectionLabel>Estações Padrão</SectionLabel>
          <div style={{display:"grid",gap:8,marginBottom:20}}>
            {[{key:"costa",nome:"Costa Atacadão",tipo:"Parceria"},{key:"parkway",nome:"Park Way",tipo:"Própria"},{key:"cidadeauto",nome:"Cidade do Automóvel",tipo:"Própria"},{key:"mamute",nome:"Lava Jato do Mamute",tipo:"Contratual"},{key:"madeiro_sia",nome:"Madeiro & Jerônimo SIA",tipo:"Contratual"},{key:"madeiro_sp",nome:"Madeiro & Jerônimo SP",tipo:"Contratual"}].map(e=>(
              <div key={e.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px"}}><div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{e.nome}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{e.key} · {e.tipo}</div></div><span style={{fontFamily:T.mono,fontSize:9,padding:"2px 8px",borderRadius:4,background:e.tipo==="Própria"?"rgba(0,229,160,0.15)":"rgba(255,255,255,0.05)",color:e.tipo==="Própria"?T.green:T.text3}}>Padrão</span></div>
            ))}
          </div>
          {estacoesCustom.length>0&&(<><SectionLabel>Estações Customizadas</SectionLabel><div style={{display:"grid",gap:8}}>{estacoesCustom.map((e,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px"}}><div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{e.nome}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{e.key} · {e.tipo}</div></div><button onClick={()=>{const updated=estacoesCustom.filter((_,j)=>j!==i);setEstacoesCustom(updated);onSave({estacoesCustom:updated});}} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:T.red,padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:T.mono}}>Remover</button></div>))}</div></>)}
        </>
      )}

      {/* Z-API */}
      {activeSection==="zapi"&&(
        <Panel>
          <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,marginBottom:16,color:T.text}}>📱 Z-API — Configuração WhatsApp</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
            {([{id:"instanceId" as keyof ZAPIConfig,label:"ID da Instância",placeholder:"Ex: 3DF217DC18D...",desc:"Z-API → Instâncias → ID"},{id:"token" as keyof ZAPIConfig,label:"Token da Instância",placeholder:"Token...",desc:"Z-API → Instâncias → Token"},{id:"clientToken" as keyof ZAPIConfig,label:"Client-Token *obrigatório",placeholder:"Client-Token...",desc:"Z-API → Conta → Security"}] as {id:keyof ZAPIConfig;label:string;placeholder:string;desc:string}[]).map(f=>(<div key={f.id}><div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:4}}>{f.label}</div><input type={f.id==="instanceId"?"text":"password"} value={zapi[f.id]} placeholder={f.placeholder} onChange={e=>setZapi(p=>({...p,[f.id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"8px 10px",borderRadius:8,fontSize:12,fontFamily:T.mono}}/><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginTop:4}}>{f.desc}</div></div>))}
          </div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button onClick={()=>{onSave({zapi});setZapiSaved(true);setTimeout(()=>setZapiSaved(false),2000);}} style={{background:zapiSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${zapiSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 20px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono,transition:"all 0.3s"}}>{zapiSaved?"✅ Credenciais salvas!":"💾 Salvar Credenciais"}</button>
            <button onClick={testarZapi} disabled={zapiTesting} style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",color:"#60a5fa",padding:"8px 20px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{zapiTesting?"⏳ Testando...":"🔌 Testar Conexão"}</button>
          </div>
          {zapiTestResult&&(<div style={{fontFamily:T.mono,fontSize:12,color:zapiTestResult.startsWith("✅")?T.green:zapiTestResult.startsWith("⚠️")?T.amber:T.red,padding:"10px 14px",background:"rgba(255,255,255,0.04)",borderRadius:8,marginBottom:16}}>{zapiTestResult}</div>)}
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 14px",fontFamily:T.mono,fontSize:11,color:"#93c5fd",marginBottom:16}}>ℹ️ Credenciais salvas no browser. Para segurança máxima, configure também as variáveis de ambiente no Vercel.</div>
          <div style={{fontFamily:T.mono,fontSize:11,color:T.text2,lineHeight:2}}>
            <div>⚡ <strong style={{color:T.text}}>HertzGo Vision v4.0</strong></div>
            <div>📊 Logo · Health Score · DRE Config · Ações 6 filas · Novos usuários · Parceiros auditoria · Cupons · Estações dinâmicas · Matriz priorização</div>
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
  const[activeHub,setActiveHub]=useState("__all__");
  const savePartial=(partial:Partial<AppState>)=>{setAppState(prev=>{const next={...prev,...partial};saveState(next);return next;});};
  const currentMeta=activeHub==="__all__"?0:(appState.metas[activeHub]||0);
  const setCurrentMeta=(v:number)=>{if(activeHub!=="__all__")savePartial({metas:{...appState.metas,[activeHub]:v}});};
  const saveDisparos=(d:AppState["disparos"])=>savePartial({disparos:d});
  const dts=sessions?sessions.map(s=>s.date.getTime()):[];
  const okSess=sessions?sessions.filter(s=>!s.cancelled&&s.energy>0).length:0;
  const uniqHubs=sessions?new Set(sessions.map(s=>s.hubKey)).size:0;
  const hasMove=sessions?sessions.some(s=>s.source==="move"):false;
  const hasSpott=sessions?sessions.some(s=>s.source==="spott"):false;
  const navItems:{id:Tab;label:string;icon:string}[]=[
    {id:"dash",label:"Dashboard",icon:"📊"},{id:"usuarios",label:"Usuários",icon:"👥"},
    {id:"dre",label:"DRE",icon:"💼"},{id:"acoes",label:"Ações",icon:"🎯"},{id:"config",label:"Config",icon:"⚙️"},
  ];
  if(!sessions)return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:T.sans}}><UploadScreen onFile={setSessions}/></div>);
  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:T.bg,color:T.text,fontFamily:T.sans}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",height:60,background:"rgba(8,10,15,0.97)",borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100,backdropFilter:"blur(16px)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <HertzGoLogo size={28}/>
          <div style={{fontFamily:T.mono,fontSize:9,color:T.text2,letterSpacing:"0.12em",textTransform:"uppercase",marginLeft:4}}>Vision · Rede EV</div>
        </div>
        <nav style={{display:"flex",gap:4}}>
          {navItems.map(n=>(<button key={n.id} onClick={()=>setTab(n.id)} style={{padding:"6px 14px",borderRadius:10,fontFamily:T.sans,fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${tab===n.id?T.green:T.border}`,background:tab===n.id?T.greenDim:"transparent",color:tab===n.id?T.green:T.text2,transition:"all 0.2s",boxShadow:tab===n.id?"0 0 16px rgba(0,229,160,0.2)":"none"}}><span style={{marginRight:5}}>{n.icon}</span>{n.label}</button>))}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {hasSpott&&<span style={{fontFamily:T.mono,fontSize:9,padding:"2px 8px",borderRadius:4,background:"rgba(0,229,160,0.1)",color:T.green,border:"1px solid rgba(0,229,160,0.2)"}}>Spott</span>}
          {hasMove&&<span style={{fontFamily:T.mono,fontSize:9,padding:"2px 8px",borderRadius:4,background:"rgba(59,130,246,0.1)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)"}}>Move</span>}
          <span style={{fontFamily:T.mono,fontSize:10,padding:"3px 10px",borderRadius:20,background:T.greenDim,color:T.green,border:"1px solid rgba(0,229,160,0.2)"}}>{okSess} sessões</span>
          <span style={{fontFamily:T.mono,fontSize:10,padding:"3px 10px",borderRadius:20,background:"rgba(59,130,246,0.1)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)"}}>{uniqHubs} hubs</span>
          <button onClick={()=>{setSessions(null);setTab("dash");}} style={{padding:"4px 12px",borderRadius:20,fontFamily:T.mono,fontSize:10,cursor:"pointer",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",color:T.red}}>↩ Novo CSV</button>
        </div>
      </header>
      <main style={{flex:1}}>
        {tab==="dash"&&<TabDashboard sessions={sessions} meta={currentMeta} onMetaChange={setCurrentMeta}/>}
        {tab==="usuarios"&&<TabUsuarios sessions={sessions} appState={appState}/>}
        {tab==="dre"&&<TabDRE sessions={sessions} appState={appState}/>}
        {tab==="acoes"&&<TabAcoes sessions={sessions} appState={appState} onSaveDisparos={saveDisparos}/>}
        {tab==="config"&&<TabConfig appState={appState} onSave={savePartial}/>}
      </main>
      <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 28px",background:"rgba(8,10,15,0.97)",borderTop:`1px solid ${T.border}`,fontFamily:T.mono,fontSize:10,color:T.text3,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:T.green,boxShadow:`0 0 6px ${T.green}`,display:"inline-block"}}/>
          {sessions.length} registros · {okSess} válidos · {uniqHubs} estações
          {dts.length>0&&` · ${new Date(Math.min(...dts)).toLocaleDateString("pt-BR")} → ${new Date(Math.max(...dts)).toLocaleDateString("pt-BR")}`}
        </div>
        <div>⚡ HertzGo Vision v4.0</div>
      </footer>
    </div>
  );
}
