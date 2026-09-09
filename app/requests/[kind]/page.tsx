import Link from "next/link";
import { ModulePage } from "@/app/components/ModulePage";
import { REQUEST_FORM_CONFIGS, type RequestKind } from "../../services/formValidation";
import { RequestKindForm } from "./RequestKindForm";

const requestKinds = Object.keys(REQUEST_FORM_CONFIGS) as RequestKind[];

export default async function RequestKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await params;
  const kind = rawKind as RequestKind;
  const config = REQUEST_FORM_CONFIGS[kind];

  if (!config || !requestKinds.includes(kind)) {
    return (
      <ModulePage eyebrow="VIPS Requests" title="요청 유형을 찾을 수 없습니다" description="요청 메뉴에서 다시 선택해주세요.">
        <Link href="/requests" className="mt-6 inline-flex h-10 items-center rounded-full bg-[#1D50A2] px-4 text-[13px] font-[850] text-white">
          요청 메뉴로 돌아가기
        </Link>
      </ModulePage>
    );
  }

  return (
    <ModulePage eyebrow="VIPS Request Form" title={config.formTitle} description={config.subtitle}>
      <RequestKindForm kind={kind} />
      {kind === "taxInvoice" && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const formatWon = (value) => Math.floor(value || 0).toLocaleString("ko-KR") + "원";
                const numberValue = (value) => Number(String(value || "").replaceAll(",", "")) || 0;
                const visibleLines = () => Array.from(document.querySelectorAll('[data-tax-line]')).filter((line) => !line.classList.contains("hidden"));
                const updateTaxAmounts = () => {
                  const supplyTarget = document.querySelector('[data-tax-calc="supply"]');
                  const vatTarget = document.querySelector('[data-tax-calc="vat"]');
                  const totalTarget = document.querySelector('[data-tax-calc="total"]');
                  if (!supplyTarget || !vatTarget || !totalTarget) return;
                  let supply = 0;
                  visibleLines().forEach((line) => {
                    const index = line.getAttribute("data-tax-line");
                    const quantityInput = line.querySelector('[data-tax-quantity]');
                    const unitPriceInput = line.querySelector('[data-tax-unit]');
                    const lineSupplyTarget = document.querySelector('[data-tax-line-supply="' + index + '"]');
                    const lineSupply = numberValue(quantityInput && quantityInput.value) * numberValue(unitPriceInput && unitPriceInput.value);
                    supply += lineSupply;
                    if (lineSupplyTarget) lineSupplyTarget.textContent = formatWon(lineSupply);
                  });
                  const vat = Math.floor(supply * 0.1);
                  const total = supply + vat;
                  supplyTarget.textContent = formatWon(supply);
                  vatTarget.textContent = formatWon(vat);
                  totalTarget.textContent = formatWon(total);
                };
                const bindTaxLineControls = () => {
                  const addButton = document.querySelector('[data-add-tax-line="true"]');
                  if (addButton && addButton.dataset.bound !== "true") {
                    addButton.dataset.bound = "true";
                    addButton.addEventListener("click", () => {
                      const nextLine = Array.from(document.querySelectorAll('[data-tax-line].hidden'))[0];
                      if (nextLine) nextLine.classList.remove("hidden");
                      if (!Array.from(document.querySelectorAll('[data-tax-line].hidden')).length) addButton.setAttribute("disabled", "true");
                      updateTaxAmounts();
                    });
                  }
                  document.querySelectorAll('[data-remove-tax-line]').forEach((button) => {
                    if (button.dataset.bound === "true") return;
                    button.dataset.bound = "true";
                    button.addEventListener("click", () => {
                      const index = button.getAttribute("data-remove-tax-line");
                      const line = document.querySelector('[data-tax-line="' + index + '"]');
                      if (!line) return;
                      line.querySelectorAll("input").forEach((input) => {
                        input.value = "";
                      });
                      line.classList.add("hidden");
                      const add = document.querySelector('[data-add-tax-line="true"]');
                      if (add) add.removeAttribute("disabled");
                      updateTaxAmounts();
                    });
                  });
                };
                window.clearInterval(window.__icbanqTaxCalcTimer);
                window.__icbanqTaxCalcTimer = window.setInterval(() => {
                  bindTaxLineControls();
                  updateTaxAmounts();
                }, 120);
                window.addEventListener("input", updateTaxAmounts, true);
                window.addEventListener("change", updateTaxAmounts, true);
                bindTaxLineControls();
                updateTaxAmounts();
              })();
            `
          }}
        />
      )}
    </ModulePage>
  );
}
