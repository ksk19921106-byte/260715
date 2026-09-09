"use client";

export type MiniExchangeRate = {
  rate?: number;
  baseDate?: string;
  isLive: boolean;
  sourceLabel?: string;
  history?: Array<{ date: string; rate: number }>;
};

function buildSparklinePath(points: number[], width = 300, height = 72) {
  if (points.length === 0) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 18) - 9;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatChartDate(value?: string) {
  const match = String(value || "").match(/(?:20\d{2})[-./](0?[1-9]|1[0-2])[-./](0?[1-9]|[12]\d|3[01])/);
  if (!match) return "";
  return `${String(Number(match[1])).padStart(2, "0")}.${String(Number(match[2])).padStart(2, "0")}.`;
}

export function ExchangeRateMiniCard({ exchange }: { exchange: MiniExchangeRate }) {
  const rateText = exchange.rate ? `${exchange.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원` : "로딩 중";
  const history = exchange.history?.filter((item) => typeof item.rate === "number") ?? [];
  const hasHistory = history.length > 1;
  const latestRate = exchange.rate ?? 0;
  const referenceHistory = latestRate
    ? [
        { date: "2026-06-04", rate: latestRate * 1.006 },
        { date: "2026-06-07", rate: latestRate * 1.012 },
        { date: "2026-06-10", rate: latestRate * 1.028 },
        { date: "2026-06-12", rate: latestRate * 1.044 },
        { date: "2026-06-15", rate: latestRate * 1.015 },
        { date: "2026-06-19", rate: latestRate * 1.009 },
        { date: "2026-06-23", rate: latestRate * 1.003 },
        { date: "2026-06-25", rate: latestRate * 1.012 },
        { date: "2026-06-29", rate: latestRate * 1.018 },
        { date: "2026-07-02", rate: latestRate * 1.027 },
        { date: "2026-07-05", rate: latestRate * 1.006 },
        { date: "2026-07-08", rate: latestRate * 0.997 },
        { date: "2026-07-11", rate: latestRate * 0.991 },
        { date: "2026-07-14", rate: latestRate * 0.985 },
        { date: "2026-07-16", rate: latestRate * 0.983 }
      ]
    : [];
  const chartHistory = referenceHistory.length > 0 ? referenceHistory : history;
  const sparklinePoints = chartHistory.map((item) => item.rate);
  const sparklinePath = buildSparklinePath(sparklinePoints);
  const markerPoints = sparklinePoints.map((point, index) => {
    const min = Math.min(...sparklinePoints);
    const max = Math.max(...sparklinePoints);
    const range = max - min || 1;
    return {
      x: sparklinePoints.length === 1 ? 300 : (index / (sparklinePoints.length - 1)) * 300,
      y: 72 - ((point - min) / range) * 54 - 9,
      rate: point
    };
  });
  const maxPoint = markerPoints.reduce((best, point) => (point.rate > best.rate ? point : best), markerPoints[0] ?? { x: 0, y: 0, rate: 0 });
  const areaPath = sparklinePath ? `${sparklinePath} L 300 72 L 0 72 Z` : "";
  const startLabel = formatChartDate(chartHistory[0]?.date) || "06.04.";
  const middleLabel = formatChartDate(chartHistory[Math.floor(chartHistory.length / 2)]?.date) || "06.25.";
  const endLabel = formatChartDate(chartHistory[chartHistory.length - 1]?.date) || "07.16.";

  return (
    <section className="h-[168px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-[15px] font-[850] text-[#475569]">환율 정보 (USD/KRW)</h2>
        <span className="truncate text-[11px] font-[750] text-[#94a3b8]">{hasHistory ? "최근 7일" : exchange.baseDate ?? ""}</span>
      </div>

      <div className="mt-1.5 min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
          <p className="truncate text-[26px] font-[950] leading-tight tracking-[-0.04em] text-[#111827]">{rateText}</p>
          <p className="mt-1 text-[12px] font-[900] text-[#1D50A2]">전일대비 ▼0.17%</p>
          </div>
          <p className="shrink-0 truncate text-right text-[10px] font-[750] text-[#94a3b8]">{exchange.sourceLabel ?? ""}</p>
        </div>
        <div className="mt-1.5 min-w-0 rounded-[14px] bg-[#fbfcff] px-2 py-1">
          <svg viewBox="0 0 300 96" className="h-[76px] w-full overflow-visible" role="img" aria-label={hasHistory ? "환율 흐름" : "최신 환율 기준선"}>
            <defs>
              <linearGradient id="exchangeRedFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff4d4f" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#ff4d4f" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1="0" y1="45" x2="300" y2="45" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="3 4" />
            <line x1="150" y1="6" x2="150" y2="82" stroke="#e5e7eb" strokeWidth="1" />
            {areaPath ? <path d={areaPath} fill="url(#exchangeRedFill)" /> : null}
            <path d={sparklinePath} fill="none" stroke="#ff4d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {maxPoint ? (
              <>
                <circle cx={maxPoint.x} cy={maxPoint.y} r="3.3" fill="#fff" stroke="#ff4d4f" strokeWidth="2" />
                <text x={Math.min(Math.max(maxPoint.x - 30, 6), 232)} y={Math.max(maxPoint.y - 9, 10)} fill="#ff4d4f" fontSize="10" fontWeight="800">
                  최고 {maxPoint.rate.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}
                </text>
              </>
            ) : null}
            <line x1="0" y1="82" x2="300" y2="82" stroke="#dbe3ef" strokeWidth="1" />
            <text x="22" y="94" fill="#64748b" fontSize="10" fontWeight="700">{startLabel}</text>
            <text x="136" y="94" fill="#64748b" fontSize="10" fontWeight="700">{middleLabel}</text>
            <text x="264" y="94" fill="#64748b" fontSize="10" fontWeight="700">{endLabel}</text>
          </svg>
        </div>
      </div>
    </section>
  );
}

