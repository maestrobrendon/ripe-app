# Basket admin: open items and reference

Last updated 11 October 2026, after Phase 6 (commit `38c5216`).

The admin is live at **https://admin.getbasket.ng**, and the public site at **https://www.getbasket.ng**. All six planned phases are built and deployed.

---

## 1. Things you need to do

These need you, either because they're business decisions or because they involve your own secrets.

| # | What | Where | Why it matters |
|---|---|---|---|
| 1 | **Set the real support WhatsApp number.** It is still the placeholder `2348000000000`. | Admin → Settings | Every "Chat on WhatsApp" link on the site points at this number. |
| 2 | **Set real delivery fees and cutoffs per area.** Every area is currently ₦2,000, with orders closing at 6pm the day before. | Admin → Delivery areas | The fee is charged at checkout, and the cutoff decides which days customers can pick. |
| 3 | **Add the Cloudinary keys to Vercel production:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` (mark the secret as Sensitive). | Vercel → ripe-app → Settings → Environment Variables, then redeploy | Product and recipe photo uploads in the admin fail without them. |
| 4 | **Enter opening stock.** In production none of the 64 products has stock on hand or a reorder point yet. | Admin → Inventory (grid, or Receive) | Until you do, the low-stock list, buy list and expiry warnings stay empty, and packing records negative stock. |
| 5 | **Try the stock grid by hand:** click and type in cells, copy/paste, the fill handle, then review and save. | Admin → Inventory | Its saving and validation were tested, but its mouse and keyboard editing couldn't be automated. |
| 6 | **Add a second Owner, or keep your recovery codes somewhere safe.** You're the only active staff member, with one passkey. | Admin → Staff → Invite | If that passkey and your codes are lost, the way back in is the command-line invite with `--force` (section 4). |
| 7 | **Turn on the Vercel Firewall for the admin address** (consider a rate-limit rule and bot protection). | Vercel → ripe-app → Firewall | An extra layer in front of the sign-in page. |
| 8 | **Check `RESEND_FROM_EMAIL` is set in Vercel production** to an address on a domain verified in Resend. | Vercel → Environment Variables | Order confirmations, status emails and staff security alerts are sent from it. |
| 9 | **Test the email receipt end to end.** Place a real order on the live site with an inbox you can open (Gmail, plus one Outlook/Hotmail, which filters harder). Check it arrives (and not in spam), that the items, total, delivery date and order link are right, and how it looks on a phone. Then move it to Shipped/Delivered in the admin and check the status emails too. | www.getbasket.ng, then Admin → Orders | The confirmation screen tells every customer "Receipt sent to …". If Resend isn't set up in production, or the sending domain isn't verified, nothing arrives and that line isn't true. Sending is `src/lib/customer-emails.ts` (`sendOrderConfirmation`). |

---

## 2. Development follow-ups

### Fix soon (customers can see these)

- **The delivery-day picker shows "[cutoff time]" literally.** `src/lib/shopping-window.ts` has placeholder text ("Orders for Thursday close at [cutoff time] on Wednesday"), shown in `src/app/(site)/basket/day-picker-sheet.tsx`. It should show the customer's area cutoff (`DeliveryZone.cutoffHour`).
- **There's no "payment details" email for plan requests.** Customers who ask to join or upgrade are told payment details are coming, but nothing sends them. For now, Finance has to contact each one by hand from Admin → Subscriptions.

### Next features

- **Payment gateway (e.g. Paystack)** for checkout and plans. Today the admin only records payments, refunds and credits; no money moves through the site.
- **Editable goals and starter baskets.** `MENU_GOALS` (`src/lib/menu-types.ts`) is still in code, while recipes, settings and plans are all editable in the admin.
- **Short items at packing.** Packing an order takes its full quantities from stock, even when an item was short. Staff have to correct the count afterwards in Inventory.
- **⌘K search** across orders, customers and products (from the original plan; not built).
- **IP allowlist for the admin.** It's in the plan, but there's no `ADMIN_IP_ALLOWLIST` in the code yet. Build it if staff will always work from known networks.

### Housekeeping

- **Rate-limit buckets are never cleaned up.** `pruneRateLimits()` exists but nothing calls it. Add a daily Vercel Cron job (there's no `vercel.json` yet).
- **No CI.** The plan called for `npm audit`, lint, type-check and Vitest on each push. There's no `.github/workflows` yet.
- **Lock the audit table at the database level.** The app never edits or deletes audit rows, but the database user still could. Create a Neon role without UPDATE/DELETE on `AuditEvent` for the app to use.
- **4 lint errors that predate the admin:**
  - `about/page.tsx`: unescaped `'`
  - `basket/page.tsx`: plain `<a>` to `/cart`
  - `search-bar.tsx` and `zone-gate.tsx`: setState inside an effect
- **Admin `revalidatePath` calls use `/x` rather than `/admin/x`.** They do nothing, and nothing breaks, because admin pages are dynamic. Tidy them when you're in the code.
- **Glide Data Grid is pinned to a pre-release** (`6.0.4-alpha24`, the only build that works with React 19). Move to a stable release when one supports React 19.
- **Prisma CLI advisories** (`deepmerge-ts`, `mysql2`) only affect development tooling. Upgrading Prisma should clear them.

---

## 3. How things work (worth remembering)

- **Plans:** joining or upgrading creates a request that Finance approves in Admin → Subscriptions. Only Member Plus (`premium`) gets free delivery. In development, `PLAN_SELF_SERVE=1` makes plan changes instant again; never set it in production.
- **Weighed products:** a cart or order quantity of 1 means one pack of the product's reference weight, but stock is counted in grams.
- **Availability:**
  - Limited: shown as "Limited this season".
  - Out of stock: visible, but can't be bought.
  - Hidden: not shown at all.
- **Members-only recipes:** guests see the recipe but not the method.
- **Kachi chat review:** only customers who switched on "Help improve Kachi" on their account appear. They show under an anonymous handle, and every view is recorded in the audit log.
- **Exports** need a fresh second factor, are recorded in the audit log, and contain no phone numbers, emails or addresses.
- **Customer erasure** removes personal data for good. The audit log never holds customer names or contact details, so nothing survives there either.

---

## 4. Commands

Run from the project folder.

| Task | Command |
|---|---|
| Start locally (uses the `basket_dev` database) | `npm run dev` |
| Tests | `npm test` |
| Check production migrations | `npm run db:status:prod` |
| Apply migrations to production (after `db:status:prod`, before deploying code that needs them) | `npm run db:deploy:prod` |
| Re-import the recipe menu (dev / production) | `npm run menu:import` / `npm run menu:import -- --prod` |
| Invite a new Owner from the command line | `npm run admin:create-owner -- --email=you@example.com --name="Your Name" --prod --host=admin.getbasket.ng` |
| Same, when every Owner is locked out | add `--force` to the line above |

**Production environment variables already set:** `ADMIN_HOST`, `APP_ORIGIN`, `ADMIN_ENC_KEY`.

> **Never change or rotate `ADMIN_ENC_KEY`.** Authenticator-app secrets are encrypted with it. A new key breaks every staff member's authenticator sign-in, and they would have to set it up again.

**Deploys:** pushing to `master` deploys production on Vercel. If a change includes a migration, run `db:deploy:prod` first.
