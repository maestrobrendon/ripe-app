import { HugeiconsIcon } from "@hugeicons/react";
import {
  AccountSetting01Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  DeliveryBox01Icon,
  FavouriteIcon,
  Home01Icon,
  Loading03Icon,
  MinusSignIcon,
  PencilEdit01Icon,
  PlantIcon,
  PlusSignIcon,
  Search01Icon,
  ShoppingBasket01Icon,
  SparklesIcon,
  Store01Icon,
  Sun03Icon,
  TruckDeliveryIcon,
  UserIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";

/**
 * The site's icon vocabulary, in one place. Call sites name the meaning
 * ("cart") rather than the drawing, so swapping the underlying glyph is a
 * one-line change here instead of a hunt across the app.
 */
export const ICONS = {
  account: UserIcon,
  cart: ShoppingBasket01Icon,
  search: Search01Icon,
  close: Cancel01Icon,
  plus: PlusSignIcon,
  minus: MinusSignIcon,
  send: ArrowRight02Icon,
  spinner: Loading03Icon,
  check: CheckmarkCircle02Icon,
  quality: CheckmarkBadge01Icon,
  delivery: TruckDeliveryIcon,
  parcel: DeliveryBox01Icon,
  local: PlantIcon,
  season: Sun03Icon,
  shop: Store01Icon,
  reward: SparklesIcon,
  favourite: FavouriteIcon,
  show: ViewIcon,
  hide: ViewOffIcon,
  home: Home01Icon,
  preferences: AccountSetting01Icon,
  payment: CreditCardIcon,
  edit: PencilEdit01Icon,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * House defaults: 1.5px stroke and currentColor, so an icon inherits the
 * colour of whatever it sits in rather than carrying its own.
 */
export function Icon({
  name,
  size = 24,
  strokeWidth = 1.5,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={ICONS[name]}
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      className={className}
    />
  );
}
