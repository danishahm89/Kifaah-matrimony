import { create } from 'zustand';
import { tr } from '../i18n/t';

export type ToastKind = 'info' | 'success' | 'error';

interface ToastState {
  text: string | null;
  kind: ToastKind;
  show: (text: string, kind?: ToastKind) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  text: null,
  kind: 'info',
  show: (text, kind) => {
    if (timer) clearTimeout(timer);
    // Guess the tone from the wording when the caller doesn't say, so existing calls get it too.
    const guessed: ToastKind = /could not|couldn't|failed|try again/i.test(text) ? 'error' : 'info';
    set({ text: tr(text), kind: kind ?? guessed });
    timer = setTimeout(() => set({ text: null }), 3200);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ text: null });
  },
}));
