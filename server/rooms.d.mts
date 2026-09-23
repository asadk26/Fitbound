export declare const PAIRING_TTL_MS: number;
export declare const MAX_CODE_FAILURES: number;
export declare const IP_FAILURES_PER_MIN: number;
export declare const HOST_GRACE_MS: number;

export interface Pairing {
  token: string;
  code: string;
  expiresAt: number;
  failures: number;
}

export interface ControllerSlot {
  sid: string;
  key: string;
  online: boolean;
}

export interface Room {
  id: string;
  hostKey: string;
  pairing: Pairing | null;
  controller: ControllerSlot | null;
  hostOnline: boolean;
  hostLeftAt: number | null;
}

export type JoinResult = { ok: true; room: Room; sid: string; key: string } | { ok: false; error: 'rate' | 'invalid' | 'expired' | 'busy' };

export declare class Rooms {
  constructor(opts?: { now?: () => number; makeToken?: (bytes?: number) => string; makeCode?: () => string });
  rooms: Map<string, Room>;
  createRoom(): Room;
  newPairing(room: Room): ControllerSlot | null;
  resumeHost(roomId: unknown, hostKey: unknown): Room | null;
  hostLeft(room: Room): void;
  join(creds: { token?: unknown; code?: unknown }, ip?: string): JoinResult;
  resumeController(sid: unknown, key: unknown): Room | null;
  controllerLeft(room: Room, sid: string): void;
  sweep(): void;
}
