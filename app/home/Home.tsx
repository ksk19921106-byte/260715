"use client";

import { ArrowRight, ClipboardCheck, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { RequestKind } from "../services/formValidation";
import { routeWithUser, searchGlobal } from "../services/globalSearch";
import { getLocalDateKey, getTodayOpsActions, type OpsActionItem } from "../services/opsActionSchedule";
import { searchChips } from "./homeData";
import { HeroSection } from "./HeroSection";
import { MonthlyCheckCard } from "./MonthlyCheckCard";
import { CollectionCheckCard } from "./CollectionCheckCard";
import { GatekeeperBanner } from "./GatekeeperBanner";
import { QuickRequestSection } from "./QuickRequestSection";
import { RequestStatusSection } from "./RequestStatusSection";
import { ExchangeRateMiniCard, type MiniExchangeRate } from "./ExchangeRateMiniCard";
import { DailyTaxTipMiniCard } from "./DailyTaxTipMiniCard";
import { OperationNoticeMiniCard } from "./OperationNoticeMiniCard";
import { TodayBriefingModal } from "./TodayBriefingModal";

function HomeGroup({
  eyebrow,
  title,
  description,
  children,
  compact = false
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-[28px] border border-[#edf2f8] bg-white/40 shadow-[0_4px_14px_rgba(15,23,42,0.016)] ${compact ? "space-y-2.5 p-3.5" : "space-y-4 p-5"}`}>
      <div className="flex min-w-0 items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-[950] uppercase tracking-[0.1em] text-[#1D50A2]">{eyebrow}</p>
          <h2 className="mt-0.5 truncate text-[19px] font-[950] tracking-[-0.03em] text-[#111827]">{title}</h2>
        </div>
        <p className="hidden max-w-[560px] truncate text-right text-[12px] font-[750] text-[#64748b] lg:block">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TodayActionQueue({
  items,
  onOpenTask
}: {
  items: OpsActionItem[];
  onOpenTask: (item: OpsActionItem) => void;
}) {
  const totalWorkTypes = items.length;

  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#d8e4f1] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.055)]">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-[950] uppercase tracking-[0.1em] text-[#1D50A2]">Action Queue</p>
          <h3 className="mt-1 text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">오늘 바로 확인할 업무</h3>
          <p className="mt-1 text-[12px] font-[650] text-[#64748b]">월말과 매월 10일 마감 일정에 맞춰 오늘 할 일만 보여드립니다.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">{totalWorkTypes.toLocaleString("ko-KR")}개 업무</span>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-[16px] border border-[#edf2f8] bg-[#f8fbff] px-4 py-5 text-[13px] font-[850] text-[#64748b]">
          오늘 예정된 마감 Action Item이 없습니다.
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="flex min-h-[148px] min-w-0 flex-col justify-between rounded-[18px] border border-[#dbe5f1] bg-[#fbfcff] p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#1D50A2]">
                    <ClipboardCheck size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-[900] text-[#1D50A2]">{item.scheduleLabel}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-[900] ${item.mode === "check" ? "bg-[#fff5ec] text-[#c9671d]" : "bg-[#f1f5f9] text-[#475569]"}`}>
                        {item.mode === "check" ? "점검 담당" : "Action Item"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[14px] font-[900] leading-[1.3] text-[#111827]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-[650] leading-[1.4] text-[#64748b]">{item.description}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenTask(item)}
                className="mt-4 inline-flex h-9 items-center justify-center gap-1 rounded-full bg-[#1D50A2] px-4 text-[12px] font-[950] text-white transition hover:bg-[#173f82]"
              >
                {item.mode === "check" ? "점검하기" : "처리하기"}
                <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function Home({
  userName,
  exchange,
  onSelectRequestKind
}: {
  userName: string;
  exchange: MiniExchangeRate;
  onSelectRequestKind: (kind: RequestKind) => void;
}) {
  const [query, setQuery] = useState("");
  const [showBriefing, setShowBriefing] = useState(false);
  const [scheduledActions, setScheduledActions] = useState<OpsActionItem[]>([]);
  const results = useMemo(() => searchGlobal(query, 6), [query]);
  const showResults = query.trim().length > 0;

  useEffect(() => {
    const actions = getTodayOpsActions(userName);
    setScheduledActions(actions);
    setShowBriefing(false);
    if (actions.length === 0) return;

    const storageKey = `icbanq.ops.todayBriefing.v3.dismissed.${userName}.${getLocalDateKey()}`;
    try {
      if (window.localStorage.getItem(storageKey) === "true") return;
    } catch {
      // If storage is unavailable, still show the briefing for this session.
    }
    setShowBriefing(true);
  }, [userName]);

  const dismissBriefingToday = () => {
    const storageKey = `icbanq.ops.todayBriefing.v3.dismissed.${userName}.${getLocalDateKey()}`;
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch {
      // Closing still works even if localStorage is unavailable.
    }
    setShowBriefing(false);
  };

  const goToResult = (route: string) => {
    window.location.href = routeWithUser(route, userName);
    setQuery("");
  };

  const openTodayTask = (item: OpsActionItem) => {
    goToResult(item.route);
  };

  const submitSearch = () => {
    if (results[0]) goToResult(results[0].route);
  };

  return (
    <main className="home-main w-full min-w-0 overflow-x-hidden bg-[#eaf3ff]">
      {showBriefing ? (
        <TodayBriefingModal
          userName={userName}
          items={scheduledActions}
          onClose={() => setShowBriefing(false)}
          onDismissToday={dismissBriefingToday}
        />
      ) : null}
      <div className="home-shell mx-auto flex w-full max-w-[1840px] flex-col gap-5 px-5 pb-7 pt-[18px] 2xl:px-6">
        <section className="sticky top-0 z-40 min-w-0 overflow-visible border-b border-[#d7e6f7]/80 bg-[#eaf3ff]/94 px-0 py-3 backdrop-blur-xl">
          <div className="relative mx-auto flex w-full max-w-[1840px] min-w-0 flex-col items-start gap-2">
            <div className="flex h-[46px] w-full max-w-[620px] items-center gap-3 rounded-full border border-[#d5dfec] bg-white px-5 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-white">
              <Search size={18} className="shrink-0 text-[#64748b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                }}
                placeholder="무엇을 찾고 계신가요?"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-[750] text-[#10203f] outline-none placeholder:text-[#94a3b8]"
              />
              <span className="shrink-0 rounded-lg bg-[#f2f4f8] px-2 py-1 text-[11px] font-[900] text-[#64748b]">⌘K</span>
            </div>
            <div className="flex min-h-7 max-w-[780px] min-w-0 flex-wrap justify-start gap-2 overflow-hidden">
              {searchChips.map((chip) => (
                <button key={chip} onClick={() => setQuery(chip)} className="h-7 rounded-full border border-[#e7ecf4] bg-white px-3 text-[12px] font-[850] text-[#475569] shadow-sm">
                  {chip}
                </button>
              ))}
            </div>
            {showResults ? (
              <div className="absolute left-0 top-[54px] z-50 w-[620px] max-w-[calc(100vw-64px)] overflow-hidden rounded-[22px] border border-[#dce6f3] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                {results.length === 0 ? (
                  <div className="px-4 py-5 text-center text-[13px] font-[850] text-[#64748b]">검색 결과가 없습니다. 다른 키워드로 찾아보세요.</div>
                ) : (
                  results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => goToResult(result.route)}
                      className="flex w-full min-w-0 items-center gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-[#f6f8fb]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f2f6ff] text-[17px]">{result.iconLabel}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-[950] text-[#1D50A2]">{result.categoryLabel}</span>
                        <span className="block truncate text-[14px] font-[950] text-[#111827]">{result.title}</span>
                        <span className="block truncate text-[12px] font-[750] text-[#64748b]">{result.description}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </section>
        <HomeGroup
          eyebrow="Today Priority"
          title="오늘 해야 할 업무"
          description="오늘 날짜에 해당하는 마감 Action Item을 먼저 확인합니다."
        >
          <HeroSection userName={userName} taskCount={scheduledActions.length} actionRoute={scheduledActions[0]?.route} />
          <TodayActionQueue items={scheduledActions} onOpenTask={openTodayTask} />
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <MonthlyCheckCard />
            <CollectionCheckCard />
          </div>
        </HomeGroup>

        <HomeGroup
          eyebrow="Request Work Center"
          title="업무 요청"
          description="월마감 상태를 먼저 확인하고 필요한 요청을 등록합니다."
        >
          <GatekeeperBanner />
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <QuickRequestSection onSelectRequestKind={onSelectRequestKind} />
            <RequestStatusSection />
          </div>
        </HomeGroup>

        <HomeGroup
          eyebrow="Reference"
          title="참고 정보"
          description="환율, 세무 팁, 운영 공지는 업무 판단을 돕는 보조 정보입니다."
          compact
        >
          <div className="grid min-w-0 gap-3 lg:grid-cols-3">
            <ExchangeRateMiniCard exchange={exchange} />
            <DailyTaxTipMiniCard />
            <OperationNoticeMiniCard />
          </div>
        </HomeGroup>
      </div>
    </main>
  );
}

