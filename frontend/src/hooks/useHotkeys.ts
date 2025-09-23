import { useEffect } from 'react';

export type HotkeyCombo = {
  combo: string;
  handler: (event: KeyboardEvent) => void;
};

function parseCombo(combo: string) {
  const parts = combo.toLowerCase().split('+');
  return {
    key: parts.find((part) => !['mod', 'ctrl', 'meta', 'shift', 'alt'].includes(part)) ?? '',
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    mod: parts.includes('mod'),
  } as const;
}

export function useHotkeys(hotkeys: HotkeyCombo[]) {
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      hotkeys.forEach((hotkey) => {
        const def = parseCombo(hotkey.combo);
        if (!def.key) return;
        const keyMatch = event.key.toLowerCase() === def.key;
        const ctrlMatch = def.ctrl ? event.ctrlKey : true;
        const metaMatch = def.meta ? event.metaKey : true;
        const modMatch = def.mod ? event.metaKey || event.ctrlKey : true;
        const shiftMatch = def.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = def.alt ? event.altKey : !event.altKey;
        if (keyMatch && ctrlMatch && metaMatch && modMatch && shiftMatch && altMatch) {
          event.preventDefault();
          hotkey.handler(event);
        }
      });
    }

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [hotkeys]);
}
