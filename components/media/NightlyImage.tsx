"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";

import {
  NIGHTLY_FALLBACK_IMAGE_URL,
  nightlyRatioClassName,
  pickImageSource,
  type NightlyImageRatio,
} from "@/components/media/nightly-image-config";

type Props = {
  src?: string | null;
  fallbackSrc?: string;
  alt: string;
  ratio: NightlyImageRatio;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  overlayClassName?: string;
  badgeSlot?: ReactNode;
  overlaySlot?: ReactNode;
  loading?: "lazy" | "eager";
};

export default function NightlyImage({
  src,
  fallbackSrc = NIGHTLY_FALLBACK_IMAGE_URL,
  alt,
  ratio,
  sizes,
  priority,
  className,
  imageClassName,
  overlayClassName,
  badgeSlot,
  overlaySlot,
  loading,
}: Props) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = useMemo(
    () => pickImageSource(hasError ? [fallbackSrc] : [src], fallbackSrc),
    [fallbackSrc, hasError, src]
  );

  return (
    <div
      className={`relative overflow-hidden rounded-[1rem] ${nightlyRatioClassName[ratio]} ${className ?? ""}`.trim()}
    >
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-cover ${imageClassName ?? ""}`.trim()}
        priority={priority}
        loading={loading ?? (priority ? "eager" : "lazy")}
        onError={() => setHasError(true)}
      />
      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`.trim()} /> : null}
      {overlaySlot ? <div className="absolute inset-0">{overlaySlot}</div> : null}
      {badgeSlot ? <div className="absolute left-3 top-3">{badgeSlot}</div> : null}
    </div>
  );
}
