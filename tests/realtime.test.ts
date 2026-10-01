import test from "node:test";
import assert from "node:assert/strict";
import { createRealtimeClient } from "../src/modules/RealtimeModule/providers/client";

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(public url: URL | string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  disconnect(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}
test("websocket sends only when ready, decodes JSON, reconnects and cancels retry on cleanup", (t) => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  t.after(() => {
    globalThis.WebSocket = original;
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakeSocket.instances = [];
  const messages: unknown[] = [];
  const states: string[] = [];
  const client = createRealtimeClient({
    url: "wss://gateway.example.test",
    onMessage: (data) => messages.push(data),
    onState: (state) => states.push(state),
  });
  assert.equal(client.send({ type: "early" }), false);
  client.connect();
  client.connect();
  assert.equal(FakeSocket.instances.length, 1);
  const socket = FakeSocket.instances[0]!;
  socket.open();
  assert.equal(client.send({ type: "ping" }), true);
  assert.deepEqual(socket.sent, ['{"type":"ping"}']);
  socket.onmessage?.({ data: "invalid JSON" });
  socket.onmessage?.({ data: '{"type":"pong"}' });
  assert.deepEqual(messages, [{ type: "pong" }]);
  socket.bufferedAmount = 1_000_001;
  assert.equal(client.send({ type: "overflow" }), false);
  socket.disconnect(1006);
  assert.equal(states.at(-1), "retrying");
  t.mock.timers.tick(1501);
  assert.equal(FakeSocket.instances.length, 2);
  FakeSocket.instances[1]!.disconnect(1006);
  client.close();
  t.mock.timers.tick(60_000);
  assert.equal(FakeSocket.instances.length, 2);
  assert.equal(states.at(-1), "closed");
});
test("websocket policy closures do not retry and unsafe URLs are rejected", (t) => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  t.after(() => {
    globalThis.WebSocket = original;
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakeSocket.instances = [];
  const client = createRealtimeClient({
    url: "wss://gateway.example.test",
    onMessage() {},
  });
  client.connect();
  FakeSocket.instances[0]!.disconnect(4401);
  t.mock.timers.tick(60_000);
  assert.equal(FakeSocket.instances.length, 1);
  client.close();
  for (const url of [
    "https://gateway.example.test",
    "wss://secret:token@gateway.example.test",
  ])
    assert.throws(() =>
      createRealtimeClient({ url, onMessage() {} }).connect(),
    );
});
