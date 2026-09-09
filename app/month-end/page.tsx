import { ModulePage } from "@/app/components/ModulePage";
import { MonthEndPasteClient } from "./MonthEndPasteClient";

export default function MonthEndPage() {
  return (
    <ModulePage
      eyebrow="MONTH-END ACTION CENTER"
      title="월마감 체크"
      description="ERP 월마감 데이터를 붙여넣으면 영업이 확인해야 할 거래를 자동으로 정리합니다."
    >
      <MonthEndPasteClient />
    </ModulePage>
  );
}
