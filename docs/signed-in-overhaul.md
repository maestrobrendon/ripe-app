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
- [ ] Real cutoff copy from the area ("Change until Tue, 6pm")
- [ ] Support links: WhatsApp from settings, email fallback while the number is the placeholder; prefilled messages
- [ ] One day system (zone days at sign-up, on Home, at checkout)
- [ ] Deliveries named ("Wednesdays", "For Mum · Saturdays"); creating one asks for a name and day
- [ ] /orders page
- [ ] No "test mode" text in production; payment card form removed
- [ ] Checkout never wipes anything (no cart for signed-in users)
- [ ] Adding from the shop adds on top, with the real quantity shown
- [ ] Basket actions never throw to the error screen; plain messages
- [ ] Delivered wording only after delivery
- [ ] Cancel membership confirms, and reports failures
- [ ] Phones normalised to +234; phone-only password help (WhatsApp prefill + staff reset link)
- [ ] Cart drawer never auto-opens

### Home
- [ ] Header: no Cart pill; compact search; Ask Kachi
- [ ] Delivery switcher only with more than one delivery
- [ ] Delivery card: date, time window, area, "change until" countdown; Choose a day when none
- [ ] Skip in a menu, with confirmation and undo
- [ ] Rows: natural quantities, one price, remove with undo, tap for the product, optimistic
- [ ] Prefill once at creation, not on every load
- [ ] Your usuals / In season / Cook this week, no drinks or archived items
- [ ] Sticky summary bar with delivery included and one Confirm button; no floating total
- [ ] States: editing, confirmed (cancel until cutoff), packing, on the way (rider), delivered (report, again), skipped
- [ ] Changing the day never starts checkout

### Checkout
- [ ] Prefilled; saved addresses with label, estate, landmark/bus stop, gate notes, second phone
- [ ] Phone keypad, autofill hints
- [ ] Pay on delivery (default) / bank transfer; card "coming soon"
- [ ] Review uses the server's own priced summary and the real delivery date
- [ ] Errors returned as messages
- [ ] Delivery fee shown on Home before checkout

### Orders
- [ ] Heading follows status; rider name and Call when on the way
- [ ] Order again; cancel before cutoff; "Something wrong?" report
- [ ] Emails to the account email too; reply-to support; #ABCD1234 everywhere
- [ ] WhatsApp order updates through the notifications module

### Account
- [ ] Header with phone; regrouped rows; one Sign out; no version line
- [ ] Setup nudge only for things that matter and can be done
- [ ] Membership: honest "next payment" copy, pending and declined requests shown, confirm cancel
- [ ] Food & household: the six goals, 12 max, dietary notes
- [ ] Name & contact: normalised phone, can't remove the last way to reach you, blank name rejected
- [ ] Addresses (several, default)
- [ ] Notifications (WhatsApp / email)
- [ ] Invite friends (₦1,000 each, WhatsApp share), credit applied at checkout
- [ ] Help: WhatsApp prefilled with name and last order
- [ ] Privacy & data: Kachi consent, download my data, delete my account
- [ ] Toasts above sheets

### Recipes
- [ ] One goal vocabulary
- [ ] No duplicate lists; nothing without a photo; Fresh Cuts recipe unpublished
- [ ] "Picked for you" actually ordered by the customer's goal
- [ ] "You have X · we bring Y" (honest)
- [ ] Members-only method gated everywhere
- [ ] Save on cards and the recipe page
- [ ] "Meal plan" naming; plain copy; sensible default slot; shopping-list ticks show at once

### Kachi
- [ ] One Kachi: no modes; proposes changes to this week's order with approve/undo
- [ ] Ideas chat uses the same path (no legacy prompt); entry is "Ask Kachi"
- [ ] Short disclosure line

### Navigation and platform
- [ ] Dock: Home · Shop · Recipes · Orders · Me, always labelled
- [ ] Every signed-in arrival lands on Home
- [ ] Desktop rail never overlaps content
- [ ] Loading skeletons, error boundary with retry, offline banner, lite motion respected
- [ ] Area dialog doesn't nag every session

### Psychology and habit
- [ ] Streaks removed until rewards are real
- [ ] Weekly reminder + cutoff reminder (email now, WhatsApp later) via cron
- [ ] "This week's price" promise; one price; savings once
- [ ] Monthly picture for members

### Edge cases
- [ ] Out-of-area customers: no nagging, a clear "we'll tell you when we reach you" state
- [ ] Membership approval/cancel: pricing follows membership live
- [ ] Rate-limited plan request says so
- [ ] Phone-only: no promised emails
- [ ] Out-of-stock labelled as such
- [ ] One order per delivery date
- [ ] Search: member prices for members; recipes searchable
- [ ] Header and Home stay in sync after adds from anywhere

### Admin
- [ ] Order: landmark, notes, second phone, payment status; Mark paid; issues with credit
- [ ] Customer: reset link for phone-only customers; deletion requests
