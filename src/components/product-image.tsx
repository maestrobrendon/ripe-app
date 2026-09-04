"use client";

import Image from "next/image";
import { useState } from "react";

const CLOUD_NAME = "dusynu0kv";

/** Unsigned Cloudinary delivery. Works off the cloud name alone, no API secret. */
function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const transform = `c_fill,g_auto,ar_1:1,f_auto,q_${quality ?? "auto"},w_${width}`;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${src}`;
}

/**
 * Real produce photography from Cloudinary, with a graceful fall back to the
 * emoji tile when there is no public id or the image fails to load.
 */
export function ProductImage({
  publicId,
  alt,
  emoji,
  sizes = "(min-width: 1024px) 240px, 45vw",
  rounded = "rounded-xl",
  className = "",
  emojiClassName = "text-6xl",
}: {
  publicId: string | null | undefined;
  alt: string;
  emoji: string;
  sizes?: string;
  rounded?: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(publicId) && !failed;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-ripe-green-light ${rounded} ${className}`}
    >
      {showPhoto ? (
        <Image
          src={publicId as string}
          alt={alt}
          fill
          sizes={sizes}
          loader={cloudinaryLoader}
          onError={() => setFailed(true)}
          className="object-cover"
        />
      ) : (
        <span className={`select-none ${emojiClassName}`} aria-hidden>
          {emoji}
        </span>
      )}
    </div>
  );
}
