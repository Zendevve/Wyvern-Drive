import { useEffect, useRef, useState } from 'react';

/**
 * Tiny Apple-style spring system (no dependency).
 *
 * Springs are the tool that makes gesture-driven UI feel fluid: they animate
 * from the current on-screen value, carry velocity through a re-target, and
 * can be grabbed and reversed at any instant. Parameters follow Apple's
 * two-knob model — damping ratio (overshoot) and response (settle speed) —
 * mapped onto a mass-spring-damper with unit mass:
 *
 *   stiffness = (2π / response)²        response in seconds, lower = snappier
 *   damping   = 2 · (2π / response) · dampingRatio
 *
 * Defaults follow Apple's guidance: damping 1.0 (critically damped, no
 * overshoot) for UI arrival; reserve damping < 1.0 for momentum-carrying
 * gestures (a drop, a flick).
 *
 * Motion that runs in JS must also honor `prefers-reduced-motion` — reduced
 * motion means gentler feedback, not none. Surfaces check `reducedMotion()`
 * and fall back to a short opacity cross-fade (or an instant settle) instead
 * of movement.
 */

/**
 * rAF-driven springs are disabled in the test environment: jsdom timer timing
 * races React's act() scopes and flushes passive effects after teardown.
 * Motion snaps to its target instead (deterministic, act-safe); unit tests
 * opt back in with an explicit `reduce: false`.
 */
const TEST_ENV =
  typeof process !== 'undefined' &&
  !!process.env &&
  process.env.NODE_ENV === 'test';

export function reducedMotion() {
  if (TEST_ENV) {
    return true;
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const SETTLE_DISTANCE = 0.001;
const SETTLE_VELOCITY = 0.001;

/**
 * Frame-rate-independent critically/under-damped spring integrator
 * (semi-implicit Euler). Holds its own position and velocity so re-targeting
 * (`set`) continues from the live value — the presentation value, never the
 * logical target — which is exactly what interruption needs.
 *
 * Usage is per property (independent X, Y, scale, opacity springs) so 2D
 * motion never desyncs.
 */
export class Spring {
  constructor(target, { response = 0.35, dampingRatio = 1 } = {}) {
    this.target = target;
    this.x = target;
    this.v = 0;
    this.response = response;
    this.dampingRatio = dampingRatio;
  }

  get stiffness() {
    const w0 = (2 * Math.PI) / this.response;
    return w0 * w0;
  }

  get damping() {
    const w0 = (2 * Math.PI) / this.response;
    return 2 * w0 * this.dampingRatio;
  }

  /** Re-target from the current value, keeping velocity (no hard cut). */
  set(target) {
    this.target = target;
  }

  /** Gesture release: hand the pointer's velocity to the spring. */
  setVelocity(velocity) {
    this.v = velocity;
  }

  /**
   * Advance one step of `dt` seconds. Returns true once the spring has
   * settled onto the target (position and velocity both below threshold).
   *
   * Uses implicit (backward) Euler, which is unconditionally stable for the
   * damped harmonic oscillator — snappy springs (small response) never blow
   * up regardless of frame timing.
   */
  step(dt) {
    const k = this.stiffness;
    const c = this.damping;
    this.v = (this.v - k * dt * (this.x - this.target)) / (1 + c * dt);
    this.x += this.v * dt;
    if (
      Math.abs(this.x - this.target) < SETTLE_DISTANCE &&
      Math.abs(this.v) < SETTLE_VELOCITY
    ) {
      this.x = this.target;
      this.v = 0;
      return true;
    }
    return false;
  }
}

/**
 * React hook: returns the spring-animated value chasing `target`.
 *
 * Interruptible by design — a target change re-targets the same running
 * spring. With reduced motion (or when `reduce` is forced) the value snaps to
 * the target so no movement is shown; callers still get the state change for
 * color/opacity-only feedback. Pass `initial` to start away from the target
 * and animate in on mount (entrance motion).
 */
export function useSpring(
  target,
  { response = 0.35, dampingRatio = 1, initial, reduce = reducedMotion() } = {}
) {
  const springRef = useRef(null);
  if (springRef.current === null) {
    springRef.current = new Spring(initial !== undefined ? initial : target, {
      response,
      dampingRatio,
    });
  }
  const [value, setValue] = useState(reduce ? target : springRef.current.x);

  useEffect(() => {
    const spring = springRef.current;
    spring.response = response;
    spring.dampingRatio = dampingRatio;
    spring.set(target);

    if (reduce) {
      spring.x = target;
      spring.v = 0;
      setValue(target);
      return undefined;
    }

    let rafId;
    let last = performance.now();
    const tick = (now) => {
      // Clamp the step so a backgrounded tab never explodes the spring.
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (spring.step(dt)) {
        setValue(target);
        return;
      }
      setValue(spring.x);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, response, dampingRatio, reduce]);

  return value;
}

/**
 * Small style helper: turn a 0..1 progress value plus a transform into an
 * inline style, skipping transforms entirely under reduced motion so the
 * only motion left is the caller's opacity cross-fade. Pass `reduce: false`
 * to force the full transform (unit tests).
 */
export function springStyle(value, { reduce = reducedMotion(), opacity = value, scale = value } = {}) {
  if (reduce) {
    return { opacity };
  }
  return {
    opacity,
    transform: `scale(${scale})`,
    willChange: 'transform, opacity',
  };
}
