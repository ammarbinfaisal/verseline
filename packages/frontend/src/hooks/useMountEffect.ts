import { useEffect } from "react";

/**
 * Run a callback once when the component mounts.
 * This is the ONLY valid use of useEffect in this codebase.
 * All other effects must be restructured to not use useEffect.
 */
export function useMountEffect(callback: () => void | (() => void)): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, []);
}
