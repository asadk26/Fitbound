import { useSyncExternalStore } from 'react';
import { getSave, subscribeSave } from '../game/store';
import type { SaveData } from '../game/save';

export function useSave(): SaveData {
  return useSyncExternalStore(subscribeSave, getSave, getSave);
}
