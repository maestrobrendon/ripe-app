# Signed-in overhaul (Oct 2026)

Every item from the signed-in UX critique, mapped to the change that fixes it. Tick as it lands.

## Decisions

- **One container.** A signed-in customer has deliveries (the `Basket` table), never a cart. Everything they add goes into the delivery they're looking at. Guests keep the cookie cart; it merges into the active delivery when they sign in or sign up. Checkout reads the delivery directly.
- **One day system.** A delivery runs on one of its area's days (`DeliveryDay`, from `DeliveryZone.deliveryDays`), and closes at the area's cutoff hour the day before. `ShoppingWindowDay` is retired.
- **Honest weekly model.** Nothing is ordered or charged on its own. A repeating delivery keeps its items for next week and reminds the customer; they confirm each week in one tap. Skipping a week stops the reminder. (Per delivery date, kept in `ShoppingWindow`: opensAt = delivery date.)
- **Live pricing.** A delivery is priced by the customer's membership at the moment they confirm, not a mode locked at creation.
- **Payments without a gateway.** Pay on delivery (transfer or POS to the rider) is the default; bank transfer is the other option. `paidAt` stays empty until money is collected: delivered pay-on-delivery orders are marked paid; staff mark transfers paid.
- **Support without a provider.** WhatsApp comes from Site settings; while it's the placeholder, the app offers email instead of a dead link. WhatsApp messages (reminders, updates, reset links) go through one notifications module that logs them until a provider is connected; email sends today.

## Vocabulary

This week's order / another delivery · delivery day · "change until Tue 6pm" · area · membership (Member, Member Plus) · first order · meal plan · Ask Kachi · the six goals · order #ABCD1234.

## Checklist

### Trust fixes
- [x] Real cutoff copy from the area ("Change until Tue, 6pm")
- [x] Support links: WhatsApp from settings, email fallback while the number is the placeholder; prefilled messages
- [x] One day system (zone days at sign-up, on Home, at checkout)
- [x] Deliveries named ("Wednesdays", "For Mum · Saturdays"); creating one asks for a name and day
- [x] /orders page
- [x] No "test mode" text in production; payment card form removed
- [x] Checkout never wipes anything (no cart for signed-in users)
- [x] Adding from the shop adds on top, with the real quantity shown
- [x] Basket actions never throw to the error screen; plain messages
- [x] Delivered wording only after delivery
- [x] Cancel membership confirms, and reports failures
- [x] Phones normalised to +234; phone-only password help (WhatsApp prefill + staff reset link)
- [x] Cart drawer never auto-opens

### Home
- [x] Header: no Cart pill; compact search; Ask Kachi
- [x] Delivery switcher only with more than one delivery
- [x] Delivery card: date, time window, area, "change until" countdown; Choose a day when none
- [x] Skip in a menu, with confirmation and undo
- [x] Rows: natural quantities, one price, remove with undo, tap for the product, optimistic
- [x] Prefill once at creation, not on every load
- [x] Your usuals / In season / Cook this week, no drinks or archived items
- [x] Sticky summary bar with delivery included and one Confirm button; no floating total
- [x] States: editing, confirmed (cancel until cutoff), packing, on the way (rider), delivered (report, again), skipped
- [x] Changing the day never starts checkout

### Checkout
- [x] Prefilled; saved addresses with label, estate, landmark/bus stop, gate notes, second phone
- [x] Phone keypad, autofill hints
- [x] Pay on delivery (default) / bank transfer; card "coming soon"
- [x] Review uses the server's own priced summary and the real delivery date
- [x] Errors returned as messages
- [x] Delivery fee shown on Home before checkout

### Orders
- [x] Heading follows status; rider name and Call when on the way
- [x] Order again; cancel before cutoff; "Something wrong?" report
- [x] Emails to the account email too; reply-to support; #ABCD1234 everywhere
- [x] WhatsApp order updates through the notifications module

### Account
- [x] Header with phone; regrouped rows; one Sign out; no version line
- [x] Setup nudge only for things that matter and can be done
- [x] Membership: honest "next payment" copy, pending and declined requests shown, confirm cancel
- [x] Food & household: the six goals, 12 max, dietary notes
- [x] Name & contact: normalised phone, can't remove the last way to reach you, blank name rejected
- [x] Addresses (several, default)
- [x] Notifications (WhatsApp / email)
- [x] Invite friends (₦1,000 each, WhatsApp share), credit applied at checkout
- [x] Help: WhatsApp prefilled with name and last order
- [x] Privacy & data: Kachi consent, download my data, delete my account
- [x] Toasts above sheets

### Recipes
- [x] One goal vocabulary
- [x] No duplicate lists; nothing without a photo; Fresh Cuts recipe unpublished
- [x] "Picked for you" actually ordered by the customer's goal
- [x] "You have X · we bring Y" (honest)
- [x] Members-only method gated everywhere
- [x] Save on cards and the recipe page
- [x] "Meal plan" naming; plain copy; sensible default slot; shopping-list ticks show at once

### Kachi
- [x] One Kachi: no modes; proposes changes to this week's order with approve/undo
- [x] Ideas chat uses the same path (no legacy prompt); entry is "Ask Kachi"
- [x] Short disclosure line

### Navigation and platform
- [x] Dock: Home · Shop · Recipes · Orders · Me, always labelled
- [x] Every signed-in arrival lands on Home
- [x] Desktop rail never overlaps content
- [x] Loading skeletons, error boundary with retry, offline banner, lite motion respected
- [x] Area dialog doesn't nag every session

### Psychology and habit
- [x] Streaks removed until rewards are real
- [x] Weekly reminder + cutoff reminder (email now, WhatsApp later) via cron
- [x] "This week's price" promise; one price; savings once
- [x] Monthly picture for members

### Edge cases
- [x] Out-of-area customers: no nagging, a clear "we'll tell you when we reach you" state
- [x] Membership approval/cancel: pricing follows membership live
- [x] Rate-limited plan request says so
- [x] Phone-only: no promised emails
- [x] Out-of-stock labelled as such
- [x] One order per delivery date
- [x] Search: member prices for members; recipes searchable
- [x] Header and Home stay in sync after adds from anywhere

### Admin
- [x] Order: landmark, notes, second phone, payment status; Mark paid; issues with credit
- [x] Customer: reset link for phone-only customers; deletion requests

## Before deploying

1. Migrate production: `npm run db:status:prod`, then `npm run db:deploy:prod` (adds addresses, order issues, the notifications log, and the new user, order and delivery fields).
2. Backfill production: `npx tsx --conditions=react-server prisma/scripts/overhaul-data.ts --prod` (normalises phones, turns account addresses into saved addresses, moves deliveries onto their area's days, makes invite codes, hides the smoothie box and unpublishes the coleslaw).
3. In Vercel, add `CRON_SECRET` (any long random string). The daily reminder (`vercel.json`, 08:00 Lagos) refuses to run without it.
4. In the admin, Settings: set the real WhatsApp number (until then, help links fall back to email) and, to offer bank transfer at checkout, the bank account.

## Still waiting on providers

- WhatsApp messages (order updates, reminders, reset links) are written to `NotificationLog` with status LOGGED. Connecting a provider means implementing `sendWhatsApp` in `src/lib/notify.ts`.
- Card payment online is shown as "coming soon".

