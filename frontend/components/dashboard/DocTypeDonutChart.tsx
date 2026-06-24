"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  data: { name: string; value: number }[];
  total: number;
}

const COLORS = ["#0F766E", "#1E3A5F", "#F59E0B", "#6366F1", "#EC4899"];

export function DocTypeDonutChart({ data, total }: Props) {
  if (data.length === 1) {
    return (
      <div className="flex items-center gap-3 py-4">
        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[0] }} />
        <span className="text-sm font-medium text-foreground">{data[0].name}</span>
        <span className="ml-auto text-sm font-bold text-primary tabular-nums">{data[0].value}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-28 h-28 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={50}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value} PDFs`, ""]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #E4E7EB",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-primary tabular-nums">{total}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground truncate flex-1">{entry.name}</span>
            <span className="font-semibold text-foreground tabular-nums flex-shrink-0">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
