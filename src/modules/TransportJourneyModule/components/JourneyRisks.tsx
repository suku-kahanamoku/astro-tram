import { createContext, useContext, type ReactNode } from "react";
import { useJourneyTiming } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import type { Journey } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
const RiskContext = createContext<readonly number[]>([]);
export function JourneyRiskProvider({
  journey,
  children,
}: {
  journey: Journey;
  children: ReactNode;
}) {
  const { transferRiskLegs } = useJourneyTiming(journey);
  return (
    <RiskContext.Provider value={transferRiskLegs}>
      {children}
    </RiskContext.Provider>
  );
}
export function JourneyRiskNotice({
  index,
  t,
}: {
  index: number;
  t: Dictionary;
}) {
  return useContext(RiskContext).includes(index) ? (
    <p
      className="notice transfer-risk-notice"
      role="status"
      data-transfer-risk={index}
    >
      {t.transferAtRisk}
    </p>
  ) : null;
}
