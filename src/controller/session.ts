import { ControllerBridge } from './bridge';
import { CtrlLink } from './link';

/** The phone's one controller session: relay link + detector bridge. */
export const relayUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay`;

// eslint-disable-next-line prefer-const
let bridge: ControllerBridge;
export const link = new CtrlLink(relayUrl, () => bridge.epoch);
bridge = new ControllerBridge((p) => link.send(p));
link.onGame((m) => bridge.handle(m));

export { bridge };
