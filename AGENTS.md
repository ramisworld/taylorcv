# TaylorCV Codex Instructions

## Product identity

TaylorCV is an AI career agent for the New Zealand job market. It turns a job description into a tailored, polished, one-page CV by extracting role requirements, matching them to the candidate’s background, asking smart gap questions, and generating a stronger CV.

TaylorCV must feel like a premium, trustworthy, enterprise-grade SaaS product. It must not feel like a generic AI wrapper, template generator, or low-effort resume tool.

## Core UI standard

Every UI change must aim for:

- Clear hierarchy
- Premium spacing
- Calm motion
- Strong conversion intent
- Accessible contrast
- Responsive desktop and mobile behavior
- Polished empty, loading, error, hover, focus, and disabled states
- Real product clarity over decorative noise

Avoid:

- Generic AI SaaS visuals
- Overused “AI sparkle” visuals
- Repetitive Lucide icon choices
- Excessive gradients
- Emoji unless the brand already uses them
- Random glassmorphism
- Left-border accent cards
- Filler sections
- Decorative icons that do not explain the product
- Large unverified UI rewrites

## Design workflow for UI tasks

For any meaningful UI task, follow this loop:

1. Understand the target screen and user goal.
2. Inspect existing components, routes, styles, tokens, and nearby UI before changing code.
3. State the visual system you are applying.
4. Implement the smallest high-quality change that satisfies the request.
5. Run the app.
6. Inspect the rendered UI in a browser.
7. Critique the actual result, not just the code.
8. Fix spacing, alignment, hierarchy, contrast, awkward copy, responsiveness, and motion.
9. Run lint, typecheck, or build where appropriate.
10. Summarize exactly what changed and what remains.

Do not stop after the first implementation if the screen still looks average.

## TaylorCV visual direction

Default direction:

- Premium dark navy / blue / teal base for marketing surfaces
- Clean white CV previews
- Blue accents used sparingly for active states, section headers, progress, and dividers
- Dark body text on document-like surfaces
- Soft shadows, subtle glow, precise borders
- Large confident headings
- Calm, modern SaaS density
- No fake enterprise trust signals

CV layout direction:

- Always prioritize one-page clarity
- Use accent color for section headers, dividers, selected labels, and links
- Keep main body text black or dark gray
- Preserve ATS-safe structure
- Keep LinkedIn/contact lines tidy and non-wrapping where possible

## Product copy rules

Copy must be direct, believable, and conversion-focused.

Prefer:

- “Built for New Zealand job seekers”
- “One-page tailored CV”
- “ATS-safe formatting”
- “Match your CV to the role”
- “Find missing evidence before you apply”
- “Designed for students, graduates, tradespeople, and professionals”

Avoid:

- “Revolutionary”
- “Guaranteed interviews”
- “10x your career”
- Fake interview uplift stats
- Fake company trust logos
- Vague AI claims

## Codebase rules

Before editing:

- Find the actual component and route.
- Prefer modifying existing components over creating parallel duplicates.
- Preserve existing backend behavior unless explicitly asked.
- Do not touch auth, billing, database schema, environment variables, or API contracts unless the task asks for it.
- Avoid adding new production dependencies without explaining why.
- Prefer existing design tokens, utility classes, and component patterns.
- Keep files focused and maintainable.

## Interaction and motion rules

Every interactive surface should have:

- Hover state
- Focus-visible state
- Disabled state where relevant
- Loading state where relevant
- Smooth but restrained transitions

Use motion to clarify state, progress, hierarchy, or flow. Do not add motion only for decoration.

Respect reduced-motion preferences.

## Visual QA rules

For serious UI changes:

- Run the page.
- Inspect the rendered screen.
- Compare against the brief.
- Check desktop and mobile.
- Fix obvious visual issues before final response.

Look specifically for:

- Uneven spacing
- Weak hierarchy
- Overcrowding
- Misaligned cards
- Low contrast
- Generic icons
- Unclear CTA
- Text wrapping issues
- Fake-looking proof
- Motion that feels cheap
- UI that works in code but looks wrong in browser

## When to use skills

Use these skills when relevant:

- `enterprise-ui-director` for any premium UI, layout, design-system, or visual polish task.
- `landing-page-conversion-designer` for landing pages, pricing, hero sections, CTAs, proof, and marketing sections.
- `motion-polish` for animation, transitions, loading states, progress states, and microinteractions.
- `visual-qa` before finishing any important UI task.
- `asset-generation-director` when an image, icon set, product visual, or marketing visual is needed.

## Final response style

Be concise.
Mention files changed.
Mention commands run.
Mention any remaining caveats.
Do not over-explain.
