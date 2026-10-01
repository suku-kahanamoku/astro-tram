/**
 * Životní cyklus WebSocket spojení se serverovým realtime gateway.
 * `idle` je stav před prvním `connect()`, `closed` konečný stav po `close()`.
 */
export type ConnectionState =
  "idle" | "connecting" | "open" | "retrying" | "closed";

/** Konfigurace realtime klienta. */
export interface RealtimeOptions {
  /** URL gateway, musí být `ws:` nebo `wss:` bez přihlašovacích údajů. */
  url: string;
  /** Callback zavolaný pro každou zprávu, která se podaří rozparsovat jako JSON. */
  onMessage: (data: unknown) => void;
  /** Volitelný callback průběžného stavu spojení pro UI. */
  onState?: (state: ConnectionState) => void;
  /** Limit počtu automatických pokusů o připojení, defaultně 8. */
  maxRetries?: number;
  // Use short-lived, server-issued tickets if your gateway needs authentication.
  // Never pass PHP_CORE_API_KEY or the php-core bearer token in a URL/protocol.
  /**
   * Subprotokoly předané konstruktoru `WebSocket`.
   *
   * Používejte krátkodobé tikety vydané serverem, pokud gateway vyžaduje
   * autentizaci. `PHP_CORE_API_KEY` ani bearer token z php-core se do URL
   * ani do subprotokolu nikdy nepředávají.
   */
  protocols?: string[];
}

/**
 * Vytvoří WebSocket klienta s omezeným automatickým připojováním.
 *
 * Klient zkoumá URL, vyžaduje `wss:` na stránkách s HTTPS a po uzavření
 * kvůli autentizaci nebo politice už znovu nepřipojuje. Ostatní uzavření
 * vedou k exponenciálně prodlouženému čekání s náhodným rozptylem.
 *
 * @param options URL, callbacky, limit pokusů a subprotokoly z {@link RealtimeOptions}.
 * @returns Objekt s metodami `connect()`, `send(data)` a `close()`.
 * @throws Error při neplatném URL WebSocketu (`Invalid WebSocket URL`)
 *   nebo při `ws:` na stránce s `https:` (`HTTPS requires WSS`).
 */
export function createRealtimeClient(options: RealtimeOptions) {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let stopped = true;
  /** Předá nový stav spojení do `onState`, pokud je callback zadán. */
  const state = (value: ConnectionState) => options.onState?.(value);
  /**
   * Otevře spojení, pokud už žádné neexistuje ani nečeká se na další pokus.
   * Zavádí otevřené handlery `onopen`, `onmessage` a `onclose` včetně plánování
   * dalších pokusů s exponenciálním čekáním.
   *
   * @returns Nic.
   * @throws Error při neplatném URL WebSocketu nebo při `ws:` na stránce s `https:`.
   */
  const connect = () => {
    if (
      !stopped &&
      (timer ||
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING)
    )
      return;
    const url = new URL(options.url);
    if (!["wss:", "ws:"].includes(url.protocol) || url.username || url.password)
      throw new Error("Invalid WebSocket URL");
    if (
      typeof location !== "undefined" &&
      location.protocol === "https:" &&
      url.protocol !== "wss:"
    )
      throw new Error("HTTPS requires WSS");
    stopped = false;
    state("connecting");
    const current = new WebSocket(url, options.protocols);
    socket = current;
    current.onopen = () => {
      retries = 0;
      state("open");
    };
    current.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      options.onMessage(data);
    };
    current.onclose = (event) => {
      if (stopped || socket !== current) return;
      // Authentication/policy closures must not cause an endless reconnect loop.
      if (
        [1000, 1008, 4001, 4003, 4401, 4403].includes(event.code) ||
        retries >= (options.maxRetries ?? 8)
      ) {
        state("closed");
        return;
      }
      state("retrying");
      const delay =
        Math.min(30_000, 1000 * 2 ** retries++) + Math.random() * 500;
      timer = setTimeout(() => {
        timer = undefined;
        connect();
      }, delay);
    };
  };
  return {
    /**
     * Zahájí připojení k gateway. Pokud už spojení existuje nebo se čeká
     * na další pokus, volání je neúčinné.
     *
     * @returns Nic.
     * @throws Error při neplatném URL WebSocketu nebo při `ws:` na stránce s `https:`.
     */
    connect,
    /**
     * Odešle zprávu na otevřené spojení.
     *
     * @param data Data, která se serializují do JSON.
     * @returns `true`, pokud byla zpráva předána WebSocketu; `false`, pokud
     *   spojení není otevřené nebo je více než 1 MB neodeslaných dat.
     */
    send(data: unknown): boolean {
      if (
        socket?.readyState !== WebSocket.OPEN ||
        socket.bufferedAmount > 1_000_000
      )
        return false;
      socket.send(JSON.stringify(data));
      return true;
    },
    /**
     * Ukončí spojení, zruší čekající pokus a odpojí všechny handlery,
     * aby se gateway nepoznával po `close()` jako mrtvý klient.
     *
     * @returns Nic.
     */
    close() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
      if (socket) {
        socket.onclose = null;
        socket.onopen = null;
        socket.onmessage = null;
        socket.close(1000, "Client disconnected");
        socket = undefined;
      }
      state("closed");
    },
  };
}
