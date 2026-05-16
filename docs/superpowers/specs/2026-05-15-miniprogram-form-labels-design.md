# Wxapp Form Labels Design

## Goal

Improve small-program form usability by giving every business form input a persistent visible label, so users do not have to rely on placeholder text to understand what a field means.

## Scope

The change focuses on the Taro WeChat mini-program. The affected pages are:

- `apps/miniprogram/src/pages/apartments/index.tsx`
- `apps/miniprogram/src/pages/rooms/index.tsx`
- `apps/miniprogram/src/pages/bills/index.tsx`
- `apps/miniprogram/src/pages/settings/account.tsx`
- `apps/miniprogram/src/pages/settings/organization.tsx`

The login and settings home screens already use the shared `Input` component with labels and do not need behavior changes. Ops Web uses Ant Design `Form.Item` labels for most forms; search fields can continue relying on placeholder text because they are filter controls rather than data-entry forms.

## Design

Use the existing shared `Input` component from `apps/miniprogram/src/components/ui/Input.tsx`. It already supports `label`, `placeholder`, `type`, `password`, and `error`, and its styling matches the current mobile UI.

Pages that currently import native Taro `Input` will switch business form fields to the shared `Input` component. The native import may still be used only if a field requires unsupported native props. Field labels will be stable nouns such as "公寓名称", "合同开始日期", "收款金额", and "退租水表读数". Placeholder text will remain as input hints or examples, such as "YYYY-MM-DD" or "用逗号分隔".

Existing segmented controls already have surrounding `field-label` text, so they are not redesigned. This keeps the change tightly scoped to text input usability.

## Interaction Rules

- Every create, edit, payment, reading, import, and password form text input has a visible label.
- Search boxes may remain placeholder-only when the surrounding context already identifies them as search filters.
- Labels must not duplicate a nearby section title in a confusing way. For repeated fee rows, each input still gets a clear label such as "费用名称" and "费用金额".
- Date inputs keep the current string-entry behavior; changing them to `DateField` is out of scope for this pass.

## Testing

Run TypeScript checks for the mini-program after implementation:

```bash
pnpm --filter @tenant-hub/miniprogram typecheck
```

If a full build is practical in the local environment, also run:

```bash
pnpm --filter @tenant-hub/miniprogram build:weapp
```

Manual review should scan the changed pages and confirm labels remain visible after users type values into fields.
