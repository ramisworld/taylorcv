---
name: visual-qa
description: Use before finishing any important UI task. Checks the rendered TaylorCV interface for spacing, hierarchy, responsiveness, interaction states, visual polish, and generic AI-slop issues.
---

# Visual QA

Use this skill before finishing meaningful UI work.

## Goal

Do not trust the code alone. Verify the rendered screen.

## Required loop

1. Run the app.
2. Open the changed page.
3. Inspect the rendered UI.
4. Compare against the user’s request.
5. Identify visual issues.
6. Fix the issues.
7. Recheck.
8. Run lint/build/typecheck where appropriate.

## What to inspect

Layout:

- Is everything aligned?
- Is spacing consistent?
- Is the layout balanced?
- Does the screen fit the viewport?
- Is desktop responsive?
- Is mobile responsive?

Hierarchy:

- Is the main action obvious?
- Is the headline dominant enough?
- Are secondary elements quieter?
- Is the page easy to scan?

Typography:

- Are sizes consistent?
- Is line-height readable?
- Are labels too small?
- Is text wrapping cleanly?
- Is body text high contrast?

Visual polish:

- Are shadows subtle?
- Are borders crisp?
- Are radii consistent?
- Are gradients controlled?
- Does the UI feel premium?

Interaction:

- Hover states
- Focus-visible states
- Disabled states
- Loading states
- Empty states
- Error states

Trust:

- No fake proof
- No fake logos
- No fake testimonials
- No unrealistic statistics
- No misleading claims

TaylorCV specificity:

- Does this feel like TaylorCV?
- Does it communicate job requirements, matching, evidence, gap questions, or tailored CV value?
- Could this UI belong to any generic AI SaaS? If yes, make it more specific.

## Common problems to fix

- CTA not visually dominant
- Too many cards
- Weak spacing
- Overcrowded hero
- CV preview too small
- Score visual too gimmicky
- Icons too generic
- Dark UI too low contrast
- Layout looks good in code but awkward in browser
- Mobile version feels like an afterthought

## Final response

Mention:

- What was checked
- What was fixed
- Which commands ran
- Any remaining caveats
