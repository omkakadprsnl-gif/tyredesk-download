# TyreDesk 1.3.4

New shops can add services such as wheel alignment and balancing during setup. Open **Settings → Services** to add, edit or hide services and set default prices. Select a saved service on a new invoice and adjust its rate for that sale if needed.

Automatic billing handover is available for shops whose cloud project has enabled it. Close TyreDesk while the device is connected and allow its saved work to sync. Another connected device opens billing automatically. If a device goes offline or stops before it can sync, reopen it online and close it again.

Upgrade all issuing devices to 1.3.4 and confirm their records have synced before enabling billing handover on the shop project.

# TyreDesk 1.3.3

The payment QR appears below the live bill summary before saving. It stays visible when the entire amount is entered as paid. A settled bill shows the remaining balance status without offering another payment confirmation.

Home displays Update Now when TyreDesk detects a newer release. It checks on launch, on return to the app and periodically while open. The Android prompt identifies the signed download and mentions Play Protect.

# TyreDesk 1.3.2

Home has compact Add reminder and Backup buttons. The reminder bell and a short reminder summary highlight pending work. The backup button opens manual backup and setup options.

Automatic local backups save once per local day while TyreDesk is open. Manual and Google Drive backups are available on demand.

Add purchased tyres uses dependent Brand, Model and Size dropdowns. Each dropdown offers a new value alongside saved choices. The purchase form scrolls within the space above the mobile keyboard.

APK SHA-256: `7c2d8bc00b4741a3c8d84be2bb3b74b7e256495adcb00a3151f35a16c3c0c927`

# TyreDesk 1.3.1

Mobile sign-in uses less space. Tablet billing and payment screens keep actions within the page. Android removes older downloaded update files from its update cache on the backup schedule.

An in-app update on one Android 16 phone reached the system installer. Google Play Protect then blocked installation. The PDF layouts were tested in Chromium.

APK SHA-256: `e9bae56ac8e974bd37d2bfb4a7b0e6a97151b224e8a60a43c6b687443fe11b93`

# TyreDesk 1.3.0

Choose Simple or Detailed Inventory during shop setup or in Settings before recording stock. New purchases automatically match stock, with each purchase recorded separately. Existing tyre entries and purchase history are preserved. Inventory mode is locked once stock records exist.

New bill displays the shop payment QR before saving. The owner confirms payments after checking receipt. Billing uses dependent tyre choices, compact item rows, reusable services and live totals. Invoice corrections adjust the stock difference. Cancellation restores the remaining tracked stock. Print in 58 mm, 80 mm or A4.

A new device opens at shop sign-in and recovers synced records. Existing owners edit the business in Settings. Supabase measures database usage weekly. Automatic backups stay separate from sync and retain recovery points by shop.

Android 1.3.0 installs over an earlier TyreDesk version with the same signing certificate. In 1.3.0, use Settings → Update App to check for future versions. Android asks you to confirm installation.

APK SHA-256: `fa5b773697d0d3c321bb7ebbb80fee7ba1d103845ca9186d080345d33e5b1c94`

# TyreDesk 1.2.1

Fresh installations open at shop sign-in. Returning owners recover their saved business, and an empty account completes business setup once. Business details remain editable in Settings. The shop connection is preconfigured.

Billing has a Show payment QR button at the top and shows the QR image above customer and item fields before Save. A new service typed on a saved invoice becomes a reusable price-list entry. The original invoice retains its agreed rate.

# TyreDesk 1.2.0

Shop owners can enable private cloud sync in Settings. A fresh device can recover the shop at sign-in. Scanning the QR on an unsaved bill leaves the ledger untouched. Confirm money actually received, then save the invoice. Confirmed draft receipts survive an app restart on the same device.

The release was checked with two independent browser installations, offline billing, concurrent stock changes, duplicate confirmations, an interrupted server reply, reminder deletion and recovery on a third installation. The live shop account passed sign-in, token renewal and database access checks.

Inventory entry in 1.2.0 is manual. Earlier purchase records remain available.

