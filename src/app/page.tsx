"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, PieChart, Pie, Cell,
} from "recharts";

// ─── FONTS ────────────────────────────────────────────────────────────────────
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

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Session {
  date: Date;
  hub: string;
  user: string;
  charger: string;
  energy: number;
  value: number;
  duration: string;
  durMin: number | null;
  overstayMin: number | null;
  startHour: number | null;
  status: string;
  cancelled: boolean;
}

interface UserData {
  user: string;
  sess: number;
  kwh: number;
  rev: number;
  dates: Date[];
  hubs: string[];
  values: number[];
  isParceiro: boolean;
  isMotorista: boolean;
  isHeavy: boolean;
  perfil: string;
  perfilCor: string;
  localFreq: string;
}

interface DREConfig {
  modelo: "investidor" | "propria";
  pctEspaco: number;
  pctImposto: number;
  pctApp: number;
  fixoInternet: number;
  fixoAluguel: number;
  energiaTipo: "incluido" | "kwh" | "usina";
  energiaKwh: number;
  usinaFixo: number;
  invNome: string;
  invPct: number;
  invTotal: number;
  invPago: number;
  invDividaPrio: number;
  invAmort: number;
  propriaInstalacao: number;
  propriaAmort: number;
  solarProprio: boolean;
}

type Tab = "dash" | "dre" | "usuarios" | "acoes" | "config";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:      "#080a0f",
  bg1:     "#0d1017",
  bg2:     "#121620",
  bg3:     "#181d28",
  border:  "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.12)",
  green:   "#00e5a0",
  greenDim:"rgba(0,229,160,0.15)",
  amber:   "#f59e0b",
  red:     "#ef4444",
  blue:    "#3b82f6",
  text:    "#e8edf5",
  text2:   "#6b7fa3",
  text3:   "#2d3a
