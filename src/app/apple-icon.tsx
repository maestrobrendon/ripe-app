import { iconMark } from "@/brand/icon-mark";

// The home-screen icon when someone adds Basket on an iPhone or iPad.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return iconMark(size.width, { rounded: false });
}