The deployed PWA passed the desktop browser check. The two-device recovery and retry tests also passed against isolated records in hosted Supabase. The Android upgrade retains its signing certificate and package identity.

APK SHA-256: `02403c7bbf2fd8aab1d6283d33a6739c0950ace046960cfbd733f0c40ff3d4a8`

## Earlier releases

# TyreDesk 1.1.0 — 21 November 2026

This release keeps shop data on the device. Supabase integration is deferred; there is no automatic PC/phone sync.

## Features

- Personal reminders: custom title, optional notes, local date/time, prominent dashboard cards, red due bell, editing and completion. Completion deletes the current reminder record; no completed-reminder table or automatic two-day customer follow-up exists. Older external backups can still contain reminders and restore them.
- New shop setup requires an initially unchecked acceptance checkbox. Terms and Privacy pages are available in setup, Settings and the installation website, including offline. The locally stored acceptance records both document versions and the device-recorded time. Existing shops are not assigned invented acceptance records.
- Settings → Shop payment QR: upload your own clear PNG/JPG/WebP image and save. It is included in backups. Complete a bill, then choose **Show payment QR**. Missing QR configuration leads to Settings. Displaying the QR does not create a payment. Check your bank/UPI app, enter the amount actually received, tick verification and press **Payment received**. Partial payments reduce the balance; a fully paid bill has no further confirmation button. Repeated confirmation requests and duplicate supplied transaction references are guarded by atomic ledger checks.
- Inventory → **Import supplier PDF**: local extraction from text-based PDFs, editable candidate rows, explicit existing-product matching or new-tyre creation, supplier and invoice reference, then mandatory review before committing stock purchases. Common description/quantity/unit-cost/line-total rows receive suggestions. Unrecognised layouts require manual correction; scanned PDFs require manual rows, with no OCR service. New products start with 0% GST until edited. Imports do not fabricate supplier payments or operating expenses. The same PDF fingerprint or supplier/invoice reference cannot be imported twice; duplicate markers survive backups. All rows commit or roll back together.

## Verification

- Automated reminder persistence, editing, completion deletion, schema 6 backup and legacy schema 5 restore.
- Ledger partial/full payment, repeated request idempotency, duplicate transaction references, concurrent confirmation and overpayment rejection.
- Supplier import validation, atomic rollback, duplicate prevention, new/existing tyres and backup restoration.
- Mobile Chromium at 390 × 844: required setup consent, reminder create/edit/complete, missing QR prompt, image upload, QR display with no ledger change, partial/full manual receipt, PDF file extraction/import and backup restore.
- Service worker: shell, Terms, Privacy and the locally bundled PDF worker remain usable offline. User records are not held in the app cache.
- The same browser flow was run against the deployed HTTPS PWA and desktop Chromium at 1440 x 1000.
- Android asset checks: schema 5 → 6 preserves an existing shop, stock and unpaid bill; native backup contains reminders; local JavaScript/PDF-worker assets load; native app does not register a service worker.
- Android release: package `com.tyredesk.offline`, version code 11, version name 1.1.0, minimum Android API 24. Non-debuggable release; v2/v3 signature verification and certificate match against the previous public APK. Android 35 emulator installation and startup passed after correcting a native DOM readiness issue; the rendered setup screen was inspected.

APK SHA-256: `7c8d83c254e9fbc9a9d318b54e64d868f1153c838b979ea5c2efbb6475709ef8`

## Practical limits and legal review

No physical phone camera, bank transfer, printer or Google Drive provider was exercised. Back up your shop before installing an update. The existing package identity, app data origin and release signing certificate are preserved. Android private source and signing key remain private; only the customer APK is distributed.

The provider name supplied is **TyreDesk**. A verified private support/privacy email and full legal operator particulars remain to be supplied. The Terms and Privacy Policy disclose this gap. Obtain professional Indian legal review before commercial distribution; these drafts do not provide blanket immunity or certify compliance. The current official privacy framework reference is the [MeitY DPDP Rules publication](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf); applicable provisions have phased commencement, so the documents avoid claiming universal present compliance.
