export const transitPaths: Record<string, string> = {
  copy: "M9 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2ZM16 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h1",
  tram: "M5 16V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3ZM5 11h14M8 3v8m8-8v8M8 15h.01M16 15h.01M8 19l-2 3m10-3 2 3M9 1h6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
  swap: "M4 7h15l-4-4m5 14H5l4 4",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  locate:
    "M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  map: "m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  check: "m5 12 4 4L19 6",
  close: "m5 5 14 14M5 19 19 5",
  clock: "M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  globe:
    "M2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",

  walk: "M15 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 21l3-7m3 0 3 7M7 12l2-4 4-1 2 5 4 1M12 8l-2 6 4 2",
  bus: "M4 16V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11H4Zm0-5h16M7 16v4m10-4v4M7 14h.01m10 0h.01M1 7v5m22-5v5",
  trolleybus:
    "M8 5 11 1m3 4 3-4M4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4Zm0-5h16M7 16v4m10-4v4M7 14h.01m10 0h.01M1 9v4m22-4v4",
  train:
    "M5 16V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3ZM5 10h14M12 2v8M8 14h.01m8 0h.01M8 19l-3 3m11-3 3 3",
  metro:
    "M3 21V11a9 9 0 0 1 18 0v10M7 17V7h10v10H7Zm0-5h10M9 15h.01m6 0h.01M9 17l-2 4m8-4 2 4",
  ferry:
    "M3 14l9-3 9 3-3 6H6l-3-6Zm3-1V6h12v7M10 6V2h4v4M2 22l3-1 4 1 3-1 4 1 3-1 3 1",
  airplane:
    "m2 14 8-4V4a2 2 0 0 1 4 0v6l8 4v2l-8-2v5l3 2v1l-5-1-5 1v-1l3-2v-5l-8 2v-2Z",
  gondola: "m2 5 20-4M12 3v5M6 8h12l2 5v7H4v-7l2-5Zm-2 6h16M9 8v6m6-6v6",
  transport: "M4 5h16v13H4zM4 11h16M7 18v3m10-3v3M8 15h.01m8 0h.01",
  calendar: "M4 5h16v16H4zM4 10h16M8 2v6m8-6v6M8 14h2m4 0h2m-8 4h2",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  building:
    "M4 22V3h12v19M2 22h20M16 10h4v12M7 7h2m2 0h2M7 11h2m2 0h2M7 15h2m2 0h2M8 22v-3h4v3",
  route:
    "M5 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 6h12a3 3 0 0 1 0 6H7a3 3 0 0 0 0 6h12",
  ticket: "M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 0v3m0 3v2m0 3v3",
  bicycle:
    "M9 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm14 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 17l5-9 5 9H5Zm3-9h10l3 9M16 4h3v4M7 5h5",
  wheelchair:
    "M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM11 7v7h6l3 6 3-1M11 10h6M8 11a6 6 0 1 0 7 9",
  wifi: "M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01",
  suitcase: "M4 7h16v14H4zM9 7V3h6v4M8 7v14m8-14v14",
  plug: "M8 2v6m8-6V2M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v4",
  cup: "M3 8h14v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Zm14 1h2a3 3 0 0 1 0 6h-2M6 2v3m4-3v3m4-3v3",
};
