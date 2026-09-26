export const metadata = { title: "Terms. Basket" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Terms</h1>
      <div className="mt-6 space-y-4 text-sm text-muted">
        <p>
          This is placeholder terms copy for the MVP. A full set of terms of service and a privacy
          policy will be added before public launch.
        </p>
        <p>
          Basket delivers fresh produce across selected Lagos zones. Prices, delivery days and coverage
          depend on your area and can change. Orders are subject to a minimum cart value shown at
          checkout.
        </p>
        <p>
          Payment is currently in test mode and no real charge is taken. Subscriptions can be changed or
          cancelled at any time from your account.
        </p>
        <p>Questions: hello@basket.ng</p>
      </div>
    </div>
  );
}
