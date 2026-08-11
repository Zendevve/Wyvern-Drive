import React, { useEffect, useRef, useState } from 'react';
import { Spring, reducedMotion } from './springs';

/**
 * Spring-driven transition for MUI Dialog (a `TransitionComponent`).
 *
 * Mirrors MUI's own Grow: renders the paper immediately when the dialog is
 * open (so content is synchronously in the DOM for a11y and tests), then
 * animates with a critically damped spring — scale 0.96 → 1, opacity 0 → 1,
 * response 0.3s. Exit mirrors the same path (scale → 0.97, opacity → 0,
 * response 0.22s) and calls `onExited` only when the spring settles, so MUI
 * unmounts the paper at the right moment.
 *
 * The spring re-targets from the live value, so rapid open/close/reopen is
 * interruptible — the motion continues from where it was, never from the
 * logical target (Apple: always animate from the presentation value).
 * Under `prefers-reduced-motion` this becomes a pure opacity cross-fade.
 */
const DialogTransition = React.forwardRef(function DialogTransition(props, ref) {
  const { children, in: inProp, onEnter, onExited } = props;
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState({ opacity: 0, transform: 'scale(0.96)' });
  const springRef = useRef(null);
  const onEnterRef = useRef(onEnter);
  const onExitedRef = useRef(onExited);
  onEnterRef.current = onEnter;
  onExitedRef.current = onExited;

  if (springRef.current === null) {
    // The component remounts on every open (Modal unmounts it between
    // shows), so the spring must always start at 0 — never at the open
    // target — or the entrance would snap instantly on the first frame.
    springRef.current = new Spring(0, { response: 0.3 });
  }

  useEffect(() => {
    const spring = springRef.current;
    const entering = Boolean(inProp);
    spring.response = entering ? 0.3 : 0.22;
    spring.set(entering ? 1 : 0);

    // MUI's Modal tracks its `exited` state through the transition's
    // onEnter/onExited callbacks; without the enter signal it believes the
    // dialog is still exited and unmounts the whole subtree on close.
    if (entering && onEnterRef.current) {
      onEnterRef.current();
    }

    if (reducedMotion()) {
      spring.x = entering ? 1 : 0;
      spring.v = 0;
      setStyle({ opacity: entering ? 1 : 0 });
      setMounted(entering);
      if (!entering && onExitedRef.current) {
        onExitedRef.current();
      }
      return undefined;
    }

    setMounted(true);
    let rafId;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const v = spring.x;
      if (spring.step(dt)) {
        const settled = spring.x;
        setStyle({
          opacity: settled,
          transform: settled >= 1 ? 'scale(1)' : `scale(${0.96 + 0.04 * settled})`,
        });
        if (!entering) {
          setMounted(false);
          if (onExitedRef.current) {
            onExitedRef.current();
          }
        }
        return;
      }
      setStyle({
        opacity: v,
        transform: `scale(${0.96 + 0.04 * v})`,
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inProp]);

  if (!mounted && !inProp) {
    return null;
  }

  return React.cloneElement(children, {
    ref,
    style: {
      ...(children.props.style || {}),
      ...style,
      transformOrigin: 'center center',
      willChange: 'transform, opacity',
    },
  });
});

export default DialogTransition;
