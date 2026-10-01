import {
  CaretRight,
  FileText,
  Leaf,
  MapPin,
  MapTrifold,
  Package,
  Question,
  Star,
  WhatsappLogo,
  ArrowUp,
  ClockCounterClockwise,
  Copy,
  NotePencil,
  ShieldCheck,
  ShoppingCart,
  ArrowsClockwise,
  Basket,
  CalendarBlank,
  CaretDown,
  ChatCircleDots,
  ChefHat,
  Check,
  CheckCircle,
  CreditCard,
  Eye,
  EyeSlash,
  Heart,
  House,
  Info,
  Lock,
  MagnifyingGlass,
  Minus,
  PaperPlaneRight,
  PencilSimple,
  Plant,
  Plus,
  SealCheck,
  Sliders,
  Sparkle,
  Spinner,
  Storefront,
  Sun,
  Trash,
  Truck,
  User,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * The site's icon vocabulary, in one place. Call sites name the meaning
 * ("cart") rather than the drawing, so swapping the underlying glyph is a
 * one-line change here instead of a hunt across the app. Backed by Phosphor
 * (the design system's icon set) instead of raw emoji or glyphs.
 */
export const ICONS = {
  account: User,
  cart: Basket,
  search: MagnifyingGlass,
  close: X,
  plus: Plus,
  minus: Minus,
  send: PaperPlaneRight,
  spinner: Spinner,
  check: CheckCircle,
  quality: SealCheck,
  delivery: Truck,
  parcel: Basket,
  local: Plant,
  season: Sun,
  shop: Storefront,
  reward: SealCheck,
  favourite: Heart,
  show: Eye,
  hide: EyeSlash,
  home: House,
  preferences: Sliders,
  payment: CreditCard,
  edit: PencilSimple,
  recipes: ChefHat,
  assistant: ChatCircleDots,
  trash: Trash,
  caretDown: CaretDown,
  checkPlain: Check,
  calendar: CalendarBlank,
  recurring: ArrowsClockwise,
  lock: Lock,
  spark: Sparkle,
  info: Info,
  history: ClockCounterClockwise,
  newChat: NotePencil,
  copy: Copy,
  shield: ShieldCheck,
  arrowUp: ArrowUp,
  trolley: ShoppingCart,
  caretRight: CaretRight,
  pin: MapPin,
  leaf: Leaf,
  help: Question,
  whatsapp: WhatsappLogo,
  map: MapTrifold,
  doc: FileText,
  star: Star,
  box: Package,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * House defaults: regular weight and currentColor, so an icon inherits the
 * colour of whatever it sits in rather than carrying its own.
 */
export function Icon({
  name,
  size = 24,
  strokeWidth,
  className,
  weight = "regular",
}: {
  name: IconName;
  size?: number;
  /** Kept for old call sites; Phosphor uses discrete weights instead of a stroke width. */
  strokeWidth?: number;
  className?: string;
  weight?: React.ComponentProps<PhosphorIcon>["weight"];
}) {
  const Glyph = ICONS[name];
  return <Glyph size={size} weight={strokeWidth && strokeWidth >= 2 ? "bold" : weight} color="currentColor" className={className} />;
}
