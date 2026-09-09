import {
  Award,
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  Target,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { ModulePage } from "@/app/components/ModulePage";

const reportMetrics = [
  {
    label: "이번 달 월마감 정리율",
    value: "72%",
    detail: "확인 대상 39건 중 28건 정리",
    icon: FileCheck2,
    tone: "blue"
  },
  {
    label: "이번 달 수금 정리율",
    value: "81%",
    detail: "미수/부분수금 31건 중 25건 확인",
    icon: WalletCards,
    tone: "green"
  },
  {
    label: "요청 정확도",
    value: "96%",
    detail: "반려 없는 요청 기준",
    icon: Target,
    tone: "blue"
  },
  {
    label: "운영 루틴 완료일",
    value: "11일",
    detail: "이번 달 체크 완료일",
    icon: CalendarCheck2,
    tone: "orange"
  }
];

const routineRows = [
  { label: "월마감 이슈 확인", done: 28, total: 39, note: "출고/계산서/RMA 기준" },
  { label: "수금 이슈 확인", done: 25, total: 31, note: "미수/부분수금/매칭대기 기준" },
  { label: "요청 반려 없이 등록", done: 24, total: 25, note: "필수 링크와 사유 입력 기준" },
  { label: "오늘 루틴 완료", done: 11, total: 15, note: "업무일 기준 누적" }
];

const badges = [
  {
    title: "월마감 클리어",
    description: "월마감 이슈를 기한 안에 꾸준히 정리했습니다.",
    status: "획득",
    progress: 100
  },
  {
    title: "수금 추적왕",
    description: "미수와 부분수금 건을 빠르게 확인했습니다.",
    status: "진행중",
    progress: 82
  },
  {
    title: "반려 없는 요청",
    description: "필수 정보 누락 없이 요청을 등록했습니다.",
    status: "획득",
    progress: 100
  },
  {
    title: "루틴 7일 연속",
    description: "월마감·수금 확인 루틴을 7영업일 이상 이어갔습니다.",
    status: "획득",
    progress: 100
  }
];

const monthlyNotes = [
  "월마감 정리율은 업로드된 월마감 이슈 중 확인 완료 또는 사유 입력된 건을 기준으로 계산합니다.",
  "수금 정리율은 미수, 부분수금, 수금매칭 대기 건 중 확인 완료된 건을 기준으로 계산합니다.",
  "요청 정확도는 반려 없이 접수·처리된 요청 비율을 기준으로 봅니다."
];

function toneClass(tone: string) {
  if (tone === "green") return "bg-[#ecfdf5] text-[#12825f]";
  if (tone === "orange") return "bg-[#fff5ec] text-[#b85f18]";
  return "bg-[#edf4ff] text-[#1D50A2]";
}

function progressPercent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export default function PerformancePage() {
  return (
    <ModulePage
      eyebrow="MY OPERATION REPORT"
      title="내 운영 리포트"
      description="매출 순위가 아니라, 내가 거래를 얼마나 정확하게 끝까지 닫고 있는지 보는 월간 리포트입니다."
    >
      <div className="mt-6 space-y-4">
        <section className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Monthly Report</p>
              <h2 className="mt-1 text-[24px] font-[950] tracking-[-0.03em] text-[#111827]">이번 달 운영 리포트</h2>
              <p className="mt-1 text-[13px] font-[750] text-[#64748b]">
                월마감, 수금, 요청 정확도, 루틴 완료일을 기준으로 내 운영 습관을 확인합니다.
              </p>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-4 py-2 text-[13px] font-[950] text-[#1D50A2]">2026년 7월 기준</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reportMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="rounded-[20px] border border-[#e7ecf4] bg-[#fbfdff] p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass(metric.tone)}`}>
                    <Icon size={18} />
                  </div>
                  <p className="mt-3 text-[12px] font-[850] text-[#64748b]">{metric.label}</p>
                  <p className="mt-1 text-[30px] font-[950] tracking-[-0.04em] text-[#111827]">{metric.value}</p>
                  <p className="mt-1 text-[12px] font-[800] text-[#64748b]">{metric.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Routine</p>
                <h2 className="mt-1 text-[22px] font-[950] text-[#111827]">운영 루틴 현황</h2>
                <p className="mt-1 text-[13px] font-[750] text-[#64748b]">매일 처리해야 하는 운영 업무가 얼마나 줄고 있는지 봅니다.</p>
              </div>
              <ClipboardCheck className="text-[#1D50A2]" size={28} />
            </div>

            <div className="mt-5 space-y-3">
              {routineRows.map((row) => {
                const percent = progressPercent(row.done, row.total);
                return (
                  <article key={row.label} className="rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] px-4 py-3">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-[950] text-[#111827]">{row.label}</p>
                        <p className="mt-1 truncate text-[12px] font-[750] text-[#64748b]">{row.note}</p>
                      </div>
                      <p className="shrink-0 text-[14px] font-[950] text-[#1D50A2]">
                        {row.done}/{row.total}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7ecf4]">
                      <div className="h-full rounded-full bg-[#1D50A2]" style={{ width: `${percent}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Badge</p>
                <h2 className="mt-1 text-[22px] font-[950] text-[#111827]">받은 운영배지</h2>
                <p className="mt-1 text-[13px] font-[750] text-[#64748b]">배지는 성과 점수가 아니라 좋은 운영 습관의 기록입니다.</p>
              </div>
              <Award size={28} className="text-[#1D50A2]" />
            </div>

            <div className="mt-5 space-y-3">
              {badges.map((badge) => (
                <article key={badge.title} className="rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#1D50A2] shadow-sm">
                      <BadgeCheck size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate text-[14px] font-[950] text-[#111827]">{badge.title}</p>
                        <span className="shrink-0 rounded-full bg-[#edf4ff] px-3 py-1 text-[11px] font-[950] text-[#1D50A2]">{badge.status}</span>
                      </div>
                      <p className="mt-1 text-[12px] font-[750] leading-5 text-[#64748b]">{badge.description}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7ecf4]">
                        <div className="h-full rounded-full bg-[#1D50A2]" style={{ width: `${badge.progress}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-[#1D50A2]" />
              <h2 className="text-[20px] font-[950] text-[#111827]">이번 달 좋아진 점</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["월마감 누락 감소", "수금 확인 증가", "요청 반려 감소"].map((label, index) => (
                <div key={label} className="rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] p-4">
                  <p className="text-[12px] font-[850] text-[#64748b]">{label}</p>
                  <p className="mt-2 text-[24px] font-[950] text-[#1D50A2]">{["-3건", "+6건", "-12%"][index]}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#1D50A2]" />
              <h2 className="text-[20px] font-[950] text-[#111827]">리포트 기준</h2>
            </div>
            <div className="mt-4 space-y-2">
              {monthlyNotes.map((note) => (
                <div key={note} className="rounded-[16px] border border-[#e7ecf4] bg-[#fbfdff] px-4 py-3 text-[13px] font-[800] text-[#475569]">
                  {note}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </ModulePage>
  );
}
