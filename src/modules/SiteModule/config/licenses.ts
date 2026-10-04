/** Main upstream components; data licences are maintained separately by TransportModule. */
export const softwareLicenses = [
  {
    name: "OpenLayers",
    license: "BSD-2-Clause",
    source: "https://openlayers.org/",
    licenseUrl: "/licenses/openlayers.txt",
  },
  {
    name: "Manrope",
    license: "SIL Open Font License 1.1",
    source: "https://fontsource.org/fonts/manrope",
    licenseUrl: "/licenses/manrope.txt",
  },
  {
    name: "OpenTripPlanner",
    license: "LGPL-3.0-or-later; Apache-2.0",
    source: "https://www.opentripplanner.org/",
    licenseUrl:
      "https://github.com/opentripplanner/OpenTripPlanner/blob/v2.9.0/LICENSE",
  },
  {
    name: "Jackson",
    license: "Apache-2.0",
    source: "https://github.com/FasterXML/jackson",
    licenseUrl:
      "https://github.com/FasterXML/jackson-databind/blob/2.18/LICENSE",
  },
  {
    name: "Apache Commons CSV",
    license: "Apache-2.0",
    source: "https://commons.apache.org/proper/commons-csv/",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  {
    name: "MobilityData GTFS Validator",
    license: "Apache-2.0",
    source: "https://github.com/MobilityData/gtfs-validator",
    licenseUrl:
      "https://github.com/MobilityData/gtfs-validator/blob/v8.0.1/LICENSE",
  },
  {
    name: "Java-WebSocket",
    license: "MIT",
    source: "https://github.com/TooTallNate/Java-WebSocket",
    licenseUrl:
      "https://github.com/TooTallNate/Java-WebSocket/blob/v1.6.0/LICENSE",
  },
  {
    name: "Protocol Buffers",
    license: "BSD-3-Clause",
    source: "https://protobuf.dev/",
    licenseUrl:
      "https://github.com/protocolbuffers/protobuf/blob/v33.2/LICENSE",
  },
  {
    name: "GTFS-Realtime schema",
    license: "Apache-2.0",
    source: "https://gtfs.org/documentation/realtime/reference/",
    licenseUrl:
      "https://github.com/google/transit/blob/master/gtfs-realtime/proto/gtfs-realtime.proto",
  },
] as const;
