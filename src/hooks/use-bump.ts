import * as React from "react";

/**
 * A key that changes each time `value` goes up (not on first render or when it goes down). Put it on an element as
 * `key` together with an animation class so the animation replays, e.g. the cart badge after "Add to cart".
 */
export function useBump(value: number): number {
  const prev = React.useRef(value);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (value > prev.current) setN((x) => x + 1);
    prev.current = value;
  }, [value]);
  return n;
}
