import { iconMark } from "@/brand/icon-mark";

// The browser-tab icon. 64px so it stays crisp on high-density screens.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return iconMark(size.width);
}
