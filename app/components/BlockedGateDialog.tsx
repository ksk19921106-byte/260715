"use client";

import { AlertCircle } from "lucide-react";

export function BlockedGateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const openIki = () => {
    window.open("https://iki.icbanq.com", "_blank", "noopener,noreferrer");
  };

  const openTrades = () => {
    window.location.href = "/month-end";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b3e]/30 px-4">
      <div className="w-[500px] rounded-[22px] border border-[rgba(243,153,69,0.30)] bg-white shadow-[0_22px_70px_rgba(15,35,70,0.22)]">
        <div className="flex gap-4 border-b border-[#e3ebf6] px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff5ec] text-[#F39945]">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[18px] font-[900] text-[#10203f]">VIPS팀 요청 진입 불가</p>
            <p className="mt-2 whitespace-pre-line text-[13px] font-[700] leading-6 text-[#31445e]">
              미종료 거래가 남아 있어 VIPS팀 요청 진입이 불가합니다.{"\n"}거래 종료 관리에서 남은 거래를 먼저 확인해주세요.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-2xl bg-[#fff7f7] px-4 py-3 text-[13px] font-[700] leading-6 text-[#34496b]">
            이 알림은 “월마감 하세요”가 아니라, 내 거래가 아직 정상 종료되지 않았다는 Gatekeeper 안내입니다.
            <p className="mt-2 font-[900] text-[#F39945]">미종료 거래가 0건이 되면 요청 진입이 가능합니다.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e3ebf6] px-6 py-4">
          <button onClick={openTrades} className="h-10 rounded-xl bg-[#F39945] px-5 text-[13px] font-[900] text-white">
            미종료 거래 확인하기
          </button>
          <button onClick={openIki} className="h-10 rounded-xl bg-[#1D50A2] px-5 text-[13px] font-[900] text-white">
            IKI 월마감 바로가기
          </button>
          <button onClick={onClose} className="h-10 rounded-xl border border-[#cfdbea] bg-white px-5 text-[13px] font-[900] text-[#31445e]">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

