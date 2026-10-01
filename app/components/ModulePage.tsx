import type { ReactNode } from "react";
import { OpsShell } from "./OpsShell";

export function ModulePage({
  eyebrow,
  title,
  description,
  compactMobile = false,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  compactMobile?: boolean;
  children?: ReactNode;
}) {
  return (
    <OpsShell compactMobile={compactMobile}>
      <section className={compactMobile ? "min-w-0 px-3 py-5 sm:px-8 sm:py-7" : "min-w-0 px-8 py-7"}>
        <div className="mx-auto min-w-0 max-w-[1540px]">
          <div className="mb-5 flex min-h-[76px] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">{eyebrow}</p>
              <h1 className="mt-1 truncate text-[28px] font-[950] tracking-[-0.03em] text-[#10203f]">{title}</h1>
              <p className="mt-1 text-[13px] font-[750] leading-5 text-[#50627d]">{description}</p>
            </div>
          </div>
          {children ?? (
            <div className="rounded-[22px] border border-dashed border-[#c6d4e9] bg-white px-5 py-8 text-[13px] font-[750] text-[#64748b] shadow-[0_14px_38px_rgba(15,23,42,0.055)]">
              이 영역은 이후 운영 기능 확장을 위한 기본 화면입니다.
            </div>
          )}
        </div>
      </section>
    </OpsShell>
  );
}

