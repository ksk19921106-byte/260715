"use client";

import { ShieldAlert } from "lucide-react";
import { OpsShell } from "./OpsShell";

export function AccessDenied() {
  return (
    <OpsShell>
      <section className="px-6 py-5">
        <div className="ops-card p-6">
          <div className="flex items-start gap-4">
            <div className="ops-icon-circle shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Access Control</p>
              <h1 className="mt-1 text-[24px] font-[950] tracking-[-0.02em] text-[#111827]">접근 권한이 없습니다.</h1>
              <p className="mt-2 text-[13px] font-[700] leading-6 text-[#64748b]">
                이 화면은 VIPS팀 권한 사용자만 접근할 수 있습니다. MVP 테스트 사용자에서 VIPS 권한 계정으로 전환해 주세요.
              </p>
            </div>
          </div>
        </div>
      </section>
    </OpsShell>
  );
}

