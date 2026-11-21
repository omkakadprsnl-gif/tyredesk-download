# Connect a shop

Use one Free project in the shop owner's Supabase account. Apply setup.sql and then receipts.sql in that project. In Authentication, create and confirm exactly one password user with an internal identifier of the form shopusername@shop.tyredesk.invalid. The owner signs in to TyreDesk with just the username and their app password. Use the dashboard to change the password if needed. Disable public signups in Authentication for a dedicated installation.

Bind the confirmed user's UUID using the SQL editor. Replace the parameter below with the UUID from Authentication.

```sql
insert into tyredesk.shop(owner_id)
select id from auth.users where id = '<owner UUID>' and email_confirmed_at is not null;
```

On the first device, open Shop sign-in from Settings and authorise uploading this shop. A new installation can use Sign in to recover a cloud shop on the setup screen. Aai Alignment is preconfigured. For another shop, open Use a different shop project and enter its project reference and publishable key. Only a publishable key belongs on a device. The device PIN stays local.

The first signed-in device with shop data seeds an empty cloud database. Devices sharing the login get distinct invoice series. While TyreDesk is open, it checks for changes every 20 seconds and on reconnect. Incompatible concurrent edits stop sync and preserve the local copy. Review both devices before choosing the option to export the local copy and use the cloud records. Manually reconcile any genuine transactions from the export. The owner controls billing decisions when two disconnected devices have sold the last item or taken payments against the same balance.

Local and Google Drive exports are independent recovery copies. Restoring a backup replaces the local copy and disconnects cloud sync. Cloud sign-in sessions and credentials are excluded from backup exports. The cloud database contains current records and one retry token per device. Removing a reminder deletes its cloud record and advances a revision number so long-offline devices notice the deletion.

To rebuild the bundled authentication client from the pinned dependency, run npm ci and bundle the named GoTrueClient export of @supabase/auth-js with esbuild as browser ESM targeting Chrome 98. Run npm test, npm run test:cloud, npm run test:browser and npm run test:desktop.
