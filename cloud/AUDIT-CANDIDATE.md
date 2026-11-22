# TyreDesk audit candidate

This branch is for isolated verification. Its schema and client changes are coordinated. The live download site and the Aai Alignment project keep their production versions.

## Provision a separate shop

1. Have the shop own its Supabase account and project. Use a different project and unique login alias for each shop. Keep administrator access separate from the shared counter login.
2. In an isolated project, apply `cloud/setup.sql`, then `cloud/receipts.sql`, then the migrations in timestamp order. Create the owner using the Supabase Auth administrator interface and set the project's `tyredesk.shop.owner_id` to that user's ID. The existing client expects the synthetic address `<alias>@shop.tyredesk.invalid`. Use a strong, unique password and provide it securely.
3. Put the alias, project reference and **publishable** key in `docs/shop-directory.json`. The file is public. Keep owner contact details, passwords, admin tokens and connection strings elsewhere. The app uses the shared build and resolves new aliases from the trusted TyreDesk distribution origin.
4. Keep each shop's devices and backup folders separate. The same signed APK may serve different shops once onboarding and Android distribution are cleared. A previously linked device refuses a different project or account. Back up and explicitly prepare a fresh profile when repurposing a device.
5. Verify the shop's active project, owner login, tax settings, inventory mode, test stock reconciliation, a fresh-device pull, a local backup and a separate recovery copy. Do this with disposable records before using business data.

## Safe deployment and recovery

- Keep a before-migration logical export, owner mapping and tested recovery instructions per shop. Apply changes to two isolated fixtures, then one hosted staging shop, then a small canary. Compare migration versions, allowed RPCs, business counts and reconciliation totals. Halt on drift, restore to an isolated project, and validate before pointing a client at a replacement.
- The audit migration leaves public RPC names intact and restricts underlying table privileges. Check it with the real hosted Auth/API gateway and review database advisors before production. The PostgreSQL fixture verifies core grant, RLS and revision behavior. It does not model every Supabase platform feature.
- When sync stalls, retain the device and its backup. Export every device with pending transactions. Inspect the cloud revision and resolve affected stock or payment records against physical stock and bank records. A cloud recovery can replace unsynced local records. Reconcile them before using it.
- For a forgotten password or staff departure, the shop administrator should verify the owner's identity, reset the password in Auth and revoke old sessions through the provider. Synthetic addresses do not support normal email recovery. Test activation, expiration, reauthentication and local device PIN access. Wipe a retired device only after recovering its data and obtaining owner authorization.
- After device loss, sign in on a new device and confirm the last synced data. If a local or off-device backup contains later records, restore it first into an isolated profile and reconcile the difference.
- For project pausing or exhausted quota, keep local exports, resume or increase capacity through the shop account, and reconcile pending transactions after reconnecting. Restrict stock sales until shared inventory has caught up.
- For an Android update failure, keep the installed app and its data, use a verified browser session as appropriate, and check the package version, signing certificate, checksum and installer outcome. Do not dismiss a Play Protect finding. Obtain an appropriate distribution review and complete an installed upgrade on representative phones before rollout.
- For account closure, deliver an authorized data export, revoke cloud sessions, record retention obligations, and only then follow a verified deletion request. Preserve statutory accounting records as advised by the shop's accountant.

## Verification commands

```text
npm ci --ignore-scripts
npm test
npm run test:audit
npm run test:cloud
npm run test:browser
npm run test:desktop
node tests/mobile-inventory.test.mjs
node tests/audit-load.mjs
```

The last-stock contention test documents the release blocker. A green regression run confirms the defect is reproducible under the current architecture, along with the expected protection against negative shared stock.

