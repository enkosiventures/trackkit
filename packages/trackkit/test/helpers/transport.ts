import { NetworkDispatcher, Transport } from "../../src/dispatcher";
import { DispatchPayload, NetworkDispatcherOptions } from "../../src/dispatcher/types";
import { Sender } from "../../src/providers/base/transport";

export type SendRecord = { url: string; body: any; init?: RequestInit };

export class TestTransport implements Transport {
  id = 'test_' + Math.random().toString(36).substring(2, 8);

  public sends: SendRecord[] = [];
  private remainingFailures = 0;
  private failureStatus = 503;

  /** Fail the next N sends with given status to exercise retry paths. */
  failNext(n: number, status = 503) {
    this.remainingFailures = n;
    this.failureStatus = status;
  }

  async send(payload: DispatchPayload) {
    if (this.remainingFailures > 0) {
      this.remainingFailures--;
      const err: any = new Error(`HTTP ${this.failureStatus}`);
      err.status = this.failureStatus;
      throw err;
    }
    this.sends.push(payload);
  }
}

export function makeTestDispatcherSender(opts: NetworkDispatcherOptions, transport: Transport): Sender {
  const dispatcher = new NetworkDispatcher(opts);
  dispatcher._setTransportForTests(transport);
  const RESPONSE_OK = { ok: true, status: 204, statusText: 'OK' } as unknown as Response;

  return async ({ method, url, headers, body }) => {
    // Respect method nuances only to the extent your dispatcher/resolveTransport supports.
    // Common case: POST/AUTO. For BEACON, resolveTransport will choose beacon when applicable.
    const init: RequestInit = {
      method: method === 'GET' ? 'GET' : 'POST',
      headers,
    };
    await dispatcher.send({ url, body, init });
    return RESPONSE_OK; // no per-event response in batched path
  };
}