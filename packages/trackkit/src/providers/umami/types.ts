import { EventType } from "../../types";

export type UmamiOptions = {
  provider: 'umami';
  site?: string;
  website: string;
  host?: string;
};

export interface UmamiPayload {
  website: string;
  url?: string;
  name?: string;                         // required for type:'event' ("custom event")
  data?: Record<string, unknown>;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
}

export interface UmamiSendBody {
  type: EventType;
  payload: UmamiPayload;
}