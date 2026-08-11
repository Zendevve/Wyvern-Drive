import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Spring, useSpring, reducedMotion, springStyle } from './springs';

// The Spring class is deterministic — drive it with fixed steps, no rAF.
describe('Spring', () => {
  it('settles exactly onto the target at critical damping with no perceptible overshoot', () => {
    const s = new Spring(0, { response: 0.35, dampingRatio: 1 });
    s.set(100);
    let max = -Infinity;
    for (let i = 0; i < 1000; i += 1) {
      s.step(1 / 60);
      max = Math.max(max, s.x);
    }
    expect(s.x).toBe(100); // snapped to the target once settled
    expect(s.v).toBe(0);
    // Discrete integration adds a hair of energy (<< 1%); the motion still
    // reads as critically damped — no visible bounce.
    expect(max).toBeLessThan(100.5);
  });

  it('overshoots and oscillates when under-damped', () => {
    const s = new Spring(0, { response: 0.35, dampingRatio: 0.4 });
    s.set(100);
    let max = -Infinity;
    let crossings = 0;
    let prev = s.x;
    for (let i = 0; i < 2000; i += 1) {
      s.step(1 / 60);
      max = Math.max(max, s.x);
      if (prev <= 100 && s.x > 100) crossings += 1;
      prev = s.x;
    }
    expect(max).toBeGreaterThan(100); // bounce past the target
    expect(crossings).toBeGreaterThan(1); // then oscillate around it
    expect(s.x).toBe(100);
  });

  it('is interruptible: re-targeting continues from the live value', () => {
    const s = new Spring(0, { response: 0.35, dampingRatio: 1 });
    s.set(100);
    for (let i = 0; i < 10; i += 1) s.step(1 / 60);
    const midFlight = s.x;
    expect(midFlight).toBeGreaterThan(0); // it was moving toward 100
    s.set(-50); // grab and reverse mid-flight
    expect(s.x).toBe(midFlight); // no jump to the logical target
    for (let i = 0; i < 2000; i += 1) s.step(1 / 60);
    expect(s.x).toBe(-50);
  });

  it('carries gesture velocity through a re-target (no brick wall)', () => {
    const s = new Spring(0, { response: 0.35, dampingRatio: 1 });
    s.set(100);
    s.step(1 / 60);
    s.setVelocity(600); // pointer was moving fast at release
    expect(s.v).toBe(600);
    s.set(-50); // reverse direction mid-flight
    expect(s.v).toBe(600); // re-target preserves velocity — no hard cut
    // Momentum carries the spring past the turn before it reverses; the
    // motion stays continuous (it never snaps to rest at the re-target).
    let turned = false;
    for (let i = 0; i < 240; i += 1) {
      s.step(1 / 60);
      if (s.v < 0) {
        turned = true;
        break;
      }
    }
    expect(turned).toBe(true);
  });

  it('respects a faster response (snappier settle)', () => {
    const snappy = new Spring(0, { response: 0.1, dampingRatio: 1 });
    const slow = new Spring(0, { response: 0.9, dampingRatio: 1 });
    snappy.set(100);
    slow.set(100);
    for (let i = 0; i < 30; i += 1) {
      snappy.step(1 / 60);
      slow.step(1 / 60);
    }
    expect(snappy.x).toBe(100);
    expect(slow.x).toBeLessThan(100);
  });
});

function Probe({ target, opts }) {
  const value = useSpring(target, opts);
  return <div data-testid="value">{Math.round(value * 1000) / 1000}</div>;
}

describe('useSpring', () => {
  it('snaps to the target when reduced motion is requested (no movement)', () => {
    render(<Probe target={42} opts={{ reduce: true, initial: 0 }} />);
    expect(screen.getByTestId('value')).toHaveTextContent('42');
  });

  it('snaps to the target by default in the test environment (deterministic)', () => {
    render(<Probe target={7} opts={{ initial: 0 }} />);
    expect(screen.getByTestId('value')).toHaveTextContent('7');
  });

  it('animates from the initial value toward the target', async () => {
    render(<Probe target={100} opts={{ initial: 0, response: 0.35, reduce: false }} />);
    // First paint is the initial value.
    expect(screen.getByTestId('value')).toHaveTextContent('0');
    // Then it moves and settles exactly on the target (jsdom rAF drives the
    // spring; allow headroom for slow CI frames).
    await waitFor(
      () => {
        expect(screen.getByTestId('value')).toHaveTextContent('100');
      },
      { timeout: 5000, interval: 50 }
    );
  });

  it('re-targets mid-flight without snapping to the new target', async () => {
    const { rerender } = render(
      <Probe target={100} opts={{ response: 0.5, reduce: false }} />
    );
    // Let it start moving, then re-target before it settles.
    await new Promise((resolve) => setTimeout(resolve, 50));
    rerender(<Probe target={-100} opts={{ response: 0.5, reduce: false }} />);
    expect(screen.getByTestId('value')).not.toHaveTextContent('-100');
    await waitFor(
      () => {
        expect(screen.getByTestId('value')).toHaveTextContent('-100');
      },
      { timeout: 5000, interval: 50 }
    );
  });
});

describe('springStyle', () => {
  it('applies a scale transform when motion is allowed', () => {
    const style = springStyle(0.5, { reduce: false });
    expect(style.opacity).toBe(0.5);
    expect(style.transform).toContain('scale(0.5)');
  });

  it('drops the transform under reduced motion, keeping only opacity', () => {
    const style = springStyle(0.5, { reduce: true });
    expect(style).toEqual({ opacity: 0.5 });
    expect(style.transform).toBeUndefined();
  });
});
