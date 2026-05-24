---
name: asset-generation-director
description: Use when TaylorCV needs generated images, custom icons, hero visuals, product illustrations, product-demo frames, video concepts, or marketing assets. Focuses on controlled asset briefs, not random generation.
---

# Asset Generation Director

Use this skill when a UI or marketing task needs an image, icon, illustration, product visual, video concept, or generated asset.

## Goal

Create controlled, useful TaylorCV assets that support the product. Do not generate random decorative visuals.

## Asset principles

Assets must:

- Explain the product
- Support conversion
- Match TaylorCV’s premium visual direction
- Feel trustworthy
- Avoid generic AI imagery
- Avoid fake company proof
- Avoid fake people/testimonials unless explicitly approved

## Good TaylorCV asset types

Use generated or custom assets for:

- Hero product visuals
- CV transformation graphics
- Requirement extraction visuals
- Evidence matching visuals
- Gap question flow visuals
- Match score improvement graphics
- Empty-state illustrations
- Custom icon sets
- Product demo storyboards
- Social/marketing images

Avoid generated assets for:

- Tiny UI icons that should be SVG
- Fake user photos
- Fake logos
- Fake office/team imagery
- Decorative blobs that add no meaning
- Inconsistent icon sets

## Required workflow

Before generating or requesting an asset:

1. Define where the asset will be used.
2. Define the user message it supports.
3. Define the required dimensions and format.
4. Define the visual style.
5. Define what must not appear.
6. Create a clear asset brief.
7. Save generated assets into a predictable folder.
8. Import assets normally into the app.
9. Inspect the rendered page with the asset in place.

## Default asset folder

Use:

`public/generated/`

Suggested subfolders:

- `public/generated/hero/`
- `public/generated/icons/`
- `public/generated/product-visuals/`
- `public/generated/social/`
- `public/generated/video-frames/`

## Asset brief template

Use this structure:

Asset name:
Use location:
Purpose:
Dimensions:
Format:
Style:
Content:
Must include:
Must avoid:
Brand colors:
Interaction with surrounding UI:
Fallback if generation fails:

## Icon rules

For icons:

- Prefer consistent SVG icons for product UI.
- Use custom generated icons only if the concept is hard to represent with existing icons.
- Keep stroke weight, corner radius, and perspective consistent.
- Do not mix multiple icon styles on one screen.

## Video rules

For app UI:

- Prefer real UI motion using CSS/Framer Motion over generated video.
- Use video generation mainly for landing-page hero loops, product explainers, and marketing clips.
- Never let video slow down the core app workflow.
- Always provide static fallback.
