# Modern Web Platform Research (February 2026)

Compiled for course content authoring. All syntax is verified against official documentation.

---

## 1. Tailwind CSS 4.x

### 1.1 Architecture Overhaul

Tailwind CSS v4.0 is a ground-up rewrite. The JavaScript engine is replaced by **Oxide**, a Rust-based compiler. Performance gains are substantial:

| Metric                              | v3.4   | v4.0   | Speedup   |
|-------------------------------------|--------|--------|-----------|
| Full build                          | 378ms  | 100ms  | 3.78x     |
| Incremental rebuild (new CSS)       | 44ms   | 5ms    | 8.8x      |
| Incremental rebuild (no new CSS)    | 35ms   | 192us  | 182x      |

**Minimum browser targets:** Safari 16.4+, Chrome 111+, Firefox 128+.

### 1.2 Installation (v4.0)

Three options:

```bash
# PostCSS plugin
bun add tailwindcss @tailwindcss/postcss

# Vite plugin (recommended for Vite projects)
bun add tailwindcss @tailwindcss/vite

# CLI
bun add tailwindcss @tailwindcss/cli
```

**Vite config:**
```ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

**CSS entry point (replaces all `@tailwind` directives):**
```css
@import "tailwindcss";
```

No `tailwind.config.js` needed. No `content` array. Tailwind auto-detects source files, respects `.gitignore`, and ignores binary file types.

### 1.3 CSS-First Configuration: `@theme`

The `@theme` directive replaces `tailwind.config.js`. Theme variables are CSS custom properties that instruct Tailwind to generate utility classes.

```css
@import "tailwindcss";

