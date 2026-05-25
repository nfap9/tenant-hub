---
name: tenant-web-style
description: Enforce consistent visual style and component usage patterns for the Tenant Hub Web admin dashboard (apps/tenant-web). Use when modifying or creating React pages, components, global styles, or Ant Design theme configurations in the tenant-web app. Covers color tokens, layout rules, card/shadow standards, button/ input/ table usage, page structure patterns, Tabs usage, and content deduplication guidelines.
---

# Tenant Web Frontend Style Guide

## Color Tokens

| Token         | Value     | Usage                         |
| ------------- | --------- | ----------------------------- |
| Primary       | `#2563EB` | Buttons, links, active states |
| Primary-light | `#3B82F6` | Hover states                  |
| Primary-dark  | `#1D4ED8` | Active/pressed states         |
| Success       | `#22C55E` | Enabled, success              |
| Warning       | `#EA580C` | Pending, warning              |
| Error         | `#DC2626` | Error, delete, disabled       |
| Layout bg     | `#F3F4F6` | Sidebar, outer content area   |
| Content bg    | `#FFFFFF` | Main content, cards           |
| Text          | `#1F2937` | Headings, body text           |
| Text muted    | `#6B7280` | Descriptions, secondary info  |
| Border        | `#E5E7EB` | Dividers, form borders        |
| Border light  | `#F3F4F6` | Card borders                  |

**Prohibited**: Never use gradients anywhere (logo, avatar, overview cards, etc.).

Sync CSS custom properties (`--th-*` in `src/styles/global.scss`) with Ant Design `ConfigProvider` theme tokens in `src/App.tsx`.

## Layout

| Element | Style                                                    |
| ------- | -------------------------------------------------------- |
| Sidebar | Fixed 240px, white, shadow `1px 0 4px rgb(0 0 0 / 0.06)` |
| Header  | Sticky, white, shadow `0 1px 4px rgb(0 0 0 / 0.06)`      |
| Content | White `#FFFFFF`, padding `28px 32px`                     |

## Cards & Shadows

Apply this shadow globally to `.ant-card`:

```css
box-shadow:
  0 2px 8px 0 rgb(0 0 0 / 0.12),
  0 1px 3px -1px rgb(0 0 0 / 0.1);
border: 1px solid var(--th-border-light);
```

**Reduce card nesting**:

- List pages: Render Table directly, do not wrap with `<Card>`
- Settings/config pages: Merge related sections into one Card with dividers
- Ops admin list pages: Show Table directly without outer `<Card>`

## Border Radius & Shadow Scale

| Level   | Radius | Shadow                                                               |
| ------- | ------ | -------------------------------------------------------------------- |
| sm      | `6px`  | `0 1px 2px rgb(0 0 0 / 0.06)`                                        |
| default | `8px`  | `0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`        |
| md      | `8px`  | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`   |
| lg      | `12px` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

Card radius: `12px`. Button radius: `8px`. Input radius: `8px`.

## Button Rules

### Primary Button Rule

Each button group must have exactly **one** primary (`type="primary"`) button. Delete actions use `type="primary" danger`.

### Default Style

- Default size: do not set `size` (uses Ant Design default `middle`)
- Default type: `type="default"` (outlined button with border)

### Context-Specific Sizes & Types

| Context                   | Size    | Type           | Notes                              |
| ------------------------- | ------- | -------------- | ---------------------------------- |
| PageHeader actions        | default | default        | Normal outlined button             |
| Table cell inline actions | `small` | `link`         | Text button (no border/background) |
| Card internal operations  | default | icon           | Icon button with tooltip on hover  |
| Form submit               | default | primary        | Only primary in the form           |
| Delete / destructive      | default | primary danger | `danger` prop on primary           |

**Card icon button pattern**: Use `<Button type="text" icon={<Icon />} />` with `<Tooltip title="Action name">`. Show the action name only on hover via tooltip, not as visible text.

## Input & Data Entry Rules

### Default Size

Do not set `size` on any input component — use the Ant Design default (`middle`).

### Search Input

Always use Ant Design `Search` component (`<Input.Search />`). The Search component already includes a search icon at the end. Do **not** add an additional search icon inside the input.

### Number Input

Use `InputNumber` with stepper controls (up/down arrows) enabled. Set `min` and `step` as appropriate.

### Select / DatePicker / TimePicker

All use default size. No `size="large"` anywhere.

## Table Rules

### Height & Scrolling

Table height must adapt to the page height. The page itself must not scroll because the table is too tall. Instead, constrain the table container height so that only the **table body scrolls** while headers remain fixed.

Set `scroll={{ y: <calculated-height> }}` based on available viewport height.

### Action Column

Fix the action column to the right: `fixed: 'right'`.

### Top Actions

Table toolbar buttons align to the **right** side of the table header area.

### General

- List page Table renders directly without outer `<Card>` wrapper
- Operation buttons in table cells use `small` + `type="link"` (text button)
- Select in table cells uses `size="small"`

## Page Structure Patterns

### List Page

```
PageHeader (breadcrumb + title + actions)
  → Tabs (filter with count labels, never Radio.Group)
    → Table / Card grid (direct, no Card wrapper)
```

- Do not add stat cards — Tabs already show counts
- Place action buttons in `PageHeader` actions (top-right)
- Use `Tabs` for filtering, matching the bill list page style

### Detail Page

```
PageHeader (breadcrumb + title + actions)
  → Tabs (info sections)
    → Card (basic info)
    → Card (sub-lists/tables)
```

### Settings/Config Page

- Merge related sections into one Card with dividers
- Keep Card titles clear and specific

### Ops Admin List Pages

- Show Table directly, remove outer `<Card>` wrapper
- Place action buttons in `PageHeader` actions

## Tabs Usage

- Use Ant Design `Tabs` for all page-level filtering and switching
- Do not use `Radio.Group` + `Radio.Button` for page-level filters
- Add bottom border to Tabs navigation:

```css
.ant-tabs-nav {
  border-bottom: 1px solid var(--th-border);
  margin-bottom: 20px;
}
```

## Content Deduplication

- Dashboard already has business overview and stats — do not repeat on other pages
- Room page: Tabs show counts per status, remove top StatCard row
- Bill page: Tabs show unpaid/pending/all counts, remove top stat card row

## Style File Conventions

- Use `.module.scss` for component-level styles
- Import global variables via `@use '@/styles/variables' as *`
- Manage non-Ant Design styles with CSS variables (`var(--th-*)`) or SCSS variables (`$th-*`)
- Keep shared utility classes in `global.scss` (e.g. `.flex-between`, `.text-muted`)

## Page Checklist

After creating or modifying a page, verify:

- [ ] Colors follow white/gray/blue theme, no gradients
- [ ] Each button group has exactly one primary button; delete uses danger
- [ ] Default buttons use `type="default"` outlined style, no size prop
- [ ] Table cell buttons use `size="small" type="link"`
- [ ] Card operation buttons use icon button with tooltip
- [ ] Inputs use default size; Search uses `<Input.Search />` without extra icon
- [ ] Number inputs use `InputNumber` with steppers
- [ ] Table height adapts to viewport; only table body scrolls
- [ ] Table action column is `fixed: 'right'`
- [ ] Table top actions align right
- [ ] List page Table renders directly without outer `<Card>`
- [ ] Action buttons are in `PageHeader` actions
- [ ] Filters use `Tabs` (not `Radio.Group`)
- [ ] No duplicated stats that already exist on Dashboard
- [ ] Card shadows render correctly
