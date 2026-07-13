# Amplior CRM — Design System

Extracted from Figma "New UI" web frames (exported 2026-06-13).
Key reference frames: 021 (Login), 012 (Lead Detail), 003 (Approved State), 005/008 (Leads table), 010 (Dashboard table).

---

## 1. Color Palette

### Brand / Primary
| Token | Hex | Usage |
|---|---|---|
| `brand-blue` | `#1A7EE8` | Primary buttons, active nav icon, links, progress bar fill |
| `brand-blue-dark` | `#1568C8` | Button hover state |
| `brand-blue-light` | `#EBF4FD` | Active nav item background tint |

### Neutrals / Grays
| Token | Hex | Usage |
|---|---|---|
| `gray-50` | `#F9FAFB` | Page background, table header background |
| `gray-100` | `#F3F4F6` | Subtle backgrounds, hover rows |
| `gray-200` | `#E5E7EB` | Borders (cards, inputs, table lines, sidebar border) |
| `gray-300` | `#D1D5DB` | Input borders (rest state) |
| `gray-400` | `#9CA3AF` | Placeholder text, muted icons |
| `gray-500` | `#6B7280` | Table header text, secondary labels |
| `gray-700` | `#374151` | Body text, card labels |
| `gray-900` | `#111827` | Headings, primary content text |

### Surface
| Token | Hex | Usage |
|---|---|---|
| `surface` | `#FFFFFF` | Cards, sidebar, top bar, table rows |
| `page-bg` | `#F8F9FA` | Page-level background |

### Status / Badge Colors
| Stage / Status | Text | Background | Notes |
|---|---|---|---|
| Cold | `#6B7280` | `#F3F4F6` | Gray neutral |
| Hot Prospect | `#DC2626` | `#FEF2F2` | Red |
| Won / Closed Won | `#FFFFFF` | `#16A34A` | Green filled button (not a badge) |
| Engaged | `#7C3AED` | `#F5F3FF` | Purple |
| Negotiation | `#D97706` | `#FFFBEB` | Amber |
| Contacted | `#1D4ED8` | `#EFF6FF` | Blue |
| Meeting | `#0891B2` | `#ECFEFF` | Cyan |
| Request Approval | `#EA580C` | `#FFF7ED` | Orange |
| Client badge | `#FFFFFF` | `#16A34A` | Green pill (top-right of lead card) |
| Lead badge | `#FFFFFF` | `#EF4444` | Red pill (top-right of lead card) |

---

## 2. Typography

### Font Family
- **Primary**: `Inter` (Google Fonts / system)
- Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Feature settings: `'cv02', 'cv03', 'cv04', 'cv11'`
- Antialiasing: `-webkit-font-smoothing: antialiased`

### Type Scale
| Role | Size | Weight | Color |
|---|---|---|---|
| Page heading (breadcrumb) | 14px | 600 | `#111827` |
| Section heading (e.g. "Lead Information") | 13px | 600 | `#111827` |
| Table header | 12px | 500 | `#6B7280` |
| Body / cell text | 13px | 400 | `#374151` |
| Secondary / sub text | 12px | 400 | `#6B7280` |
| Label (form label) | 12px | 500 | `#6B7280` |
| Caption / tiny | 11px | 400 | `#9CA3AF` |
| Primary button | 13–14px | 500 | `#FFFFFF` |
| Nav item | 13px | 400 (500 active) | `#374151` (active: `#1A7EE8`) |
| Logo wordmark | 16px | 700 | `#111827` |

---

## 3. Border Radius Scale
| Use | Radius |
|---|---|
| Cards | `8px` |
| Inputs | `6px` |
| Buttons (primary) | `6px` |
| Badges / pills | `4px` |
| Avatars | `50%` (circular) |
| Nav active item | `6px` |
| Modal | `12px` |

---

## 4. Spacing Rhythm
- Base unit: `4px`
- Card padding: `16–20px`
- Table cell: `px-4` (16px), `py-2.5` (10px) for header, `height: 44px` for rows
- Sidebar width: `240px`
- Top bar height: `56px`
- Gap between nav items: `2–4px`

---

## 5. Component Specs

### Sidebar
- Width: `240px`, pure white `#FFFFFF` background
- Right border: `1px solid #E5E7EB`
- Logo area: top, ~60px tall, logo + "AltLeads" text + icon
- Nav items: `height: 36px`, `px-3`, `border-radius: 6px`
- Active state: bg `#EBF4FD`, text `#1A7EE8`, left-side blue filled icon circle
- Inactive: text `#6B7280`, icon same color, hover bg `#F3F4F6`
- Footer items (Settings, Log Out): at bottom, same style
- No border-bottom on logo area in most frames (clean separation)

### Top Bar
- Height: `56px`, white background, `border-bottom: 1px solid #E5E7EB`
- Left: breadcrumb path (e.g. "Leads / Leads Overview"), font-size 14px, gray-500
- Right: bell icon, then user avatar (circular photo or initials) + name + "Agent" role label below
- No logout button visible in the top bar — it's a sidebar item

### Cards
- `background: #FFFFFF`, `border: 1px solid #E5E7EB`, `border-radius: 8px`
- Padding: `16–20px` inside
- No box-shadow in most frames (flat design)

### Primary Button
- Background: `#1A7EE8`
- Hover: `#1568C8`
- Text: white, 13–14px, weight 500
- Padding: `10px 20px`, `border-radius: 6px`
- Full-width in forms (login submit)
- "Approved" / "Won" = green `#16A34A` variant

### Secondary / Ghost Button
- Border: `1px solid #D1D5DB`
- Background: white
- Text: `#374151`
- Hover: `border-color: #1A7EE8`, `color: #1A7EE8`

