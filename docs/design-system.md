# IT Museum design system

An editorial museum identity: restrained CHRIST University blue, warm paper surfaces and selective gold. The public site reads as one connected collection; the review portal is a calm, information-dense work tool built from the same tokens.

Source of truth: `src/styles/tokens.css` (tokens), `src/styles/base.css` (elements, layout primitives), `src/styles/components.css` (components), `src/styles/site.css` and `src/styles/admin.css` (page layouts). Change token values, not component code.

## Tokens

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--blue-600` | `#234a9c` | Brand blue (matches the CHRIST logo); primary buttons |
| `--blue-950` / `--blue-900` | `#0b1a3a` / `#10244d` | Headings, hero, footer, admin top bar |
| `--blue-50` / `--blue-100` | | Hover and selected backgrounds, info alerts |
| `--gold-500` | `#c9a24b` | Decorative only: rules, active-nav underline, accents on dark |
| `--gold-700` | `#75591c` | Gold *text* on light surfaces (eyebrows, roles), AA contrast |
| `--paper` | `#faf8f4` | Page background |
| `--surface` / `--surface-sunken` | `#fff` / `#f2eee6` | Cards / sunken panels and alternating sections |
| `--ink` / `--ink-muted` / `--ink-subtle` | 16.8 : 1 / 8.6 : 1 / 5.3 : 1 on paper | Body / secondary / captions |
| `--success-*`, `--warning-*`, `--danger-*`, `--info-*` | fg + bg pairs | Alerts, badges, decision states |

Every text/background pair used meets WCAG 2.2 AA (4.5 : 1 for body text). Never put gold-500 text on a light background — use gold-700.

### Typography

- Headings: **Source Serif 4** (`--font-serif`), weight 600, `text-wrap: balance`.
- UI and body: **Inter** (`--font-sans`), 16px base, line-height 1.65.
- Scale: `--text-xs` 12 · `sm` 14 · `base` 16 · `md` 18 · `lg` 20 · `xl` 24 · `2xl` 30 · `3xl` fluid 32–42 · `4xl` fluid 38–60.
- Eyebrows (`.eyebrow`): 12px, uppercase, 0.12em tracking, gold-700.

### Spacing, shape, depth

- Spacing on a 4px base: `--space-1` 4px … `--space-9` 96px. Sections use `.section` (fluid 48–96px block padding).
- Container: 1200px (`--container`), narrow reading column 736px (`--container-narrow`), fluid gutter 16–40px.
- Radii: 4 / 8 / 14px and pill. Shadows `--shadow-sm|md|lg`, subtle and blue-tinted.

### Breakpoints

| Name | Width | Typical change |
| --- | --- | --- |
| sm | 40rem (640px) | Two-column form grids |
| md | 48rem (768px) | Archive controls in one row, footer columns, inline PDF preview on by default |
| lg | 64rem (1024px) | Desktop navigation (below this, the menu button), two-column page layouts, admin sidebar |
| xl | 80rem (1280px) | Max container width reached |

### Motion

`--dur-fast` 120ms, `--dur` 200ms, `--ease`. Under `prefers-reduced-motion: reduce`, durations become 0, skeleton shimmer stops and smooth scrolling is off. There is no autoplaying carousel or marquee; nothing animates in a way that blocks reading.

## Components

| Component | Class / file | Notes |
| --- | --- | --- |
| Button | `.btn` + `--primary`, `--gold`, `--ghost`, `--danger`, `--on-dark`, `--sm`, `--lg`, `--block` | 44px minimum target. Use `<a>` for navigation and `<button>` for actions, never an `<a>` with only a click handler. |
| Link | default `a`, `.arrow-link`, `.link-button` | `.link-button` is a button styled as a link (for in-text actions). |
| Card | `.card`, `--flat`, `--sunken` | |
| Archive card | `ArchiveCard.tsx` | The title link covers the whole card; one tab stop per card. |
| Badge | `.badge` + `--blue|gold|success|warning|danger`, `--plain` | Status badges: `admin/StatusBadge.tsx`. |
| Tag | `.tag` (link or toggle button with `aria-pressed`) | |
| Alert | `Alert.tsx` (`info|success|warning|danger`) | Pass `role="alert"` only for errors that appear in response to an action. |
| Form field | `Field.tsx` (`TextField`, `TextArea`, `SelectField`, `FieldShell`) | Label, hint and error wired through `aria-describedby` and `aria-invalid`. Required fields show `*`, optional ones show "(optional)". |
| File field | `submission/FileField.tsx` | Keeps the chosen file in parent state, so it survives failed submits. |
| Error summary | `submission/ErrorSummary.tsx` | Receives focus; each item links to and focuses its field. |
| Table | `.table-wrap > .table` | Sticky header; scrolls horizontally inside its wrapper on phones. |
| Dialog | `Dialog.tsx` | Native `<dialog>`: focus trap, Escape, inert background. |
| Empty / error state | `EmptyState.tsx`, `ErrorState.tsx` | Error state includes a retry button. |
| Skeleton | `Skeleton.tsx`, `CardSkeletons` | `role="status"` with hidden "Loading…" text. |
| Steps | `.steps` | Wizard progress (`aria-current="step"`); on phones only the current step's label shows. |
| Timeline | `.timeline` | Audit log; `data-kind` colours the marker. |
| Document viewer | `archive/DocumentViewer.tsx` | Inline PDF preview with Open and Download links that always work; text fallback. |
| Toast | `admin/toast.tsx` | Polite live region for action results in the portal. |

## Accessibility defaults

- A skip link on every page, and `<main id="main">` receives focus on route change.
- Landmarks: `header`, `nav` (labelled "Main", "Footer" and "Review portal"), `main`, `footer`.
- Visible focus: a 3px `--color-focus` outline on every focusable element.
- Mobile menu: a real `<button>` with `aria-expanded` and `aria-controls`. Escape closes it and returns focus. It closes after navigating.
- Every page sets a unique `<title>` and meta description (`usePageMeta`).
- Images carry accurate alt text. The generated hero images are captioned "Illustration" so they aren't mistaken for photographs of real exhibits.
- Third-party embeds (Google Maps, PDF preview) are opt-in or have link fallbacks.
- Automated check: `src/__tests__/navigation.test.tsx` runs axe-core on the shell with the mobile menu open.
