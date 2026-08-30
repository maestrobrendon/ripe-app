import { NextResponse } from "next/server";
import { readCart } from "@/lib/cart";

export async function GET() {
  const view = await readCart();
  return NextResponse.json(view);
}
