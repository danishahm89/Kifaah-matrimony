import { create } from 'zustand';

interface ToastState {
  text: string | null;
  show: (text: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  text: null,
  show: (text) => {
    if (timer) clearTimeout(timer);
    set({ text });
    timer = setTimeout(() => set({ text: null }), 3200);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ text: null });
  },
}));
