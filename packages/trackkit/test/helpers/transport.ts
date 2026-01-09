import type { Transport } from "../../src/dispatcher";
import type { DispatchPayload } from "../../src/dispatcher/types";
import { getId } from "../../src/util";

export type SendRecord = { url: string; body: any; init?: RequestInit };

export class TestTransport implements Transport {
  id = 'test_' + getId();

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
