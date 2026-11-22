# Connect a shop

Use one Free project in the shop owner's Supabase account. Apply setup.sql and then receipts.sql in that project. In Authentication, create and confirm exactly one password user with an internal identifier of the form shopusername@shop.tyredesk.invalid. The owner signs in to TyreDesk with just the username and their app password. Use the dashboard to change the password if needed. Disable public signups in Authentication for a dedicated installation.

Bind the confirmed user's UUID using the SQL editor. Replace the parameter below with the UUID from Authentication.

```sql
insert into tyredesk.shop(owner_id)
select id from auth.users where id = '<owner UUID>' and email_confirmed_at is not null;
```

For each new shop, configure its username, project reference and publishable key in the trusted projectsByUsername directory in cloud.mjs before distributing the update. Aai Alignment is preconfigured. A fresh installation opens at TyreDesk sign-in. If a profile exists, the owner chooses a local device PIN and recovers the shop. An empty account sees business setup once. An existing local-only shop can connect from Settings. Keep independent backup copies.

The first signed-in device with shop data seeds an empty cloud database. Devices sharing the login get distinct invoice series. While TyreDesk is open, it checks for changes every 20 seconds and on reconnect. Incompatible concurrent edits stop sync and preserve the local copy. Review both devices before choosing the option to export the local copy and use the cloud records. Manually reconcile any genuine transactions from the export. The owner controls billing decisions when two disconnected devices have sold the last item or taken payments against the same balance.

Local and Google Drive exports are independent recovery copies. Restoring a backup replaces the local copy and disconnects cloud sync. Cloud sign-in sessions and credentials are excluded from backup exports. The cloud database contains current records and one retry token per device. Removing a reminder deletes its cloud record and advances a revision number so long-offline devices notice the deletion.

To rebuild the bundled authentication client from the pinned dependency, run npm ci and bundle the named GoTrueClient export of @supabase/auth-js with esbuild as browser ESM targeting Chrome 98. Run npm test, npm run test:cloud, npm run test:browser and npm run test:desktop.


## Inventory and storage

After setup and receipt support, apply the versioned inventory and monitoring migration in
`supabase/migrations`. It adds structured tyre uniqueness and a mode guard without
rewriting existing stock. Legacy products remain usable. Each new purchase retains a
separate identity and movement in the same shop revision. If disconnected devices both
sell the final units, the conflicting transaction requires review before cloud sync.

The weekly `tyredesk-weekly-storage-check` job keeps one administrative snapshot of
PostgreSQL and uploaded-object usage. Query `tyredesk.storage_usage` as the project
administrator and inspect the Cron run history in Supabase. It rotates its own old
successful job entries. TyreDesk stores no temporary supplier PDFs in Supabase.
The last acknowledged write per device is bounded and retained for safe retries.

Local backups use a shop-specific prefix or folder and preserve verified recovery
points. Earlier backups and Google Drive exports remain available. To restore an older
backup, use an isolated device copy and compare it with current Supabase records.
