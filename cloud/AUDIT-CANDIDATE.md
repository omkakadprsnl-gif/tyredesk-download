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

## Billing device handover

Each linked shop has one device that can issue invoices and make business changes. Other devices can read synchronized records. Opening the app while connected automatically checks for available billing access. The issuing device keeps access when the connection drops.

Close or background the app while it is connected to switch devices. TyreDesk freezes new writes on that device, uploads its saved changes, and releases billing. The next device loads the latest records and opens billing automatically. Save any invoice with a confirmed draft payment before closing. A device that was offline or whose process was killed before the release can retain access. Reopen it online to finish syncing and close it again. The grant stays in effect until the server releases it.

The matching app supports older shop projects so it can be distributed before lockdown. Upgrade every issuing device and confirm its cloud status is synced, then close any older app copies before enabling the lock. Apply the billing handover migration after the restricted-business-tables migration. Earlier app versions can still create local invoices and their writes will be rejected by the migrated cloud. Validate the matching clients with a disposable hosted Supabase project and check the installed Android upgrade before changing any live project.

### Replace a lost billing device

1. Verify the shop owner's identity through the support channel. Establish that the old device is lost, wiped, or physically removed from use before retiring it. A disconnected device cannot receive a revocation, so an old offline device might still issue local invoices if someone uses it. Review the latest independent backup, bank receipts and physical stock before resuming.
2. Sign in on the replacement to pull the last synced records. If a newer verified backup exists, restore it to the replacement and sign in to the same shop. Backups made with the recovery update include the last cloud revision and original values for unsynced changes. TyreDesk compares those changes against the cloud copy and preserves conflicts for review. Earlier backup files can be opened separately for manual reconciliation. Keep the original file and the synced copy.
3. A verified shop administrator uses **that shop's** Supabase SQL Editor. Read the active billing device and revision with the query below. Confirm the active device matches the device being retired and keep the last known recovery copies.

```sql
select billing_device, revision
from tyredesk.shop
where singleton;
```

4. Pass the verified device ID and revision to the administrator-only function.

```sql
select tyredesk.retire_lost_billing_device(
  '<verified device uuid>'::uuid,
  <verified revision>
);
```

It returns `stale` if the grant or revision changed. Recheck the shop and device before retrying. After it returns `retired`, the replacement can claim billing, sync recoverable changes and start billing. Compare invoice counts, payment totals and stock to the records reviewed in step 1. Keep an old device that reappears offline and preserve its backup for review before allowing it to rejoin as a fresh installation.

### Payment and backup rollout

- The shop-wide UPI index applies to nonblank received UPI references. Pre-existing duplicates must be reviewed before the migration can be applied. It preserves historical receipts and does not split one transfer between bills.
- Large Android automatic backups can use a compressed JSON envelope. The updated TyreDesk restores both formats and verifies both checksums for a compressed archive. Keep an updated installer with the recovery copy. For shops with very large history, verify the actual off-device backup and restore before relying on it.
- The updated app opens existing local records with an IndexedDB index migration. Back up and finish any pending invoices before upgrading. To revert after the index migration, restore the verified archive with a compatible build.

