# Mobile Form Layering Design

## Context

The mobile app currently has several business forms rendered directly at the feature entry point. Examples include payment registration on the bills page, meter reading entry, expense recording in apartment cards, apartment fee item creation, and room creation or editing. These forms interrupt browsing, push important list content down, and make action scope less clear.

The existing mobile UI guideline already states that forms with three or more inputs, growing option sets, or meaningful business consequences must move into a separate layer. This design applies that rule consistently across the mobile business pages.

## Goals

- Keep list and detail screens focused on browsing, summaries, and explicit action entry points.
- Move every directly expanded business form into an appropriate layer.
- Use lighter layers for short, frequent tasks and stronger layers for complex tasks.
- Reuse one form container pattern so bills, apartments, and rooms behave consistently.
- Preserve the existing API calls and business behavior unless a form transition requires a small state adjustment.

## Non-Goals

- Redesign the full mobile visual system.
- Change billing, apartment, room, lease, or expense API contracts.
- Rework authentication or settings forms unless they directly violate the business-page form pattern.
- Add multi-step workflows for tasks that are currently single-submit forms.

## Layering Rules

Business screens must not render a form directly at the feature entry point. The entry point should show only context, summary data, and an action button.

All business forms use a drawer or dedicated subpage. Short forms may use a compact drawer, but they should not use confirmation dialogs or bottom sheets when the user needs to enter and submit data.

Medium forms use a scrollable drawer. These are appropriate when the task has several fields, a selectable object list, or needs more vertical room while still preserving background context.

Complex forms use a dedicated subpage. These are appropriate when the task has many fields, multiple sections, or requires focused editing space.

High-risk confirmation actions use a dialog only when the user is making a short decision. If the action requires any additional input, the input step uses a drawer or subpage.

## Form Classification

### Short Forms

The following forms should move into a compact drawer:

- `记录花费`
- `登记收款`
- `添加费用项`
Simple delete confirmations should use a dialog because they are confirmation actions, not forms.

The drawer should include a clear title, optional context line, labeled fields, a close action, and a submit action. On successful submit it should close, reset only its own transient input values, refresh the page data, and show the existing notice message.

### Medium Forms

The following forms should move into a drawer:

- `录入读数`
- `新增单个房间`
- `编辑房间`
- `批量添加房间`

The drawer should include a title, context line when relevant, scrollable content, close action, and bottom submit action. It should not be nested inside list cards or detail panels.

### Complex Forms

The following forms should remain dedicated subpages:

- `新建公寓`
- `编辑公寓信息`

The current page-level structure for these forms is appropriate because the forms have many fields and multiple sections.

### Existing Modal Workflows

`签约入住` and `合约终止` already use modal layers. They can remain layered workflows, but their container styling should align with the new shared form container where practical. The implementation should avoid expanding these workflows inline in room cards.

## Component Design

Add a reusable mobile form container component, tentatively named `TaskSheet`, under `apps/mobile/src/components`.

The component should be based on React Native `Modal` and support:

- `visible`
- `variant`: `drawer` or `dialog`
- `title`
- optional `subtitle`
- `onClose`
- children for form content
- optional footer content for submit and secondary actions

The component owns the consistent overlay, card position, scroll behavior, title row, close button, and footer layout. Business pages own form state, validation, API calls, and success handling.

Use `drawer` for form tasks and `dialog` for confirmations. On native mobile, `drawer` can behave as a tall bottom sheet visually if a side drawer is not practical; the key requirement is that business forms use the drawer task layer, not inline content or confirmation dialogs.

## Screen Changes

### Bills

The bills page should remove the always-visible `登记收款` panel from the monthly tab. The monthly tab should show the monthly bill list and expose a `登记收款` action. Opening the action shows a short form layer with bill selection, amount, method, and note.

The meter tab should remove the always-visible `录入读数` panel. It should show recent readings and expose a `录入读数` action. Opening the action shows a drawer with date, reading value, meter type, room selection, and note.

### Apartments

The apartment list and apartment detail should remove inline `记录花费` forms. Their `记录花费` buttons should open the same short form layer, prefilled with the selected apartment context.

The apartment edit page should remove the inline `添加费用项` expansion and open a short form layer instead.

The room list inside apartment detail should remove inline single-room, batch-room, and edit-room forms. `新增房间`, `批量添加`, and `编辑` should open drawer layers. Delete confirmation should use a dialog.

### Rooms

The room list should keep lightweight room-card expansion for read-only details and action buttons. The inline `编辑房间` form should move to a drawer. `签约入住` and `合约终止` remain layered workflows.

## State And Data Flow

Each page keeps ownership of its existing form state and submit handlers. Opening a layer sets the current action and the relevant entity id. Closing a layer clears only the active action and any entity id used to scope it.

Submit success follows the existing sequence:

1. call the current API endpoint
2. reset the submitted form fields
3. close the active layer
4. refresh page data
5. show the current notice message

Validation remains local to each submit handler and should keep the existing Chinese validation messages unless a message needs to name the new layer context more clearly.

## Error Handling

API errors should keep using the existing `setNotice` pattern. A failed submit should leave the layer open so the user can correct input or retry. Closing a layer should not clear page data or selected list state.

## Testing And Verification

If the project has no mobile UI test framework, implementation should still include focused verification through:

- `pnpm --filter @tenant-hub/mobile typecheck`
- manual Expo web or in-app browser checks for each changed entry point
- checking that no business form remains directly expanded from a list or detail action

Where a lightweight test harness is practical, add tests around the shared container rendering and open/close state behavior.
