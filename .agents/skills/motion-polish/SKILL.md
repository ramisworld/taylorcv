---
name: motion-polish
description: Use for animations, transitions, loading states, progress states, microinteractions, hover/focus behavior, product demos, and making TaylorCV feel smooth and premium.
---

# Motion Polish

Use this skill when UI needs animation, loading polish, transitions, progress, hover states, or product-demo motion.

## Goal

Motion should make TaylorCV feel premium, fast, and intelligent.

Motion must clarify the interface. It should not distract from the task.

## Motion principles

Good motion:

- Shows cause and effect
- Guides attention
- Makes progress feel alive
- Makes state changes feel smooth
- Helps the user understand what changed
- Feels calm and intentional

Bad motion:

- Random floating cards
- Constant pulsing
- Excessive shimmer
- Over-bouncy transitions
- Slow transitions that block progress
- Decorative animation with no product meaning

## Default motion style

Use:

- Subtle fade/slide entrance
- Small scale changes for hover
- Soft spring only when appropriate
- Smooth progress transitions
- Staggered reveal for lists/chips
- Reduced-motion support

Avoid:

- Huge movement
- Fast flashing
- Endless loops
- Overdone glow
- Too many elements animating at once

## TaylorCV-specific motion

Good places for motion:

- Job requirements appearing after parsing
- Match score improving
- Evidence chips connecting to role requirements
- Gap question progress
- CV preview being assembled
- CTA hover/focus states
- Stepper transitions
- Loading states with real progress labels

Avoid:

- Fake progress that feels random
- Loading states that overpromise
- Animating the CV so much that it becomes hard to read

## Implementation checklist

For every motion task:

1. Identify the state change.
2. Decide what the user needs to notice.
3. Add the smallest motion that makes the state clearer.
4. Add reduced-motion fallback.
5. Test hover/focus/tap behavior.
6. Inspect the actual rendered motion.
7. Remove motion that feels cheap or distracting.

## Timing guidance

Use short timings:

- Microinteractions: fast
- Page/card entrance: moderate
- Loading/progress: smooth but not slow
- Repeated ambient motion: avoid unless it is very subtle

## Final review

Before finishing, ask:

- Does this motion make the product clearer?
- Does it feel premium?
- Does it slow the user down?
- Would it annoy someone using the app repeatedly?