### Inputs
- Border: `1px solid #D1D5DB`, `border-radius: 6px`
- Background: white
- Focus: `border-color: #1A7EE8`, light blue ring
- Padding: `8px 12px`, font-size 13px
- Placeholder: `#9CA3AF`

### Table
- Header row: white background (NOT gray), `border-bottom: 1px solid #E5E7EB`
- Header text: `#6B7280`, 12px, weight 500
- Data rows: white, `border-bottom: 1px solid #F3F4F6`, `height: 44px`
- Hover row: `#F9FAFB`
- Company name: bold, with colored avatar/logo to the left
- Lead Stage badges inline in "Lead Stage" column

### Badges / Stage Pills
- `border-radius: 4px`, `padding: 2px 8px`, font-size 11–12px, weight 500
- No border ring — just `background` + `color`
- Client/Lead type badges: solid color (green/red), white text, top-right corner of cards

### Avatar
- Circular, 32–36px
- Initials style: colored background matching brand context
- For companies: square with rounded corners (32px), logo image or initials block

---

## 6. How the Current App Differs

| Area | Figma | Current App |
|---|---|---|
| Primary color | Blue `#1A7EE8` | Indigo `#4F46E5` / `#6366F1` |
| Page background | `#F8F9FA` (near-white gray) | `#FAFAFA` (similar but slightly different) |
| Sidebar logo | "AltLeads" + blue bear icon | "A" in indigo box + "Amplior CRM" text |
| Table header bg | White | `#FAFAFA` (slight gray tint) |
| Table row height | ~44px | 40px |
| Top bar height | 56px | 52px |
| Active nav bg | `#EBF4FD` (blue tint) | `#EEF2FF` (indigo tint) |
| Active nav text | `#1A7EE8` | `#4F46E5` |
| Button border-radius | 6px | `rounded-lg` = 8px |
| Card border-radius | 8px | `rounded-lg` = 8px (matches) |
| Badge style | Flat bg only, no ring | Inset ring shadow |
| Top bar user section | Photo avatar + name + role stacked | Initials circle + email + role |
| Breadcrumb in top bar | Present ("Leads / Leads Overview") | Only page title |
| Input border-radius | 6px | `rounded-lg` = 8px |
| Nav item height | 36px | 32px |

---

## 6b. New Shared UI Patterns (added 2026-06-16–17)

These components were added after the original design system doc and should be reused wherever the same pattern applies.

### SearchSelect combobox (`src/components/ui/SearchSelect.tsx`)
A dependency-free type-ahead combobox for picking an existing record from a large list (e.g. "Link existing contact", "Pick existing company"). Pattern:
- Renders as a text input with a dropdown list below.
- Filters options client-side as the user types (case-insensitive substring match on the display label).
- Selected value is an ID (not the display string); display string shown in the input.
- "Clear" button (×) resets to null.
- No extra npm dependencies — uses plain React state + a ref-based click-outside handler.
- Styling: matches standard Input spec (border `#D1D5DB`, radius 6px, focus ring `#1A7EE8`); dropdown is a white card (border `#E5E7EB`, radius 6px, shadow `sm`); hover row bg `#F3F4F6`; selected row bg `#EBF4FD` text `#1A7EE8`.
- Use this for any "pick from existing records" UX. Do not invent a new pattern.

### Status badges — per-project
Contact status, call disposition, account status, feasibility, decision-power all use the same badge style as the existing stage pills:
- `border-radius: 4px`, `padding: 2px 8px`, font 11–12px weight 500, flat bg + colored text (no border ring).
- Color mapping is driven by the `dropdown_option` table (admin can change labels); default color assignments should follow the existing stage badge palette (green=positive, red=negative/dropped, amber=pending, blue=active, gray=unknown/not set).
- Badge renders "—" in gray-400 when no status is set (not blank — always show something).

### Saved-view control strip
Used on list screens that support saved column views (Contacts, planned for Leads, Meetings, Wishlist):
- A compact horizontal strip below the filter bar: `[ View: Default ▼ ]  [ + Save view ]  [ Reset ]`.
- Active view name shown in the selector; clicking opens a dropdown of saved views.
- "Save view" opens a small modal: name input + Save button.
- "Reset" switches back to Default without deleting saved views.
- Styling: secondary/ghost button style; strip has no card border — sits flush with the filter bar.

### Unread notification bell badge
- Bell icon in the Sidebar footer area.
- Red dot badge (8×8px, `#EF4444`, absolute positioned top-right of the bell icon) when unread count > 0.
- If count ≥ 10: shows "9+" pill instead of a dot (same style as the Approvals pending count badge).
- Disappears immediately on "Mark all read" without waiting for the 60s poll.

---

## 7. Per-Screen Layout Differences (to address in later dedicated passes)

These are structural/layout items NOT touched in the global theme pass:

1. **Login**: Figma shows left panel (form) + right panel (photo collage). Current = centered card only.
2. **Lead Detail**: Figma has 3-tab header (Activity / Lead Report / Meeting), a progress stepper (Pre-Sales → Meeting → Closing), and two-column layout with right info panel. Current app structure approximates this but details differ.
3. **Leads Table**: Figma shows company logo avatars in the first column left of company name — current app has no avatars.
4. **Top Bar**: Figma has a breadcrumb path on the left (not just a title), and the right side shows full user name + "Agent" role below — no logout button in topbar.
5. **Dashboard**: Figma frames (005–011) show a calendar/meeting schedule view, not the stat cards currently implemented.
6. **Sidebar**: Figma sidebar is narrower in some frames with only icon + label; the logo/brand treatment uses the actual "AltLeads" mark with a blue bear icon SVG.
7. **Lead Report print view** (017, 018): Separate A4-style report page not implemented yet.
