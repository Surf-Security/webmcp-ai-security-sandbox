'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * Lets a page customize the shared TopStatusBar (subtitle text, a right-aligned action button)
 * while it's mounted, without each page rendering its own copy of the connection banner. Split
 * into two contexts on purpose: SlotSetterContext's value (setSlot, from useState) is referentially
 * stable across renders, so a page calling useTopBarActions() never re-renders just because the
 * slot content changed — only TopStatusBar (which reads SlotValueContext) does. Combining them
 * into one context object would recreate that object on every slot update and re-render every
 * consumer, including pages that only ever call the setter.
 */
const SlotValueContext = createContext({});
const SlotSetterContext = createContext(() => {});

export function TopBarSlotProvider({ children }) {
  const [slot, setSlot] = useState({});
  return (
    <SlotSetterContext.Provider value={setSlot}>
      <SlotValueContext.Provider value={slot}>{children}</SlotValueContext.Provider>
    </SlotSetterContext.Provider>
  );
}

/** Used only by TopStatusBar. */
export function useTopBarSlot() {
  return useContext(SlotValueContext);
}

/**
 * Used by a page to set its subtitle/action, auto-clearing on unmount. onAction is called via a
 * ref so the effect only needs to re-run when subtitle/actionLabel change (stable strings) —
 * passing the raw callback in the dependency array would re-fire every render, since a fresh
 * closure is a new reference each time, and would also risk the "does calling the stable setter
 * cause this page to re-render" loop this split-context design exists to avoid.
 */
export function useTopBarActions({ subtitle, actionLabel, actionIcon, onAction } = {}) {
  const setSlot = useContext(SlotSetterContext);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    setSlot({ subtitle, actionLabel, actionIcon, onAction: actionLabel ? () => onActionRef.current?.() : undefined });
    return () => setSlot({});
    // actionIcon is a component reference (imported at module scope) — stable across renders.
  }, [setSlot, subtitle, actionLabel, actionIcon]);
}
