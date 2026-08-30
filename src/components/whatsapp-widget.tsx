import Link from "next/link";

// Support runs on WhatsApp from day one. Swap in the real business number later.
const WHATSAPP_NUMBER = "2348000000000";
const PREFILL = "Hi Ripe, I have a question about";

export function WhatsAppWidget() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILL)}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-medium text-white shadow-lg hover:brightness-95"
    >
      <span aria-hidden className="text-lg">💬</span>
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </Link>
  );
}
