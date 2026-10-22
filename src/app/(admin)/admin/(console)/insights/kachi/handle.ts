import "server-only";
import { sha256Hex } from "@/lib/admin/crypto";

/** A stable, anonymous handle for a customer: enough to see two chats are the same person, not who they are. */
export const handleFor = (userId: string) => `Customer ${sha256Hex(`kachi-review:${userId}`).slice(0, 6).toUpperCase()}`;
