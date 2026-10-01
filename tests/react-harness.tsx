/** Browser-only fixtures imported by Playwright through the dev server; not an application route. */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import MainMenu from "../src/modules/UIModule/components/MainMenu";
import AdSlot from "../src/modules/AdsModule/components/AdSlot";
import { consentProvider } from "../src/modules/AdsModule/providers/consent";
import "../src/modules/UIModule/styles/main-menu.css";
import "../src/modules/AdsModule/styles/components.css";
function Harness() {
  const [visible, setVisible] = useState(true);
  return (
    <div>
      <button onClick={() => setVisible((v) => !v)}>Toggle harness menu</button>
      <button onClick={() => consentProvider.setAdvertising(true)}>
        Grant ad consent
      </button>
      {visible && (
        <MainMenu
          locale="cs"
          label="Test navigation"
          openLabel="Open test menu"
          closeLabel="Close test menu"
          items={[{ href: "#harness-target", label: "Test destination" }]}
          brand={<span>Test brand</span>}
        />
      )}
      <AdSlot
        position="top"
        unit={{ provider: "google", client: "ca-pub-123", slot: "456" }}
        label="Test ad"
        placeholder="Awaiting consent"
      />
      <div id="harness-target">Test target</div>
    </div>
  );
}
export function mountHarness() {
  const element = document.createElement("div");
  element.id = "react-test-harness";
  document.body.prepend(element);
  const root = createRoot(element);
  root.render(<Harness />);
  return () => {
    root.unmount();
    element.remove();
  };
}
