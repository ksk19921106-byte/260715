"use client";

import { AccessDenied } from "../components/AccessDenied";
import { ModulePage } from "../components/ModulePage";
import { OpsProgressPanel } from "../components/OpsProgressPanel";
import { useSelectedUser } from "../hooks/useSelectedUser";
import { canAccessSalesOperations, getOperationsScope } from "../services/organization";

export default function SalesOpsPage() {
  const { selectedUser } = useSelectedUser();
  if (!canAccessSalesOperations(selectedUser)) return <AccessDenied />;
  return (
    <ModulePage compactMobile eyebrow="TEAM OPERATIONS" title="팀별 운영현황" description={getOperationsScope(selectedUser).label}>
      <OpsProgressPanel />
    </ModulePage>
  );
}