@theme {
  --font-display: "Satoshi", "sans-serif";
  --breakpoint-3xl: 1920px;
  --color-avocado-100: oklch(0.99 0 0);
  --color-avocado-200: oklch(0.98 0.04 113.22);
  --color-avocado-500: oklch(0.84 0.18 117.33);
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
```

Defining `--color-mint-500: oklch(0.72 0.11 178)` automatically generates `bg-mint-500`, `text-mint-500`, `border-mint-500`, `fill-mint-500`, etc.

**Key namespaces and what they generate:**

| Namespace           | Generates                                          |
|---------------------|----------------------------------------------------|
| `--color-*`         | Color utilities: `bg-*`, `text-*`, `border-*`      |
| `--font-*`          | Font family: `font-sans`, `font-display`            |
| `--text-*`          | Font size: `text-xl`, `text-2xl`                    |
| `--font-weight-*`   | Font weight: `font-bold`, `font-semibold`           |
| `--tracking-*`      | Letter spacing: `tracking-wide`                     |
| `--leading-*`       | Line height: `leading-tight`                        |
| `--breakpoint-*`    | Responsive variants: `sm:`, `md:`, `3xl:`           |
| `--container-*`     | Container query variants: `@sm:`, `@md:`            |
| `--spacing`         | All spacing utilities: `px-4`, `mt-8`, `gap-2`      |
| `--radius-*`        | Border radius: `rounded-sm`, `rounded-xl`           |
| `--shadow-*`        | Box shadow: `shadow-md`, `shadow-xl`                |
| `--blur-*`          | Blur filters: `blur-md`, `blur-xl`                  |
| `--ease-*`          | Timing functions: `ease-out`, `ease-fluid`          |
| `--animate-*`       | Animations: `animate-spin`, `animate-bounce`        |
| `--aspect-*`        | Aspect ratio: `aspect-video`                        |
| `--perspective-*`   | Perspective: `perspective-near`                     |

**Override a namespace entirely (reset + define):**
```css
@theme {
  --color-*: initial;         /* wipe all default colors */
  --color-white: #fff;
  --color-midnight: #121063;
  --color-tahiti: #3ab7bf;
}
```

**Start from scratch:**
```css
@theme {
  --*: initial;               /* wipe everything */
  --spacing: 4px;
  --font-body: Inter, sans-serif;
  --color-lagoon: oklch(0.72 0.11 221.19);
}
```

**Referencing other variables (use `inline`):**
```css
@theme inline {
  --font-sans: var(--font-inter);
}
```

**Animation keyframes inside `@theme`:**
```css
@theme {
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
}
```

**Shared theme file for monorepos:**
```css
/* packages/brand/theme.css */
@theme {
  --*: initial;
  --spacing: 4px;
  --color-primary: oklch(0.72 0.11 221.19);
}

/* packages/app/styles.css */
@import "tailwindcss";
@import "../brand/theme.css";
```

### 1.4 Source Detection

```css
@import "tailwindcss";

/* Include additional source directories */
@source "../node_modules/@my-company/ui-lib";

/* Exclude paths */
@source not "./src/components/legacy";
```

### 1.5 Container Queries (Built-in)

No plugin needed. Container queries are first-class in v4.

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-3 @lg:grid-cols-4">
    <!-- Responds to container width, not viewport -->
  </div>
</div>
```

**Max-width container queries:**
```html
<div class="@container">
  <div class="grid grid-cols-3 @max-md:grid-cols-1">
    <!-- Below md container size: single column -->
  </div>
</div>
```

**Range queries:**
```html
<div class="@container">
  <div class="flex @min-md:@max-xl:hidden">
    <!-- Hidden when container is between md and xl -->
  </div>
</div>
```

**Named containers:**
```html
<div class="@container/sidebar">
  <div class="@sm/sidebar:text-lg">
    <!-- Responds to the named "sidebar" container -->
  </div>
</div>
```

**Arbitrary container values:**
```html
<div class="@[500px]:flex">
  <!-- Flexbox at 500px container width -->
</div>
```

### 1.6 New Utilities in v4.0

**3D Transforms:**
```html
<div class="perspective-distant">
  <article class="rotate-x-51 rotate-z-43 transform-3d">
    <!-- 3D card effect -->
  </article>
</div>
```

Available: `rotate-x-*`, `rotate-y-*`, `rotate-z-*`, `scale-z-*`, `translate-z-*`, `perspective-*`, `perspective-origin-*`, `transform-3d`.

**Gradient APIs:**
```html
<!-- Linear gradient with angle -->
<div class="bg-linear-45 from-indigo-500 via-purple-500 to-pink-500"></div>

<!-- Gradient interpolation -->
<div class="bg-linear-to-r/oklch from-indigo-500 to-teal-400"></div>

<!-- Conic gradient -->
<div class="bg-conic/[in_hsl_longer_hue] from-red-600 to-red-600"></div>

<!-- Radial gradient -->
<div class="bg-radial-[at_25%_25%] from-white to-zinc-900 to-75%"></div>
```

**`@starting-style` for enter/exit transitions (no JS):**
```html
<div popover id="my-popover"
     class="transition-discrete starting:open:opacity-0 open:opacity-100">
  <!-- Animates opacity on open -->
</div>
```

**`not-*` variant:**
```html
<div class="not-hover:opacity-75">Dims when not hovered</div>
<div class="not-supports-hanging-punctuation:px-4">Fallback padding</div>
```

**Field sizing (auto-resize textarea):**
```html
<textarea class="field-sizing-content"></textarea>
```

**Inert variant:**
```html
<div class="inert:pointer-events-none inert:opacity-50">
  Grayed out when inert
</div>
```

**nth-child variants:**
```html
<div class="nth-3:bg-blue-100 nth-last-2:font-bold">
  Positional styling
</div>
```

**Descendant variant (star):**
```html
<div class="*:text-center *:py-2">
  <!-- All direct children centered with vertical padding -->
</div>
```

**Dynamic data attributes (no config):**
```html
<div data-current class="opacity-75 data-current:opacity-100">
  Active indicator
</div>
```

**Dynamic values (any number works):**
```html
<div class="grid grid-cols-15 mt-17 w-29">
  <!-- 15-column grid, margin-top 17 units, width 29 units -->
</div>
```

### 1.7 Custom Variants and Utilities (v4.0)

```css
/* @custom-variant replaces addVariant() from v3 plugins */
@custom-variant optional (&:optional);
@custom-variant hocus (&:hover, &:focus);
@custom-variant inverted-colors (@media (inverted-colors: inverted));

/* @utility replaces addUtilities() */
@utility tab-4 {
  tab-size: 4;
}
```

### 1.8 Variant Application Order Change

Variants now apply **left-to-right** (matching CSS reading order), not right-to-left as in v3.

### 1.9 Tailwind CSS v4.1 Additions

**Text shadows:**
```html
<p class="text-shadow-2xs">Subtle shadow</p>
<p class="text-shadow-lg">Large shadow</p>
<p class="text-shadow-lg text-shadow-sky-300">Colored shadow</p>
<p class="text-shadow-lg/50">50% opacity shadow</p>
```

Sizes: `text-shadow-2xs`, `text-shadow-xs`, `text-shadow-sm`, `text-shadow-md`, `text-shadow-lg`.

**Masks:**
```html
<!-- Linear gradient masks (single side) -->
<div class="mask-t-from-50% bg-[url(/img/photo.jpg)]"></div>
<div class="mask-r-from-30% bg-[url(/img/photo.jpg)]"></div>
<div class="mask-b-from-20% mask-b-to-80% bg-[url(/img/photo.jpg)]"></div>

<!-- Composable radial + linear -->
<div class="mask-b-from-50% mask-radial-[50%_90%] mask-radial-from-80%"></div>
```

**Colored drop shadows:**
```html
<svg class="fill-cyan-500 drop-shadow-xl drop-shadow-cyan-500/50"></svg>
```

**Pointer device variants:**
```html
<div class="pointer-coarse:p-6 pointer-fine:p-2">
  <!-- Larger touch targets on touchscreens -->
</div>
```

Variants: `pointer-fine`, `pointer-coarse`, `any-pointer-fine`, `any-pointer-coarse`.

**Overflow wrap:**
```html
<p class="wrap-break-word">Break long words</p>
<div class="wrap-anywhere">Allow mid-word breaks in flex</div>
```

**Safe alignment:**
```html
<ul class="flex justify-center-safe gap-2">
  <!-- Won't overflow left; falls back to start when cramped -->
</ul>
```

Also: `items-center-safe`, `self-center-safe`.

**Baseline-last alignment:**
```html
<div class="grid items-baseline-last">
  <!-- Aligns to last line of text baseline -->
</div>
```

**Source inline (safelist):**
```css
@source inline("underline");

/* Brace expansion with ranges */
@source inline("{hover:,}bg-red-{50,{100..900..100},950}");

/* Exclude specific classes */
@source not inline("container");
```

**New variants in v4.1:**

| Variant              | Purpose                                               |
|----------------------|-------------------------------------------------------|
| `details-content`    | Style `<details>` content area                        |
| `inverted-colors`    | Match inverted-colors media query                     |
| `noscript`           | Show content when JS is disabled                      |
| `user-valid`         | Style valid inputs after user interaction              |
| `user-invalid`       | Style invalid inputs after user interaction            |

```html
<details class="details-content:mt-3" open>
  <summary>FAQ</summary>
  <p>Answer content</p>
</details>

<div class="hidden noscript:block">Enable JS to use this app.</div>

<input required class="border user-valid:border-green-500 user-invalid:border-red-500" />
```

---

## 2. Modern CSS Features (2025-2026)

### 2.1 CSS Nesting (Native)

**Browser support:** Chrome 120+, Firefox 117+, Safari 17.2+, Edge 120+. Over 90% global coverage.

**Syntax:**
```css
.card {
  padding: 1rem;
  background: white;

  & h2 {
    font-size: 1.5rem;
    color: var(--color-heading);
  }

  & .button {
    background-color: blue;
  }

  /* & is optional for element selectors in some cases */
  p {
    line-height: 1.6;
  }

  /* Nested media queries */
  @media (min-width: 768px) {
    padding: 2rem;
  }

  /* Nested @supports */
  @supports (container-type: inline-size) {
    container-type: inline-size;
  }

  /* Nested @layer */
  @layer components {
    border: 1px solid var(--border);
  }
}
```

**Key difference from Sass:** You cannot concatenate selectors with `&` in native CSS nesting. `&__title` does not work. Use `& .card__title` or abandon BEM.

**Feature detection:**
```css
@supports selector(&) {
  /* Native nesting is available */
}
```

### 2.2 CSS Cascade Layers (`@layer`)

**Browser support:** Chrome 99+, Firefox 97+, Safari 15.4+. Baseline since March 2022.

**Syntax:**
```css
/* Declare layer order (last wins in cascade) */
@layer reset, base, components, utilities;

/* Add rules to a layer */
@layer reset {
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
}

@layer base {
  body {
    font-family: system-ui, sans-serif;
    line-height: 1.5;
  }
}

@layer components {
  .button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
  }
}

@layer utilities {
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    clip: rect(0, 0, 0, 0);
  }
}

/* Anonymous layer */
@layer {
  .something { color: red; }
}

/* Import into a layer */
@import url("reset.css") layer(reset);
```

**Cascade behavior:** The last declared layer wins. Unlayered styles (outside any `@layer`) always beat layered styles regardless of specificity. A utility in `utilities` beats a component in `components` even with lower specificity.

### 2.3 Container Queries (`@container`)

**Browser support (size queries):** Chrome 105+, Firefox 110+, Safari 16+. Over 95% global coverage.

**Browser support (style queries):** Chrome 111+, Edge 111+. Firefox and Safari still developing.

**Syntax:**
```css
/* Declare a container */
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* Short form */
.sidebar {
  container: sidebar / inline-size;
}

/* Query by container size */
@container sidebar (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}

/* Unnamed container (matches nearest ancestor container) */
@container (min-width: 600px) {
  .widget { flex-direction: row; }
}

/* Style queries (limited browser support) */
@container style(--theme: dark) {
  .card { background: #1a1a1a; }
}
```

**Feature detection:**
```css
@supports (container-type: inline-size) {
  /* Container queries supported */
}
```

### 2.4 `:has()` Selector

**Browser support:** Safari 15.4+, Chrome 105+, Firefox 121+. Baseline Widely Available.

**Syntax:**
```css
/* Parent selector: style a parent based on its children */
.card:has(img) {
  grid-template-rows: auto 1fr;
}

/* Conditional sibling */
h1:has(+ p) {
  margin-bottom: 0;
}

/* Form state */
form:has(:invalid) {
  border-color: red;
}

/* Navigation active state */
nav:has(.active) {
  background: var(--nav-active-bg);
}

/* Combine with :not */
.card:not(:has(img)) {
  padding: 2rem;
}

/* Nested queries */
.page:has(.sidebar:not(:empty)) {
  grid-template-columns: 300px 1fr;
}

/* Quantity queries */
ul:has(li:nth-child(5)) {
  /* List has at least 5 items */
  columns: 2;
}
```

**Feature detection:**
```css
@supports selector(:has(*)) {
  /* :has() supported */
}
```

### 2.5 View Transitions API

**Browser support (same-document):** Chrome 111+, Firefox 144+ (Oct 2025), Safari 18+. Baseline Newly Available.

**Browser support (cross-document):** Chrome 126+. Firefox and Safari still developing.

**Same-document (SPA) usage:**
```js
// Basic transition
document.startViewTransition(() => {
  updateTheDOMSomehow();
});

// With transition types
document.startViewTransition({
  update: () => updateDOM(),
  types: ["slide-forward"],
});
```

**CSS pseudo-elements for customization:**
```css
/* Default fade */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 300ms;
}

/* Named elements for independent transitions */
.hero-image {
  view-transition-name: hero;
}

::view-transition-old(hero) {
  animation: slide-out 200ms ease-in;
}

::view-transition-new(hero) {
  animation: slide-in 200ms ease-out;
}

/* Auto-naming */
.card {
  view-transition-name: match-element;
}

/* Transition classes (group multiple elements) */
.nav-item {
  view-transition-class: nav;
}

::view-transition-group(.nav) {
  animation-duration: 150ms;
}

/* Active view transition selector */
:active-view-transition {
  /* Styles during any active transition */
}
```

**Cross-document (MPA) opt-in:**
```css
@view-transition {
  navigation: auto;
}
```

Both the source and destination pages must include this rule. Both pages must be on the same origin.

### 2.6 CSS Anchor Positioning

**Browser support:** Chrome 125+, Edge 125+, Safari 26+ (late 2025). Firefox support in progress (Interop 2026 focus).

**Core syntax:**
```css
/* Define an anchor */
.trigger-button {
  anchor-name: --tooltip-anchor;
}

/* Position relative to anchor */
.tooltip {
  position: absolute;
  position-anchor: --tooltip-anchor;

  /* Grid-like area placement */
  position-area: top center;

  /* OR explicit anchor() positioning */
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 0;
}

/* With offset */
.tooltip {
  position: absolute;
  position-anchor: --tooltip-anchor;
  top: calc(anchor(bottom) + 8px);
  left: anchor(center);
}

/* Size relative to anchor */
.dropdown {
  min-width: anchor-size(width);
  height: anchor-size(height);
}
```

**Fallback positions:**
```css
.tooltip {
  position: absolute;
  position-anchor: --trigger;
  position-area: top center;

  /* Built-in flips */
  position-try-fallbacks: flip-block, flip-inline;

  /* Custom fallback */
  position-try-fallbacks: --below-right;
  position-try-order: most-block-space;

  /* Auto-hide when no space */
  position-visibility: auto;
}

@position-try --below-right {
  position-area: bottom right;
}
```

### 2.7 CSS Scroll-Driven Animations

**Browser support:** Chrome 115+, Edge 115+, Safari 26+. Firefox in active development (Interop 2026 focus). Polyfill available.

**Two timeline types:**

1. **`scroll()` -- progress based on scroll position:**
```css
.progress-bar {
  animation: grow-width linear;
  animation-timeline: scroll(root block);
}

@keyframes grow-width {
  from { width: 0%; }
  to   { width: 100%; }
}
```

2. **`view()` -- progress based on element visibility:**
```css
.card {
  animation: fade-in linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Named scroll timelines:**
```css
.scroll-container {
  scroll-timeline: --main-scroll block;
}

.animated-element {
  animation: parallax linear;
  animation-timeline: --main-scroll;
}
```

**Named view timelines:**
```css
.observed-element {
  view-timeline: --card-view block;
  view-timeline-inset: 20%;
}

.animated-child {
  animation: reveal linear both;
  animation-timeline: --card-view;
  animation-range: entry 0% cover 50%;
}
```

**Animation range keywords:** `entry`, `exit`, `cover`, `contain`, `entry-crossing`, `exit-crossing`.

**Feature detection:**
```css
@supports (animation-timeline: scroll()) {
  /* Scroll-driven animations supported */
}
```

**JavaScript API:**
```js
const scrollTimeline = new ScrollTimeline({
  source: document.querySelector(".scroller"),
  axis: "block",
});

element.animate(keyframes, { timeline: scrollTimeline });
```

### 2.8 CSS Subgrid

**Browser support:** Chrome 117+, Firefox 71+, Safari 16+, Edge 117+. 97% global coverage. Production-ready.

**Syntax:**
```css
.grid-parent {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
}

.grid-child {
  grid-column: span 2;
  display: grid;
  grid-template-columns: subgrid;  /* Inherit parent columns */
  grid-template-rows: subgrid;     /* Inherit parent rows */
}
```

**Named lines with subgrid:**
```css
.child {
  display: grid;
  grid-template-columns: subgrid [col-start] [col-mid] [col-end];
}
```

**Practical use case -- aligned cards:**
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: subgrid;
  gap: 1.5rem;
}

.card {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid; /* Cards share row tracks with siblings */
}

/* Result: all card titles, bodies, and footers align across the row */
```

**Gap override:** Subgrid inherits parent gap. Override with `gap: 0.5rem` on the child.

### 2.9 `color-mix()`

**Browser support:** Chrome 111+, Firefox 113+, Safari 16.2+. Baseline Widely Available.

**Syntax:**
```css
/* Mix two colors in a color space */
background: color-mix(in oklch, blue, red);           /* 50/50 */
background: color-mix(in oklch, blue 70%, red);        /* 70% blue, 30% red */
background: color-mix(in oklch, blue 25%, red 75%);    /* explicit both */

/* Tint and shade */
--color-primary: oklch(0.6 0.2 250);
--color-primary-light: color-mix(in oklch, var(--color-primary), white 30%);
--color-primary-dark: color-mix(in oklch, var(--color-primary), black 30%);

/* Opacity via transparent */
--color-primary-50: color-mix(in oklch, var(--color-primary), transparent 50%);

/* Different color spaces */
color-mix(in srgb, red, blue)       /* sRGB interpolation */
color-mix(in oklch, red, blue)      /* Perceptually uniform */
color-mix(in oklch longer hue, orange, purple) /* Longer hue arc */
```

**Why OKLCH:** OKLCH avoids the gray-zone problem during interpolation. It produces the most visually pleasing results across the widest range of color pairs.

### 2.10 `light-dark()`

**Browser support:** Chrome 123+, Firefox 120+, Safari 17.5+. Baseline Newly Available (full Widely Available expected Nov 2026).

**Syntax:**
```css
/* Requires color-scheme declaration */
:root {
  color-scheme: light dark;
}

body {
  background: light-dark(#ffffff, #1a1a1a);
  color: light-dark(#111111, #eeeeee);
}

.card {
  background: light-dark(
    oklch(0.98 0 0),
    oklch(0.2 0 0)
  );
  border-color: light-dark(
    oklch(0.9 0 0),
    oklch(0.3 0 0)
  );
}

/* Works with any color function */
.accent {
  color: light-dark(
    oklch(0.5 0.2 250),
    oklch(0.8 0.15 250)
  );
}
```

No `@media (prefers-color-scheme)` query needed. The function responds to the computed `color-scheme` value.

### 2.11 `@scope`

**Browser support:** Chrome 118+, Safari 17.4+, Firefox 146+ (late 2025). Baseline Newly Available.

**Basic scoping:**
```css
@scope (.card) {
  :scope {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }

  h2 {
    font-size: 1.25rem;
  }

  p {
    color: var(--text-muted);
  }
}
```

**Donut scope (upper + lower bound):**
```css
/* Style the card chrome but NOT nested card content */
@scope (.card) to (.card-content) {
  :scope {
    padding: 1rem;
    background: var(--surface);
  }

  /* These rules apply inside .card but outside .card-content */
  header { font-weight: bold; }
  footer { font-size: 0.875rem; }
}
```

**Multiple exclusions:**
```css
@scope (.layout) to (.sidebar, .modal) {
  p { max-width: 65ch; }
}
```

**Inline scope (in `<style>` element):**
```html
<div class="widget">
  <style>
    @scope {
      :scope { border: 1px solid gray; }
      p { color: navy; }
    }
  </style>
  <p>Scoped to this widget</p>
</div>
```

**Proximity wins:** When two `@scope` rules target the same element, the one with the closer scope root wins, regardless of source order. This is a new cascade tiebreaker.

### 2.12 Popover API

**Browser support:** Chrome 114+, Firefox 125+, Safari 17+. Baseline.

**HTML attribute-driven (no JS):**
```html
<button popovertarget="my-popover">Open Menu</button>
<div id="my-popover" popover>
  <p>Popover content</p>
</div>
```

**Popover types:**
- `popover="auto"` -- light-dismissable (click outside, Escape). Opening one auto popover closes others.
- `popover="manual"` -- must be explicitly closed. Multiple can coexist.
- `popover="hint"` (new) -- for tooltips. Does not close auto popovers when opened.

**Declarative show/hide/toggle:**
```html
<button popovertarget="menu" popovertargetaction="toggle">Toggle</button>
<button popovertarget="menu" popovertargetaction="show">Show</button>
<button popovertarget="menu" popovertargetaction="hide">Hide</button>
```

**CSS `:popover-open` pseudo-class:**
```css
[popover]:popover-open {
  opacity: 1;
  transform: translateY(0);
}
```

**Entry animation with `@starting-style`:**
```css
[popover] {
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 200ms, transform 200ms,
              display 200ms allow-discrete;

  &:popover-open {
    opacity: 1;
    transform: translateY(0);

    @starting-style {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
}
```

**`interestfor` attribute (hover/focus triggers):**
```html
<button interestfor="tooltip-content">Hover me</button>
<div id="tooltip-content" popover="hint">
  Tooltip text
</div>
```

---

## 3. Modern HTML Features

### 3.1 `<dialog>` Element

**Browser support:** All modern browsers. Baseline.

```html
<!-- Non-modal dialog -->
<dialog id="info">
  <p>Information panel</p>
  <button onclick="this.closest('dialog').close()">Close</button>
</dialog>

<!-- Open non-modal -->
<script>
  document.getElementById("info").show();
</script>

<!-- Modal dialog (blocks interaction with rest of page) -->
<script>
  document.getElementById("info").showModal();
</script>
```

**Modal dialog behavior:**
- Creates a backdrop (`::backdrop` pseudo-element)
- Traps focus inside the dialog
- Makes the rest of the page `inert`
- Closes with Escape key
- Returns focus to the element that opened it

**`closedby` attribute (new, Interop 2026):**
```html
<dialog closedby="any">
  <!-- Closes on Escape, click outside, or explicit close -->
</dialog>

<dialog closedby="closerequest">
  <!-- Closes only on Escape or explicit close -->
</dialog>

<dialog closedby="none">
  <!-- Only closes via JavaScript dialog.close() -->
</dialog>
```

**`:open` pseudo-class (new):**
```css
dialog:open {
  animation: slide-in 200ms ease-out;
}
```

**Form method dialog:**
```html
<dialog id="confirm">
  <form method="dialog">
    <p>Are you sure?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>

<script>
  dialog.addEventListener("close", () => {
    console.log(dialog.returnValue); // "cancel" or "confirm"
  });
</script>
```

**Styling:**
```css
dialog {
  border: none;
  border-radius: 0.5rem;
  padding: 2rem;
  max-width: 480px;
}

dialog::backdrop {
  background: oklch(0 0 0 / 0.5);
  backdrop-filter: blur(4px);
}
```

### 3.2 `popover` Attribute

See section 2.12 above. The `popover` attribute is an HTML global attribute that works on any element, not just `<dialog>`.

**Key difference from `<dialog>`:**
- `<dialog>` with `showModal()` makes the rest of the page inert. Popover does not.
- `<dialog>` traps focus. Popover does not trap focus.
- Popover lives in the top layer (like modal dialogs) but is for non-modal UI.
- Use `<dialog>` for confirmation prompts, forms, critical actions. Use `popover` for menus, tooltips, dropdowns.

### 3.3 `inert` Attribute

**Browser support:** All modern browsers since April 2023.

```html
<main inert>
  <!-- Everything in here is non-interactive -->
  <button>This button cannot be clicked or focused</button>
  <a href="/">This link is inert</a>
  <input type="text" /> <!-- Cannot receive focus -->
</main>
```

**Effects of `inert`:**
- Click events are not fired
- Element cannot receive focus
- Excluded from tab order
- Removed from accessibility tree
- Excluded from browser find-in-page
- Text is not selectable

**Common patterns:**
```html
<!-- Modal backdrop: disable background -->
<main id="app" inert>
  <!-- Page content disabled while modal is open -->
</main>
<dialog open>
  <p>Modal content</p>
</dialog>

<!-- Loading state -->
<div inert aria-busy="true">
  <div class="loading-overlay">Loading...</div>
  <form>
    <!-- Form is inert until loading completes -->
  </form>
</div>

<!-- Off-screen navigation -->
<nav id="drawer" inert hidden>
  <!-- Inert until drawer opens -->
</nav>
```

**CSS styling:**
```css
[inert] {
  opacity: 0.5;
  pointer-events: none;
  user-select: none;
}
```

Note: `inert` by itself does NOT apply visual changes. You must add CSS.

### 3.4 `<search>` Element

**Browser support:** All modern browsers since October 2023.

```html
<search>
  <form action="/search" method="get">
    <label for="query">Search</label>
    <input type="search" id="query" name="q" />
    <button type="submit">Search</button>
  </form>
</search>
```

**Purpose:** Semantic container for search functionality. Replaces `<div role="search">` or `<form role="search">`. Improves accessibility by signaling to screen readers that the content is a search form. Improves SEO.

**Section-specific search:**
```html
<!-- Site-wide search in header -->
<header>
  <search>
    <form action="/search">
      <input type="search" name="q" placeholder="Search site..." />
    </form>
  </search>
</header>

<!-- Filter within a component -->
<section>
  <h2>Products</h2>
  <search>
    <label>Filter products</label>
    <input type="search" placeholder="Filter..." />
  </search>
  <ul><!-- product list --></ul>
</section>
```

---

## 4. University Web Development Courses

### 4.1 Harvard University

**CS50's Web Programming with Python and JavaScript**
- URL: https://cs50.harvard.edu/web/
- Free, self-paced via edX
- Instructors: Brian Yu, David J. Malan
- Prerequisite: CS50x or equivalent
- 9 weeks + final project
- Topics:
  - Week 0: HTML, CSS
  - Week 1: Git
  - Week 2: Python
  - Week 3: Django
  - Week 4: SQL, Models, Migrations
  - Week 5: JavaScript
  - Week 6: User Interfaces
  - Week 7: Testing, CI/CD
  - Week 8: Scalability and Security
- Technologies: Python, JavaScript, SQL, Django, React, Bootstrap

**Harvard Extension School -- Front-End Web Development Graduate Certificate**
- URL: https://extension.harvard.edu/academics/programs/front-end-web-development-certificate/
- 4 courses (16 credits), $3,440/course ($13,760 total)
- Completable in 8 months to 3 years
- No formal application required
- Stacks toward Master's in Digital Media Design

**CSCI E-12: Fundamentals of Website Development**
- URL: https://extension.harvard.edu/course-catalog/courses/fundamentals-of-website-development/
- Covers HTML5, CSS, JavaScript, Ajax, HTTP, client/server architecture
- Part of the front-end certificate program

**CSCI E-33a (CS50 Web, for credit)**
- URL: https://cs50.harvard.edu/extension/web/
- Same content as CS50 Web, but for Harvard Extension credit
- Spring 2025 offering confirmed

### 4.2 Stanford University

**CS142: Web Applications**
- URL: https://web.stanford.edu/class/cs142/
- Available via Stanford Online
- Topics: HTML, CSS, JavaScript, ReactJS, Node.js, Express.js, Web Security
- 8 hands-on projects
- Also available via Stanford Online: https://online.stanford.edu/courses/cs142-web-applications

**CS193X: Web Programming Fundamentals**
- URL: https://web.stanford.edu/class/archive/cs/cs193x/cs193x.1176/
- Introductory course covering web programming foundations
- Archived materials available from 2017

**CS193p: Developing Applications for iOS**
- URL: https://cs193p.stanford.edu/
- Spring 2025 edition: SwiftUI, 16 free video lectures
- Not web development per se, but relevant for cross-platform understanding

### 4.3 MIT

**6.170: Software Studio**
- URL: https://ocw.mit.edu/courses/6-170-software-studio-spring-2013/
- Free via MIT OpenCourseWare
- Topics: Web application design, MVC, RESTful APIs, DOM, HTTP, DNS, web frameworks, routing, Rails
- Lecture notes, assignments available
- Emphasis on conceptual design for clarity, simplicity, modularity

**6.171: Software Engineering for Web Applications**
- URL: https://ocw.mit.edu/courses/6-171-software-engineering-for-web-applications-fall-2003/
- Prerequisite: 6.170
- Advanced web application engineering

**MIT Web Programming Crash Course (community)**
- URL: https://functionalcs.github.io/web/
- Community-maintained, functionally-oriented approach

### 4.4 Other Notable Programs

**freeCodeCamp** -- Free, 300+ hour Responsive Web Design certification, JavaScript algorithms, front-end libraries (React), and APIs.

**The Odin Project** -- Free, full-stack curriculum (HTML, CSS, JavaScript, Node.js, React) with project-based learning.

---

## 5. Interop 2026 Focus Areas

These features are being actively worked on for cross-browser interoperability in 2026:

| Feature                        | Status                                            |
|--------------------------------|---------------------------------------------------|
| Anchor positioning             | Chrome/Edge shipped; Safari 26; Firefox in progress |
| Container style queries        | Chrome/Edge shipped; Firefox/Safari in progress    |
| `<dialog>` + Popover enhancements | `closedby`, `:open`, `popover="hint"`          |
| Scroll-driven animations       | Chrome/Edge/Safari shipped; Firefox in progress    |
| View transitions               | Same-doc baseline; cross-doc Chrome only           |
| `attr()` function (typed)      | Returns attribute values as typed CSS values       |
| `contrast-color()`             | Auto-selects accessible contrast color             |
| Custom highlights API          | Style text ranges without DOM modification         |
| `shape()` CSS function         | Create clip-path shapes declaratively              |
| `zoom` CSS property            | Layout-affecting zoom (not `transform: scale`)     |

---

## 6. Quick Reference: Browser Support Matrix (February 2026)

| Feature                     | Chrome  | Firefox | Safari  | Global   |
|-----------------------------|---------|---------|---------|----------|
| CSS Nesting                 | 120+    | 117+    | 17.2+   | ~93%     |
| `@layer`                    | 99+     | 97+     | 15.4+   | ~96%     |
| Container queries (size)    | 105+    | 110+    | 16+     | ~95%     |
| Container queries (style)   | 111+    | --      | --      | ~70%     |
| `:has()`                    | 105+    | 121+    | 15.4+   | ~93%     |
| View transitions (same-doc) | 111+    | 144+    | 18+     | ~85%     |
| View transitions (cross-doc)| 126+    | --      | --      | ~70%     |
| Anchor positioning          | 125+    | --      | 26+     | ~80%     |
| Scroll-driven animations    | 115+    | --      | 26+     | ~80%     |
| Subgrid                     | 117+    | 71+     | 16+     | ~97%     |
| `color-mix()`               | 111+    | 113+    | 16.2+   | ~95%     |
| `light-dark()`              | 123+    | 120+    | 17.5+   | ~88%     |
| `@scope`                    | 118+    | 146+    | 17.4+   | ~85%     |
| Popover API                 | 114+    | 125+    | 17+     | ~90%     |
| `<dialog>`                  | 37+     | 98+     | 15.4+   | ~97%     |
| `inert` attribute           | 102+    | 112+    | 15.5+   | ~95%     |
| `<search>` element          | 118+    | 118+    | 17+     | ~90%     |

---

*Sources consulted: MDN Web Docs, Tailwind CSS official blog, web.dev, Can I Use, Chrome for Developers, CSS-Tricks, Interop 2026, university course catalogs.*
