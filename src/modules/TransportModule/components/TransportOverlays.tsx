import TripDialog from "../../TransportJourneyModule/components/TripDialog";
import MapDialog from "../../TransportMapModule/components/MapDialog";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import type { useTrip } from "../../TransportJourneyModule/hooks/useTrip";
import type { Journey, Place, Stop } from "../../TransportCoreModule/types";
import type { Locale } from "../../LangModule/providers/locale";

type TripResource = ReturnType<typeof useTrip>;

export default function TransportOverlays({
  modalOpen,
  modalLeg,
  modalResource,
  locale,
  t,
  url,
  onTripClose,
  mapOpen,
  identity,
  mode,
  place,
  stop,
  waiting,
  journey,
  country,
  onMapClose,
  onPoint,
}: {
  modalOpen: boolean;
  modalLeg?: Journey["legs"][number];
  modalResource: TripResource;
  locale: Locale;
  t: Dictionary;
  url: URL;
  onTripClose: () => void;
  mapOpen: boolean;
  identity: string;
  mode: string | null;
  place?: Place;
  stop?: Stop;
  waiting: boolean;
  journey?: Journey;
  country: string;
  onMapClose: () => void;
  onPoint: (lat: number, lon: number) => void;
}) {
  return (
    <>
      <TripDialog
        open={modalOpen}
        leg={modalLeg}
        trip={modalResource.trip}
        error={modalResource.error}
        t={t}
        locale={locale}
        url={url}
        onClose={onTripClose}
      />
      <MapDialog
        open={mapOpen}
        identity={identity}
        mode={mode}
        place={place}
        stop={stop}
        waiting={waiting}
        journey={journey}
        country={country}
        t={t}
        onClose={onMapClose}
        onPoint={onPoint}
      />
    </>
  );
}
