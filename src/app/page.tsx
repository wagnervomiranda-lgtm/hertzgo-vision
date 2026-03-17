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
type Tab = "dash" | "dre" | "usuarios" | "acoes" | "config" | "relatorio";

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
      {sub&&<div style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{sub}</div>}
    </div>
  );
}
function SectionLabel({children}:{children:string}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,fontFamily:T.mono,fontSize:9,color:T.text3,letterSpacing:"0.18em",textTransform:"uppercase" as const,margin:"24px 0 12px"}}>
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

// ─── TAB DASHBOARD ───────────────────────────────────────────────────────────
function TabDashboard({sessions,meta,onMetaChange}:{sessions:Session[];meta:number;onMetaChange:(v:number)=>void}){
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
  const dcSess=ok.filter(s=>/DC/i.test(s.charger)),acSess=ok.filter(s=>/AC/i.test(s.charger));
  const dcRev=dcSess.reduce((a,s)=>a+s.value,0),acRev=acSess.reduce((a,s)=>a+s.value,0);
  const dcKwh=dcSess.reduce((a,s)=>a+s.energy,0),acKwh=acSess.reduce((a,s)=>a+s.energy,0);
  const byDay:Record<string,{date:Date;rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{const k=s.date.toDateString();if(!byDay[k])byDay[k]={date:s.date,rev:0,kwh:0,sess:0};byDay[k].rev+=s.value;byDay[k].kwh+=s.energy;byDay[k].sess++;});
  const dayData=Object.values(byDay).sort((a,b)=>a.date.getTime()-b.date.getTime()).map(d=>({date:fmtDate(d.date),rev:+d.rev.toFixed(2),kwh:+d.kwh.toFixed(0),sess:d.sess}));
  const avgRev=totalRev/days;
  const hubMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!hubMap[s.hubKey])hubMap[s.hubKey]={rev:0,kwh:0,sess:0};hubMap[s.hubKey].rev+=s.value;hubMap[s.hubKey].kwh+=s.energy;hubMap[s.hubKey].sess++;});
  const hubData=Object.entries(hubMap).sort((a,b)=>b[1].rev-a[1].rev).map(([key,d])=>({name:trunc(hubNome(key),isMobile?10:20),rev:+d.rev.toFixed(0),sess:d.sess,kwh:+d.kwh.toFixed(0)}));
  const userMap:Record<string,{rev:number;kwh:number;sess:number}>={};
  ok.forEach(s=>{if(!userMap[s.user])userMap[s.user]={rev:0,kwh:0,sess:0};userMap[s.user].rev+=s.value;userMap[s.user].kwh+=s.energy;userMap[s.user].sess++;});
  const top5=Object.entries(userMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);
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
      <Semaforo sessions={filtered}/>
      <ProjecaoMensal sessions={filtered} meta={meta} onMetaChange={onMetaChange}/>
      <SectionLabel>KPIs do Período</SectionLabel>
      {/* KPIs — 2 colunas no mobile, 4 no desktop */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <KpiCard label="Faturamento" value={brl(totalRev)} sub={`R$\u00a0${(totalRev/days).toFixed(0)}/dia`} accent={T.green}/>
        <KpiCard label="Energia" value={`${totalKwh.toFixed(0)} kWh`} sub={`${(totalKwh/days).toFixed(0)}/dia`} accent={T.amber}/>
        <KpiCard label="Sessões" value={`${totalSess}`} sub={`${(totalSess/days).toFixed(1)}/dia`} accent={T.blue}/>
        <KpiCard label="Preço/kWh" value={`R$\u00a0${priceKwh.toFixed(2)}`} sub={`Ticket: ${brl(ticket)}`} accent={T.red}/>
      </div>
      {/* DC vs AC — empilhado no mobile */}
      {dcSess.length>0&&acSess.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:24}}>
          {[{label:"⚡ DC 120kW",sess:dcSess,rev:dcRev,kwh:dcKwh,color:T.purple,bg:"rgba(139,92,246,0.08)",border:"rgba(139,92,246,0.25)"},{label:"🔌 AC 22kW",sess:acSess,rev:acRev,kwh:acKwh,color:T.green,bg:"rgba(0,229,160,0.08)",border:"rgba(0,229,160,0.25)"}].map((dc,i)=>(
            <div key={i} style={{background:dc.bg,border:`1px solid ${dc.border}`,borderRadius:14,padding:"12px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><span style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:dc.color}}>{dc.label}</span><span style={{fontFamily:T.mono,fontSize:10,color:dc.color,padding:"2px 8px",borderRadius:4,background:`${dc.color}20`}}>{dc.sess.length} sessões</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[{l:"Receita",v:brl(dc.rev)},{l:"kWh",v:dc.kwh.toFixed(0)},{l:"Ticket",v:brl(dc.sess.length>0?dc.rev/dc.sess.length:0)}].map((k,j)=>(<div key={j}><div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginBottom:3}}>{k.l}</div><div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:dc.color}}>{k.v}</div></div>))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Gráficos — empilhados no mobile */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr",gap:14,marginBottom:24}}>
        <Panel>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>Performance por Hub</div>
            <div style={{display:"flex",gap:4}}>{([["rev","R$"],["kwh","kWh"],["sess","Sess"]] as [typeof chartMode,string][]).map(([m,l])=>(<button key={m} onClick={()=>setChartMode(m)} style={{padding:"3px 9px",borderRadius:6,fontFamily:T.mono,fontSize:10,cursor:"pointer",border:`1px solid ${chartMode===m?T.green:T.border}`,background:chartMode===m?T.greenDim:"transparent",color:chartMode===m?T.green:T.text3}}>{l}</button>))}</div>
          </div>
          <ResponsiveContainer width="100%" height={180}><BarChart data={hubData} barCategoryGap="30%"><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="name" tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false}/><YAxis tickFormatter={v=>chartMode==="rev"?`R$${(v/1000).toFixed(0)}k`:`${v}`} tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={44}/><Tooltip content={<CustomTooltip suffix={chartMode==="rev"?"R$":chartMode==="kwh"?"kWh":""}/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/><Bar dataKey={chartMode} fill={chartMode==="rev"?"rgba(0,229,160,0.65)":chartMode==="kwh"?"rgba(245,158,11,0.65)":"rgba(59,130,246,0.65)"} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,marginBottom:14,color:T.text}}>Top 5 Usuários</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>#</th><th style={TH}>Usuário</th><th style={THR}>Total</th></tr></thead><tbody>{top5.map(([name,d],i)=>{const rc=["#f59e0b","#94a3b8","#b47c3c"][i]||T.text3;return(<tr key={name}><td style={TD}><span style={{fontFamily:T.mono,fontWeight:700,color:rc,fontSize:11}}>{i+1}</span></td><td style={TD}><span style={{fontSize:12,fontWeight:500}}>{trunc(name,isMobile?12:16)}</span></td><td style={{...TDR,color:T.green,fontWeight:600}}>{brl(d.rev)}</td></tr>);})}</tbody></table>
        </Panel>
      </div>
      <SectionLabel>Receita & Sessões Diárias</SectionLabel>
      <Panel style={{marginBottom:24}}>
        <ResponsiveContainer width="100%" height={160}><LineChart data={dayData}><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="date" tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis yAxisId="rev" tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={44}/><YAxis yAxisId="sess" orientation="right" tick={{fill:T.text3,fontSize:9,fontFamily:T.mono}} axisLine={false} tickLine={false} width={24}/><Tooltip contentStyle={{background:T.bg3,border:`1px solid ${T.border2}`,borderRadius:10,fontFamily:T.mono,fontSize:11}}/><ReferenceLine yAxisId="rev" y={avgRev} stroke="rgba(245,158,11,0.4)" strokeDasharray="5 4" strokeWidth={1.5}/><Line yAxisId="rev" dataKey="rev" stroke={T.green} strokeWidth={2} dot={{r:2,fill:T.green}} activeDot={{r:5}} name="Receita"/><Line yAxisId="sess" dataKey="sess" stroke={T.blue} strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Sessões"/></LineChart></ResponsiveContainer>
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
function TabUsuarios({sessions,appState}:{sessions:Session[];appState:AppState}){
  const isMobile=useIsMobile();
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const totalRev=ok.reduce((a,s)=>a+s.value,0);
  const parceiros=users.filter(u=>u.isParceiro),motoristas=users.filter(u=>u.isMotorista);
  const heavys=users.filter(u=>u.isHeavy),shoppers=users.filter(u=>!u.isParceiro&&!u.isMotorista&&!u.isHeavy);
  const telMap:Record<string,string>={};
  Object.values(appState.contatos).forEach(c=>{c.dados.forEach(d=>{if(d.telefone)telMap[d.nome.trim().toLowerCase()]=d.telefone;});});
  const getTel=(nome:string)=>{const n=nome.trim().toLowerCase();if(telMap[n])return telMap[n];const found=Object.keys(telMap).find(k=>k.includes(n)||n.includes(k));return found?telMap[found]:null;};
  const datas=ok.map(s=>s.date.getTime());
  const maxData=datas.length?new Date(Math.max(...datas)):new Date();
  const periodoInicio=datas.length?new Date(Math.min(...datas)):new Date();
  const diasTotal=Math.max(1,Math.round((maxData.getTime()-periodoInicio.getTime())/86400000)+1);
  const cortNovosDias=Math.min(14,Math.ceil(diasTotal*0.2));
  const cortNovos=new Date(maxData.getTime()-cortNovosDias*86400000);
  const usersAntes=new Set(ok.filter(s=>s.date<cortNovos).map(s=>s.user));
  const novosNaRede=users.filter(u=>!usersAntes.has(u.user));
  const novosNaEstacao=users.filter(u=>{
    if(novosNaRede.some(n=>n.user===u.user))return false;
    const sessRecentes=ok.filter(s=>s.user===u.user&&s.date>=cortNovos);
    const hubsRecentes=new Set(sessRecentes.map(s=>s.hubKey));
    const hubsAntigos=new Set(ok.filter(s=>s.user===u.user&&s.date<cortNovos).map(s=>s.hubKey));
    return Array.from(hubsRecentes).some(h=>!hubsAntigos.has(h));
  });
  const totalComTel=users.filter(u=>getTel(u.user)).length;
  const pctCobertura=users.length>0?(totalComTel/users.length*100).toFixed(0):"0";
  const vipScores:Record<string,ReturnType<typeof calcVipScore>>={};
  motoristas.forEach(u=>{vipScores[u.user]=calcVipScore(u.user,ok);});
  const vipOrder:{[k:string]:number}={em_risco:0,churned:1,regular:2,ativo:3};
  const motoristasOrdenados=[...motoristas].sort((a,b)=>(vipOrder[vipScores[a.user]?.status||"ativo"]??3)-(vipOrder[vipScores[b.user]?.status||"ativo"]??3));
  const top10Rev=Object.values(users).sort((a,b)=>b.rev-a.rev).slice(0,10).reduce((a,u)=>a+u.rev,0);
  const concPct=totalRev>0?(top10Rev/totalRev*100):0;
  const hubKeys=Array.from(new Set(ok.map(s=>s.hubKey)));
  const precosPraticados:Record<string,number>={};
  hubKeys.forEach(h=>{precosPraticados[h]=calcPrecoPraticado(ok,h);});
  const usersComCupom=users.filter(u=>{
    const hk=u.localFreqKey;
    if(!hk||!precosPraticados[hk])return false;
    return u.precoMedioKwh>0&&u.precoMedioKwh<precosPraticados[hk]*0.90;
  });
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
  const[activeSection,setActiveSection]=useState<"centro"|"novos"|"vip"|"parceiros"|"cupons">("centro");
  const pad=isMobile?"16px 14px":"24px 28px";
  return(
    <div style={{padding:pad}}>
      {/* KPIs — 2 colunas mobile */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10,marginBottom:20}}>
        <KpiCard label="Usuários" value={`${users.length}`} sub="únicos" accent={T.green}/>
        <KpiCard label="Novos" value={`${novosNaRede.length}`} sub={`${cortNovosDias}d`} accent={T.teal}/>
        <KpiCard label="Motoristas" value={`${motoristas.length}`} sub="prioritários" accent={T.red}/>
        <KpiCard label="Cobertura" value={`${pctCobertura}%`} sub={`${totalComTel} tel.`} accent={+pctCobertura>=70?T.green:T.amber}/>
        <KpiCard label="Concentração" value={`${concPct.toFixed(0)}%`} sub="Top 10" accent={concPct>40?T.red:T.green}/>
      </div>
      {/* Nav interna — scroll horizontal mobile */}
      <div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
        {([["centro","🎯 Decisão"],["novos","🆕 Novos"],["vip","🏆 VIP"],["parceiros","🔵 Parceiros"],["cupons","🎟️ Cupons"]] as [string,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setActiveSection(id as typeof activeSection)} style={{padding:"6px 12px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${activeSection===id?T.green:T.border}`,background:activeSection===id?T.greenDim:"transparent",color:activeSection===id?T.green:T.text2,whiteSpace:"nowrap",flexShrink:0}}>{label}</button>
        ))}
      </div>

      {/* CENTRO DE DECISÃO */}
      {activeSection==="centro"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:24}}>
          <Panel style={{borderLeft:`3px solid ${T.red}`}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.red,marginBottom:10}}>🔴 Requer Ação Agora</div>
            {motoristasOrdenados.filter(u=>["em_risco","churned"].includes(vipScores[u.user]?.status||"")).slice(0,5).map(u=>{
              const v=vipScores[u.user];const sc=v?.status==="em_risco"?"#fb923c":T.red;
              return(<div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,isMobile?16:18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{v?.diasSemRecarga}d sem · {trunc(hubNome(u.localFreqKey),10)}</div></div>
                <span style={{fontFamily:T.mono,fontSize:10,padding:"2px 7px",borderRadius:4,background:`${sc}20`,color:sc}}>{v?.status}</span>
              </div>);
            })}
            {motoristasOrdenados.filter(u=>["em_risco","churned"].includes(vipScores[u.user]?.status||"")).length===0&&<div style={{fontFamily:T.mono,fontSize:11,color:T.text3}}>✅ Nenhum em risco</div>}
          </Panel>
          <Panel style={{borderLeft:`3px solid ${T.amber}`}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.amber,marginBottom:10}}>🟡 Oportunidade</div>
            {heavys.filter(u=>u.kwh>60||u.sess>=3).slice(0,5).map(u=>(
              <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,isMobile?16:18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{u.kwh.toFixed(0)} kWh · {u.sess} sess</div></div>
                <span style={{fontFamily:T.mono,fontSize:9,color:T.amber}}>{brl(u.rev)}</span>
              </div>
            ))}
            {heavys.length===0&&<div style={{fontFamily:T.mono,fontSize:11,color:T.text3}}>Sem heavy users</div>}
          </Panel>
          <Panel style={{borderLeft:`3px solid ${T.teal}`}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.teal,marginBottom:10}}>🆕 Boas-vindas Pendentes</div>
            {novosNaRede.filter(u=>ESTACAO_PROPRIA.includes(u.localFreqKey)&&getTel(u.user)).slice(0,5).map(u=>(
              <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,isMobile?16:18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{hubNome(u.localFreqKey)}</div></div>
                <span style={{fontFamily:T.mono,fontSize:9,color:T.green}}>📞 pronto</span>
              </div>
            ))}
            {novosNaRede.filter(u=>ESTACAO_PROPRIA.includes(u.localFreqKey)).length===0&&<div style={{fontFamily:T.mono,fontSize:11,color:T.text3}}>Sem novos nas próprias</div>}
          </Panel>
          <Panel style={{borderLeft:`3px solid ${T.text3}`}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text2,marginBottom:10}}>📵 Sem Telefone</div>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.text2,marginBottom:8}}>{users.length-totalComTel} usuários sem tel</div>
            {users.filter(u=>!getTel(u.user)&&u.rev>50).sort((a,b)=>b.rev-a.rev).slice(0,5).map(u=>(
              <div key={u.user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                <div><div style={{fontFamily:T.sans,fontSize:12,fontWeight:500,color:T.text}}>{trunc(u.user,isMobile?16:18)}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{u.perfil}</div></div>
                <span style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{brl(u.rev)}</span>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {/* NOVOS */}
      {activeSection==="novos"&&(
        <>
          <div style={{background:"rgba(1,96,112,0.08)",border:"1px solid rgba(1,96,112,0.25)",borderRadius:12,padding:"10px 14px",fontFamily:T.mono,fontSize:11,color:"#5eead4",marginBottom:16}}>
            💡 Boas-vindas apenas nas <strong>estações próprias</strong> (PW + CidAuto).
          </div>
          <NovosColapsavel novosNaRede={novosNaRede} novosNaEstacao={novosNaEstacao} getTel={getTel}/>
        </>
      )}

      {/* VIP */}
      {activeSection==="vip"&&(
        <>
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:"#60a5fa",marginBottom:8}}>📊 VIP Score</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
              {[{status:"🟠 Em Risco",score:"26–50",cor:"#fb923c"},{status:"🔴 Churn",score:"0–25",cor:T.red},{status:"🟡 Regular",score:"51–75",cor:T.amber},{status:"🟢 Ativo",score:"76–100",cor:T.green}].map((s,i)=>(<div key={i} style={{background:`${s.cor}08`,border:`1px solid ${s.cor}25`,borderRadius:10,padding:"8px 10px"}}><div style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:s.cor,marginBottom:2}}>{s.status}</div><div style={{fontFamily:T.mono,fontSize:9,color:T.text3}}>{s.score}</div></div>))}
            </div>
          </div>
          <VipCategorias motoristasOrdenados={motoristasOrdenados} vipScores={vipScores} getTel={getTel}/>
        </>
      )}

      {/* PARCEIROS */}
      {activeSection==="parceiros"&&(
        <>
          <SectionLabel>Auditoria de Parceria</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10,marginBottom:16}}>
            <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.blue,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>⚡ Volume</div>
              <div style={{fontFamily:T.sans,fontSize:24,fontWeight:800,color:T.blue,marginBottom:3}}>{totalKwhParceiros.toFixed(0)} <span style={{fontSize:12}}>kWh</span></div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>{parceiros.length} parceiro(s) · {totalKwhGeral>0?(totalKwhParceiros/totalKwhGeral*100).toFixed(1):0}% do total</div>
            </div>
            <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.amber,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>💰 Custo</div>
              <div style={{fontFamily:T.sans,fontSize:24,fontWeight:800,color:T.amber,marginBottom:3}}>{brl(totalCustoParceiros)}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>Estimativa energética</div>
            </div>
            <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.red,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6}}>📊 Potencial</div>
              <div style={{fontFamily:T.sans,fontSize:24,fontWeight:800,color:T.red,marginBottom:3}}>{brl(totalPotencialParceiros)}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.text2}}>Se cobrado à tarifa normal</div>
            </div>
          </div>
          <Panel style={{padding:0,overflow:"hidden"}}>
            <div onClick={()=>setParceirosExpanded(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer"}}>
              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>📋 Detalhamento</div>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.text3}}>{parceirosExpanded?"▲":"▼"} ({parceiros.length})</span>
            </div>
            {parceirosExpanded&&(
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobile?360:undefined}}>
                  <thead><tr><th style={TH}>Usuário</th><th style={THR}>kWh</th><th style={THR}>Custo</th><th style={THR}>Potencial</th></tr></thead>
                  <tbody>
                    {parceirosDetalhado.map(u=>(
                      <tr key={u.user}><td style={TD}><span style={{fontWeight:500,fontSize:12}}>{trunc(u.user,isMobile?16:24)}</span></td>
                        <td style={{...TDR,color:T.blue}}>{u.kwh.toFixed(1)}</td>
                        <td style={{...TDR,color:T.amber}}>{brl(u.custo)}</td>
                        <td style={{...TDR,color:T.red,fontWeight:600}}>{brl(u.potencial)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {/* CUPONS */}
      {activeSection==="cupons"&&(
        <>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11,color:"#fcd34d",marginBottom:16}}>
            ℹ️ Cupons detectados automaticamente por preço abaixo de 90% da média.
          </div>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.bg2,borderRadius:16,overflow:"hidden",minWidth:isMobile?360:undefined}}>
              <thead><tr><th style={TH}>Usuário</th><th style={TH}>Estação</th><th style={THR}>Preço</th><th style={THR}>Desc.</th></tr></thead>
              <tbody>
                {usersComCupom.length===0&&<tr><td colSpan={4} style={{...TD,textAlign:"center",color:T.text3,padding:"20px"}}>Nenhum cupom detectado</td></tr>}
                {usersComCupom.map(u=>{
                  const hk=u.localFreqKey;const preco=precosPraticados[hk]||0;
                  const desc=preco>0?((1-(u.precoMedioKwh/preco))*100):0;
                  return(<tr key={u.user}>
                    <td style={TD}><span style={{fontWeight:500}}>{trunc(u.user,isMobile?14:20)}</span></td>
                    <td style={{...TD,fontSize:11,color:T.text2}}>{trunc(hubNome(hk),12)}</td>
                    <td style={{...TDR,color:T.amber}}>R${u.precoMedioKwh.toFixed(2)}</td>
                    <td style={{...TDR,color:T.red,fontWeight:600}}>{desc.toFixed(0)}%</td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

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
      {/* Health cards — scroll horizontal mobile */}
      <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,WebkitOverflowScrolling:"touch",marginBottom:24}}>
        {allHealthScores.map(({hub,hs:h})=>{
          const color=h.status==="saudavel"?T.green:h.status==="atencao"?T.amber:T.red;
          const emoji=h.status==="saudavel"?"🟢":h.status==="atencao"?"🟡":"🔴";
          return(
            <div key={hub} onClick={()=>setStation(hub)} style={{background:`${color}06`,border:`1px solid ${color}${station===hub?"60":"25"}`,borderRadius:14,padding:"12px 14px",cursor:"pointer",flexShrink:0,minWidth:isMobile?130:undefined,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
              <div style={{fontFamily:T.sans,fontSize:11,fontWeight:700,color:T.text,marginBottom:6}}>{hubNome(hub)}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>{emoji}</span><div style={{fontFamily:T.sans,fontSize:24,fontWeight:800,color,lineHeight:1}}>{h.total}</div></div>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.text3,marginTop:4}}>/100</div>
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

// ─── TAB AÇÕES ───────────────────────────────────────────────────────────────
function TabAcoes({sessions,appState,onSaveDisparos}:{sessions:Session[];appState:AppState;onSaveDisparos:(d:AppState["disparos"])=>void}){
  const isMobile=useIsMobile();
  const ok=sessions.filter(s=>!s.cancelled&&s.energy>0);
  const users=useMemo(()=>classificarUsuarios(ok),[ok]);
  const[zapiStatus,setZapiStatus]=useState<"unknown"|"ok"|"err">("unknown");
  const[preview,setPreview]=useState<{user:string;hubK:string;msgId:string;template:string;cupom:string;tel:string;msg:string}|null>(null);
  const[respostas,setRespostas]=useState<{id:string;telefone:string;mensagem:string;resposta:string|null;criado_em:string}[]>([]);
  const[loadingResp,setLoadingResp]=useState(false);
  const buscarRespostas=async()=>{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return;
    setLoadingResp(true);
    try{const res=await fetch(`${url}/rest/v1/webhook_respostas?order=criado_em.desc&limit=50`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(res.ok){const data=await res.json();setRespostas(data);}}
    catch(e){console.error(e);}
    setLoadingResp(false);
  };
  const marcarProcessado=async(id:string)=>{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return;
    await fetch(`${url}/rest/v1/webhook_respostas?id=eq.${id}`,{method:"PATCH",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({processado:true})});
    setRespostas(r=>r.filter(x=>x.id!==id));
  };
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
    if(!confirm(`Disparar para ${elegíveis.length} usuários?`))return;
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
      {/* Respostas Z-API */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div><div style={{fontFamily:T.sans,fontSize:15,fontWeight:700,color:T.text}}>📨 Respostas WhatsApp</div></div>
          <button onClick={buscarRespostas} disabled={loadingResp} style={{padding:"7px 14px",borderRadius:10,fontFamily:T.mono,fontSize:11,cursor:"pointer",border:`1px solid ${T.green}40`,background:`${T.green}10`,color:T.green}}>
            {loadingResp?"⏳":"🔄 Buscar"}
          </button>
        </div>
        {respostas.length>0?(
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:T.mono,fontSize:11,minWidth:isMobile?360:undefined}}>
              <thead><tr style={{background:T.bg3}}><th style={{...TH,padding:"8px 12px"}}>Tel</th><th style={{...TH,padding:"8px 12px"}}>Resposta</th><th style={{...TH,padding:"8px 12px"}}>Hora</th><th style={{...TH,padding:"8px 12px"}}></th></tr></thead>
              <tbody>{respostas.map(r=>(<tr key={r.id} style={{borderTop:`1px solid ${T.border}`}}>
                <td style={{...TD,padding:"8px 12px"}}>{r.telefone}</td>
                <td style={{...TD,padding:"8px 12px"}}>{r.resposta==="1"?<span style={{background:"rgba(0,229,160,0.15)",color:T.green,padding:"2px 8px",borderRadius:6}}>1·Motorista</span>:r.resposta==="2"?<span style={{background:"rgba(255,171,0,0.15)",color:T.amber,padding:"2px 8px",borderRadius:6}}>2·Não</span>:<span style={{color:T.text3}}>—</span>}</td>
                <td style={{...TD,padding:"8px 12px",color:T.text3,fontSize:10}}>{new Date(r.criado_em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
                <td style={{...TD,padding:"8px 12px"}}><button onClick={()=>marcarProcessado(r.id)} style={{padding:"3px 8px",borderRadius:6,fontFamily:T.mono,fontSize:10,cursor:"pointer",border:`1px solid ${T.border}`,background:"transparent",color:T.text3}}>✓</button></td>
              </tr>))}</tbody>
            </table>
          </div>
        ):(
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",textAlign:"center",fontFamily:T.mono,fontSize:11,color:T.text3}}>
            Toque em "Buscar" para ver respostas via webhook
          </div>
        )}
      </div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <KpiCard label="Z-API" value={zapiStatus==="ok"?"✅ OK":zapiStatus==="err"?"⚠️ Verificar":"⏳"} sub="status" accent={zapiStatus==="ok"?T.green:T.amber} small/>
        <KpiCard label="Fila Total" value={`${secoes.reduce((a,s)=>a+s.count,0)}`} sub="elegíveis" accent={T.red} small/>
        <KpiCard label="Enviados 30d" value={`${localDisparos.filter(d=>d.status==="ok"&&(Date.now()-new Date(d.ts).getTime())<30*86400000).length}`} sub="confirmados" accent={T.amber} small/>
        <KpiCard label="Total Enviado" value={`${localDisparos.filter(d=>d.status==="ok").length}`} sub="Z-API" accent={T.green} small/>
      </div>
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
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11,color:"#93c5fd",marginBottom:16}}>ℹ️ Importe o CSV de usuários. Estação detectada automaticamente.</div>
          <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:10}}>📂</div>
            <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text,marginBottom:5}}>Importar CSV de Usuários</div>
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
              <button onClick={()=>{onSave({dreConfigs:{...appState.dreConfigs,[dreStation]:cfg}});setDreSaved(true);setTimeout(()=>setDreSaved(false),2000);}} style={{background:dreSaved?"rgba(0,229,160,0.2)":T.greenDim,border:`1px solid ${dreSaved?T.green:"rgba(0,229,160,0.3)"}`,color:T.green,padding:"8px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:T.mono}}>{dreSaved?"✅ Salvo":"💾 Salvar"}</button>
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
        </Panel>
      )}
    </div>
  );
}

// ─── TAB RELATÓRIOS ───────────────────────────────────────────────────────────
// (mantém todo o CSS e lógica de geração HTML — apenas o layout da aba é responsivo)
const LOGO_URL_REL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/wAARCAFQBGADACIAAREBAhEB/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMAAAERAhEAPwDwqiiigAooooAKKKKACjtRRQAUUUUAFFFFABRRRQAUUUUAFFFFABSUtFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUd6KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACjvRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAHeiiigAooooAKKKKACiiigAooooAKKKKACiiigAr70r4Lr70oA+C+1FFFABRRRQAUUUdqACiijtQAUUUUAIKWiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKO9ABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFHagAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApKX3zWvpvhvUdTRZY4hDbn/AJbz/Kp+nGT+Apq70Qm0lduyMjFPiikmkEcSPI56IilifwFd3Y+D9NtQGumlvZPc+XGP+Ajk/n+FbsCpbR+TbpHBF6RIFH6dfxreOHk/I86tmlCnpHX8EefweEtanAZrT7Oh/iuHCf8AjvX9K0ofAzFR9o1SFT6Qws/6nFdd947jTjhhgVtHCxW55883qv4Ipdu5zaeDNLX/AFlxeyf7pRB/I1YXwlog6peH63H/ANjWyCOy/rT8t2FafV6a6HN/aeJf2vuRi/8ACKaFj/UXP/gSf/iajfwforfde9T6TA/zWtzK46UAgnpQ6FPsCzLEr7RzMvgi0P8AqdRmj9pIVf8AUEVQuPBV9GCbe4tbgdgGaNv/AB4Y/Wu2UDsaDvB4qXhoPoaQzXER1evy/wAjzC90jUdPGbuynhT+8yfKf+BDiqPTntXrysU+65I7joKy77w/peo5aS18iU/8tbbCH8R0P5CsZYVr4Wd9LN6bdqit+J5tSVu6v4Wu9Mja4jYXNqv3pI1wU/3l7fUZFYdczi4uzPVpzhUjzQd0FFFFIsKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKO1ABX3pXwXX3pQB8F0UUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUdqKACiiigAooooAO1FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRR3ooAKKKKACiiigAooooAKKKKACiiigAooo7UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABR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UUUAFLSUUAFFFFABRRRQAtJRRQAtJRRQAUtJRQAtJRRQAUUUUAFFFFABRRRQAUUUUAHag0Ud6ACiiigAo6UUUAFFFFABRRRQAdqKKKACjNFHagAzS0lFABRRRQAUtJRQACiiigAooooAOlFFFABRRRQAUd6WkoAWkopaAE+70rr9G8YAKsGrFmA4FwBlh7OO49+v1rkM0fSqhNwd0Y18PTrx5Zo9cjZJoRNA6SRN910O4H8fX2oHzD+teX2GqXmmSs9pO0Zb7yjlX+qng11Nl41t5SFv7VoT/fg+Zf8Avk8j8DXdTxEZb6Hz+JyurB3p+8v66f5HUFgD8tIykfNnmq9tf2N8ubW8gm9FDbW/75ODVl4jGMsrL9Rit001oefKMotqSs/ut8hvSlpBR2oMwoNLSdKZQtHakoByQFGTQSKBnkLgfWk+Xtx702V0gXdPNFCB3lYL+lZF34u0u2UrGZbt/SMbE/76I/pSlKMd2a06M6jtCN/6/A2kXJ4XPtmqN/rFhpIxczAy9oY+X/Hsv41x994s1G7UpEy2sR4Kw8Ej3Y81g571zTxK2gerh8ok7Os7en9f5m3q3iW81MGJcQW3/PKM5z/vHv8Ay9qxO1FHFckpuTvI9ulRp0lywVkLSUUVBqFFFFABS0lFABRRR2oAKKKKACiiigApaSloAbtX+6PypenTilpKACiiigAooooAKKKKACiiigAooooAKKKKACvvSvguvvSgD4Loo7UUAFFFFABRRRQAUUdqKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigA7UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUd6KKACiiigAooooAKKKKACiiigAooooAKKKKACiijtQAUUUCgAooooAWikooAKKKKACiiigBPwq9baxqVmoW3vp40H8KyHH5VSopptbEShCStJXN2Hxfq8R+eaOYekkKn9QAatp45vB96xs2+m9f61y/SkrRVp9zneBw8n8C/L8jrP+E4m/wCgbbf9/H/xpD44uP4dNtR9Wc/1rlKXtT9vU7mf9m4X+X8zoZfGmqP/AKtLWD/chDf+hZqpN4l1iZcSahPtPVUI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b/hnfxdn/kI6J/3/AJf/AI1R/wAM7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVH/AAzv4u/6COif9/5f/jVfTNFAHzN/wzv4u/6COif9/wCX/wCNUf8ADO/i7/oI6J/3/l/+NV9M0UAfM3/DO/i7/oI6J/3/AJf/AI1R/wAM7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVH/AAzv4u/6COif9/5f/jVfTNFAHzN/wzv4u/6COif9/wCX/wCNUf8ADO/i7j/iY6J/3/l/+NV9M0UAfM3/AAzv4u/6COif9/5f/jVH/DO/i7/oI6J/3/l/+NV9M0UAfM3/AAzv4u/6COif9/5f/jVH/DO/i7/oI6J/3/l/+NV9M0UAfM3/AAzv4u/6COif9/5f/jVH/DO/i7/oI6J/3/l/+NV9M0UAfM3/AAzv4u/6COif9/5f/jVH/DO/i7H/ACEdE/7/AMv/AMar6ZooA+Zv+Gd/F3/QR0T/AL/y/wDxqgfs7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVH/AAzv4u/6COif9/5f/jVfTNFAHzN/wzv4u/6COif9/wCX/wCNUf8ADO/i7/oI6J/3/l/+NV9M0UAfM3/DO/i7/oI6J/3/AJf/AI1R/wAM7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVH/AAzv4u/6COif9/5f/jVfTNFAHzN/wzv4u/6COif9/wCX/wCNUf8ADO/i7/oI6J/3/l/+NV9M0UAfM3/DO/i7/oI6J/3/AJf/AI1R/wAM7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVH/AAzv4u/6COif9/5f/jVfTNFAHzN/wzv4u/6COif9/wCX/wCNUf8ADO/i7/oI6J/3/l/+NV9M0UAfM3/DO/i7/oI6J/3/AJf/AI1R/wAM7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVH/AAzv4u/6COif9/5f/jVfTNFAHzN/wzv4u/6COif9/wCX/wCNUf8ADO/i7/oI6J/3/l/+NV9M0UAfM3/DO/i7/oI6J/3/AJf/AI1R/wAM7+Lv+gjon/f+X/41X0zRQB8zf8M7+Lv+gjon/f8Al/8AjVfTNFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//2Q==";
const FLBR_CSS=`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');:root{--bg:#080b10;--bg2:#0d1117;--bg3:#111820;--border:#1a2333;--border2:#243040;--text1:#e8f0f8;--text2:#7a94b0;--text3:#3d5268;--green:#00e676;--teal:#00bcd4;--amber:#ffab00;--red:#ff5252;--blue:#448aff;--purple:#7c4dff;--font:'Syne',sans-serif;--mono:'DM Mono',monospace;}*{margin:0;padding:0;box-sizing:border-box;}html{font-size:14px;background:var(--bg);-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{font-family:var(--font);color:var(--text1);overflow-x:hidden;}.print-btn{position:fixed;bottom:28px;right:28px;z-index:999;background:var(--green);color:#000;border:none;padding:12px 22px;border-radius:8px;font-family:var(--font);font-weight:700;font-size:13px;cursor:pointer;}@media print{.print-btn{display:none!important;}}.cover{min-height:100vh;background:radial-gradient(ellipse 80% 60% at 60% 40%,rgba(0,188,212,.06) 0%,transparent 60%),var(--bg);display:flex;flex-direction:column;justify-content:space-between;padding:56px 64px;border-bottom:1px solid var(--border);}.cover-top{display:flex;justify-content:space-between;align-items:flex-start;}.logo-block img{height:48px;display:block;margin-bottom:8px;mix-blend-mode:screen;}.logo-sub{font-size:10px;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;font-family:var(--mono);}.badge-conf{background:rgba(255,82,82,.12);border:1px solid rgba(255,82,82,.25);color:#ff8a80;font-size:9px;font-family:var(--mono);letter-spacing:.12em;padding:4px 10px;border-radius:4px;text-transform:uppercase;}.cover-main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px 0 40px;}.cover-eyebrow{font-size:10px;font-family:var(--mono);color:var(--teal);letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px;}.cover-title{font-size:clamp(52px,7vw,88px);font-weight:800;line-height:.95;letter-spacing:-.03em;margin-bottom:8px;}.cover-title .accent{color:var(--green);display:block;}.cover-line{width:64px;height:3px;background:linear-gradient(90deg,var(--green),var(--teal));border-radius:2px;margin:24px 0;}.cover-sub{font-size:16px;color:var(--text2);font-weight:400;}.cover-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:12px;overflow:hidden;margin-top:auto;}.ckpi{background:var(--bg2);padding:24px 20px;position:relative;}.ckpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}.ckpi.g::before{background:var(--green);}.ckpi.t::before{background:var(--teal);}.ckpi.a::before{background:var(--amber);}.ckpi.p::before{background:var(--purple);}.ckpi-val{font-size:28px;font-weight:800;font-family:var(--mono);line-height:1;margin-bottom:4px;}.ckpi.g .ckpi-val{color:var(--green);}.ckpi.t .ckpi-val{color:var(--teal);}.ckpi.a .ckpi-val{color:var(--amber);}.ckpi.p .ckpi-val{color:var(--purple);}.ckpi-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--mono);}.ckpi-sub{font-size:11px;color:var(--text2);margin-top:6px;font-family:var(--mono);}.cover-bottom{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;}.cover-dest{font-size:11px;color:var(--text3);}.cover-dest strong{color:var(--text1);display:block;font-size:14px;margin-top:2px;}.cover-period{font-family:var(--mono);font-size:11px;color:var(--text2);text-align:right;}.section{padding:64px;border-bottom:1px solid var(--border);}.section:nth-child(even){background:var(--bg2);}.section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:16px;}.section-title{font-size:11px;font-family:var(--mono);color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px;}.section-h2{font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1.1;}.section-tag{font-size:10px;font-family:var(--mono);padding:4px 12px;border-radius:20px;letter-spacing:.08em;text-transform:uppercase;border:1px solid;}.tag-green{color:var(--green);border-color:rgba(0,230,118,.3);background:rgba(0,230,118,.06);}.tag-amber{color:var(--amber);border-color:rgba(255,171,0,.3);background:rgba(255,171,0,.06);}.tag-teal{color:var(--teal);border-color:rgba(0,188,212,.3);background:rgba(0,188,212,.06);}.tag-red{color:var(--red);border-color:rgba(255,82,82,.3);background:rgba(255,82,82,.06);}.kpi-grid{display:grid;gap:1px;background:var(--border);border-radius:12px;overflow:hidden;}.kpi-grid.cols4{grid-template-columns:repeat(4,1fr);}.kpi-grid.cols3{grid-template-columns:repeat(3,1fr);}.kpi-grid.cols2{grid-template-columns:repeat(2,1fr);}.kpi{background:var(--bg3);padding:28px 24px;position:relative;}.kpi-icon{font-size:20px;margin-bottom:12px;}.kpi-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--mono);margin-bottom:8px;}.kpi-val{font-size:30px;font-weight:800;font-family:var(--mono);line-height:1;margin-bottom:4px;}.kpi-detail{font-size:11px;color:var(--text2);font-family:var(--mono);}.kpi-bar{height:2px;border-radius:1px;margin-top:14px;background:var(--border2);}.kpi-bar-fill{height:100%;border-radius:1px;}.dre{display:grid;grid-template-columns:1fr 1fr;gap:32px;}.dre-table{background:var(--bg3);border-radius:12px;overflow:hidden;border:1px solid var(--border);}.dre-row{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid var(--border);}.dre-row:last-child{border-bottom:none;}.dre-row.result{background:rgba(0,230,118,.06);border-top:1px solid rgba(0,230,118,.2);}.dre-row.result .dre-lbl{color:var(--text1);font-weight:700;}.dre-lbl{font-size:13px;color:var(--text2);}.dre-lbl.main{color:var(--text1);font-weight:600;}.dre-val{font-family:var(--mono);font-size:14px;color:var(--text1);}.dre-val.neg{color:var(--red);}.dre-val.pos{color:var(--green);}.dre-row.result .dre-val{color:var(--green);font-size:20px;}.dist-box{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:28px;display:flex;flex-direction:column;gap:20px;}.dist-title{font-size:11px;font-family:var(--mono);color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:4px;}.dist-card{border-radius:10px;padding:24px;border:1px solid;}.dist-card.flbr{border-color:rgba(0,188,212,.3);background:rgba(0,188,212,.04);}.dist-card.hz{border-color:rgba(0,230,118,.3);background:rgba(0,230,118,.04);}.dist-who{font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-family:var(--mono);margin-bottom:8px;}.dist-card.flbr .dist-who{color:var(--teal);}.dist-card.hz .dist-who{color:var(--green);}.dist-amount{font-size:32px;font-weight:800;font-family:var(--mono);margin-bottom:6px;}.dist-card.flbr .dist-amount{color:var(--teal);}.dist-card.hz .dist-amount{color:var(--green);}.dist-note{font-size:11px;color:var(--text2);}.footer{padding:32px 64px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);}.footer-left{font-size:11px;color:var(--text3);font-family:var(--mono);}.footer-right{font-size:11px;color:var(--text3);font-family:var(--mono);text-align:right;}.payback-wrap{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;}.payback-bar-wrap{padding:16px 24px 20px;}.payback-bar-track{height:8px;background:var(--border2);border-radius:4px;overflow:hidden;margin-top:8px;}.payback-bar-fill{height:100%;background:linear-gradient(90deg,var(--teal),var(--green));border-radius:4px;}.payback-info{display:flex;flex-direction:column;gap:16px;}.pb-card{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:24px;}.pb-card-val{font-size:28px;font-weight:800;font-family:var(--mono);color:var(--green);margin-bottom:4px;}.pb-card-lbl{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--mono);margin-bottom:8px;}.pb-card-sub{font-size:12px;color:var(--text2);font-family:var(--mono);line-height:1.5;}.chart-grid{display:grid;gap:24px;}.chart-grid.cols2{grid-template-columns:1fr 1fr;}.chart-panel{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:24px;}.chart-title{font-size:10px;font-family:var(--mono);color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px;}.chart-wrap{position:relative;height:240px;}.demanda-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:32px;}.dem-card{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:20px;}.dem-card-tag{font-size:9px;font-family:var(--mono);letter-spacing:.15em;text-transform:uppercase;margin-bottom:10px;}.dem-card-val{font-size:22px;font-weight:800;font-family:var(--mono);margin-bottom:4px;}.dem-card-sub{font-size:11px;color:var(--text2);font-family:var(--mono);}.pico-tag{color:var(--amber);}.highlight-list{display:flex;flex-direction:column;gap:12px;}.highlight-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--bg3);border-radius:8px;border:1px solid var(--border);}.hi-icon{font-size:16px;flex-shrink:0;margin-top:1px;}.hi-text{font-size:13px;color:var(--text1);line-height:1.5;}.hi-text span{color:var(--text2);font-family:var(--mono);font-size:12px;}.alert-item{border-left:3px solid var(--amber);}.alert-item .hi-text{color:var(--text2);}.alert-item .hi-text strong{color:var(--amber);}.steps-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}.step-card{background:var(--bg3);border-radius:12px;border:1px solid var(--border);padding:24px;position:relative;overflow:hidden;}.step-card::before{content:'';position:absolute;top:0;left:0;bottom:0;width:3px;}.step-card.pri1::before{background:var(--red);}.step-card.pri2::before{background:var(--amber);}.step-card.pri3::before{background:var(--teal);}.step-card.pri4::before{background:var(--purple);}.step-title{font-size:15px;font-weight:700;margin-bottom:6px;color:var(--text1);}.step-desc{font-size:12px;color:var(--text2);line-height:1.6;font-family:var(--mono);}.meta-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12px;}.meta-table th{background:rgba(255,255,255,.02);padding:10px 16px;text-align:left;color:var(--text3);font-size:10px;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--border);}.meta-table td{padding:12px 16px;border-bottom:1px solid rgba(26,35,51,.5);color:var(--text2);}.meta-table tr:last-child td{border-bottom:none;}.meta-table .val-ok{color:var(--green);}.meta-table .val-warn{color:var(--amber);}.meta-table .val-bad{color:var(--red);}.indicator{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:middle;}.ind-ok{background:var(--green);}.ind-warn{background:var(--amber);}.ind-bad{background:var(--red);}.kpi-invest{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px;}.ki{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:24px;position:relative;overflow:hidden;}.ki::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}.ki.g::before{background:var(--green);}.ki.t::before{background:var(--teal);}.ki.a::before{background:var(--amber);}.ki-lbl{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px;}.ki-val{font-size:26px;font-weight:800;font-family:var(--mono);margin-bottom:4px;}.ki.g .ki-val{color:var(--green);}.ki.t .ki-val{color:var(--teal);}.ki.a .ki-val{color:var(--amber);}.ki-sub{font-size:11px;color:var(--text2);font-family:var(--mono);}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:32px;}.network-hero{padding:80px 64px;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(0,188,212,.08) 0%,transparent 70%),var(--bg);text-align:center;border-bottom:1px solid var(--border);}.network-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border-radius:16px;overflow:hidden;max-width:800px;margin:0 auto;}.nk{background:var(--bg2);padding:28px 20px;text-align:center;}.nk-val{font-size:32px;font-weight:800;font-family:var(--mono);color:var(--green);margin-bottom:4px;}.nk-lbl{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.15em;font-family:var(--mono);}.station-row{display:flex;align-items:center;gap:20px;padding:20px 24px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);margin-bottom:12px;}.sr-score{font-size:28px;font-weight:800;font-family:var(--mono);min-width:60px;}.sr-bar{flex:1;height:4px;background:var(--border2);border-radius:2px;overflow:hidden;}.sr-fill{height:100%;border-radius:2px;}.sr-meta{font-size:11px;color:var(--text2);font-family:var(--mono);}.market-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-bottom:32px;}.market-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:28px;}.market-card-val{font-size:36px;font-weight:800;font-family:var(--mono);margin-bottom:6px;}.market-card-lbl{font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;}.market-card-desc{font-size:12px;color:var(--text2);line-height:1.7;font-family:var(--mono);}.gestao-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}.gestao-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:24px;}.gestao-icon{font-size:24px;margin-bottom:12px;}.gestao-title{font-size:14px;font-weight:700;margin-bottom:6px;}.gestao-desc{font-size:12px;color:var(--text2);line-height:1.6;font-family:var(--mono);}@media(max-width:640px){.cover{padding:32px 20px;}.cover-title{font-size:clamp(36px,10vw,56px);}.cover-kpis{grid-template-columns:1fr 1fr;}.section{padding:32px 20px;}.section-h2{font-size:22px;}.kpi-grid.cols4{grid-template-columns:1fr 1fr;}.kpi-grid.cols3{grid-template-columns:1fr 1fr;}.kpi-grid.cols2{grid-template-columns:1fr;}.dre{grid-template-columns:1fr;gap:16px;}.payback-wrap{grid-template-columns:1fr;}.two-col{grid-template-columns:1fr;}.steps-grid{grid-template-columns:1fr;}.market-grid{grid-template-columns:1fr;}.gestao-grid{grid-template-columns:1fr;}.kpi-invest{grid-template-columns:1fr 1fr;}.network-kpis{grid-template-columns:1fr;}.demanda-grid{grid-template-columns:1fr 1fr;}.footer{flex-direction:column;gap:12px;padding:24px 20px;}.cover-bottom{flex-direction:column;gap:12px;}.logo-block img{height:36px;}}`;

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
export default function Home() {
  useFonts();
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
      saveState(next);
      return next;
    });
  }, []);

  const meta = appState.metas["global"] || 0;
  const onMetaChange = (v: number) => handleSave({ metas: { ...appState.metas, global: v } });

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dash",     label: "Dashboard", icon: "📊" },
    { id: "usuarios", label: "Usuários",  icon: "👤" },
    { id: "dre",      label: "DRE",       icon: "💼" },
    { id: "acoes",    label: "Ações",     icon: "📤" },
    { id: "relatorio",label: "Relatórios",icon: "📋" },
    { id: "config",   label: "Config",    icon: "⚙️"  },
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
        {tab === "dash"      && <TabDashboard sessions={sessions} meta={meta} onMetaChange={onMetaChange} />}
        {tab === "usuarios"  && <TabUsuarios sessions={sessions} appState={appState} />}
        {tab === "dre"       && <TabDRE sessions={sessions} appState={appState} />}
        {tab === "acoes"     && <TabAcoes sessions={sessions} appState={appState} onSaveDisparos={d => handleSave({ disparos: d })} />}
        {tab === "relatorio" && <TabRelatorio sessions={sessions} appState={appState} onAddSessions={setSessions} />}
        {tab === "config"    && <TabConfig appState={appState} onSave={handleSave} />}
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