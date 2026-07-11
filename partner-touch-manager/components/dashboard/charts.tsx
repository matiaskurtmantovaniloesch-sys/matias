"use client";

// Gráficos do dashboard (Recharts).
// Cores seguem a paleta validada do método de dataviz:
// - séries únicas: azul #2a78d6 (magnitude em um matiz só);
// - health usa a paleta de STATUS (verde/amarelo/vermelho), sempre
//   acompanhada de legenda e rótulos — nunca cor sozinha.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AZUL = "#2a78d6";
const GRID = "#e1e0d9";
const INK_MUTED = "#898781";

const STATUS_HEALTH: Record<string, string> = {
  Saudável: "#0ca30c",
  Atenção: "#fab219",
  "Em risco": "#d03b3b",
};
const NEUTRO = "#898781";

const tickStyle = { fontSize: 12, fill: INK_MUTED };

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid " + GRID,
  fontSize: 12,
  background: "#fff",
};

export function TouchesPorSemanaChart({
  data,
}: {
  data: { semana: string; touches: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
        <XAxis dataKey="semana" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [v, "Touches"]}
          labelFormatter={(l) => `Semana de ${l}`}
        />
        <Line
          type="monotone"
          dataKey="touches"
          stroke={AZUL}
          strokeWidth={2}
          dot={{ r: 3, fill: AZUL, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TouchesPorCanalChart({
  data,
}: {
  data: { canal: string; touches: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
        <XAxis dataKey="canal" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Touches"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="touches" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TouchesPorResponsavelChart({
  data,
}: {
  data: { responsavel: string; touches: number }[];
}) {
  const height = Math.max(200, data.length * 40 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
        <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="responsavel"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Touches"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="touches" fill={AZUL} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HealthDonutChart({
  data,
}: {
  data: { health: string; parcerias: number }[];
}) {
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="parcerias"
            nameKey="health"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            stroke="#fcfcfb"
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell key={d.health} fill={STATUS_HEALTH[d.health] ?? NEUTRO} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legenda com rótulo + valor: identidade nunca fica só na cor */}
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {data.map((d) => (
          <li key={d.health} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: STATUS_HEALTH[d.health] ?? NEUTRO }}
            />
            <span className="text-muted-foreground">
              {d.health}: <span className="font-semibold text-foreground">{d.parcerias}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankingParceriasChart({
  data,
}: {
  data: { nome: string; touches: number }[];
}) {
  const height = Math.max(200, data.length * 36 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
        <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="nome"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Touches"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="touches" fill={AZUL} radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
