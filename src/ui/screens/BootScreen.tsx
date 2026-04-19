/**
 * @file Boot / splash screen. Auto-navigates to the menu after a tiny delay
 * so devs see the transition pipeline working out of the box.
 *
 * TODO: replace with real loading logic — preload assets, wait for audio
 *       context unlock, etc.
 */

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';

export default function BootScreen(_props: UIProps<unknown>) {
  useEffect(() => {
    const t = setTimeout(() => {
      eventBus.emit('navigate:request', { to: 'menu', module: null });
    }, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white/80">
      <Loader2 className="size-10 animate-spin text-indigo-400" />
      <p className="mt-4 text-sm tracking-widest uppercase opacity-70">Setting sail</p>
    </div>
  );
}
