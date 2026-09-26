"use client";

import Image from "next/image";
import { useState } from "react";

const CLOUD_NAME = "dusynu0kv";

/**
 * Unsigned Cloudinary delivery. Works off the cloud name alone, no API secret.
 * g_auto keeps the subject in frame when the crop is tighter than the source.
 */
function makeLoader(aspectRatio: string) {
  return ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
    const transform = `c_fill,g_auto,ar_${aspectRatio},f_auto,q_${quality ?? "auto"},w_${width}`;
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${src}`;
  };
}

// Built once per ratio so the identity stays stable across renders.
const LOADERS: Record<string, ReturnType<typeof makeLoader>> = {
  "1:1": makeLoader("1:1"),
  "4:3": makeLoader("4:3"),
};

function loaderFor(aspectRatio: string) {
  return (LOADERS[aspectRatio] ??= makeLoader(aspectRatio));
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
  aspectRatio = "1:1",
}: {
  publicId: string | null | undefined;
  alt: string;
  emoji: string;
  sizes?: string;
  rounded?: string;
  className?: string;
  emojiClassName?: string;
  /** Cloudinary crop ratio. Match it to the container's own aspect. */
  aspectRatio?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(publicId) && !failed;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-sky-wash ${rounded} ${className}`}
    >
      {showPhoto ? (
        <Image
          src={publicId as string}
          alt={alt}
          fill
          sizes={sizes}
          loader={loaderFor(aspectRatio)}
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
