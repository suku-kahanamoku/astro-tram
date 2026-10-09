/** Browser-only fixture; never mounted by an application route. */
import { createRoot } from "react-dom/client";
import { useRef, useState } from "react";
import OSMMap from "../src/modules/OSMModule/components/OSMMap";
import type { OSMMapControls } from "../src/modules/OSMModule/hooks/useOSMMap";
import type { MapRoute } from "../src/modules/OSMModule/types";

function Harness() {
  const ref = useRef<OSMMapControls>(null);
  const [enabled, setEnabled] = useState(true);
  const [markers, setMarkers] = useState([
    {
      id: "point",
      lat: 50.075,
      lon: 14.42,
      label: "Test point",
      color: "#009955",
    },
  ]);
  const [route, setRoute] = useState<MapRoute>();
  const [selection, setSelection] = useState("");
  const [point, setPoint] = useState("");
  const [zoom, setZoom] = useState("");
  return (
    <div>
      <button onClick={() => setMarkers([{ ...markers[0], lon: 14.44 }])}>
        Move marker
      </button>
      <button onClick={() => ref.current?.setLayerVisible("markers", false)}>
        Hide markers
      </button>
      <button onClick={() => ref.current?.setLayerVisible("markers", true)}>
        Show markers
      </button>
      <button
        onClick={() =>
          setRoute({
            legs: [
              {
                from: { name: "Start", lat: 50.07, lon: 14.41 },
                to: { name: "Finish", lat: 50.08, lon: 14.43 },
                color: "#123456",
                geometry: {
                  coordinates: [
                    [14.41, 50.07],
                    [14.43, 50.08],
                  ],
                },
              },
            ],
          })
        }
      >
        Add route
      </button>
      <button onClick={() => setRoute(undefined)}>Remove route</button>
      <button onClick={() => setEnabled((v) => !v)}>Toggle map</button>
      <OSMMap
        ref={ref}
        center={[14.42, 50.075]}
        zoom={13}
        enabled={enabled}
        markers={markers}
        route={route}
        onMarkerSelect={(marker) => setSelection(marker.id)}
        onPick={(lat, lon) => setPoint(`${lat},${lon}`)}
        onViewportChange={(view) => setZoom(view.zoom.toFixed(3))}
      />
      <output data-marker-selection>{selection}</output>
      <output data-picked-point>{point}</output>
      <output data-map-zoom>{zoom}</output>
    </div>
  );
}

export function mountOSMHarness() {
  const element = document.createElement("div");
  element.id = "osm-test-harness";
  document.body.prepend(element);
  const root = createRoot(element);
  root.render(<Harness />);
  return () => {
    root.unmount();
    element.remove();
  };
}
