"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import NightlyImage from "@/components/media/NightlyImage";
import { NIGHTLY_FALLBACK_IMAGE_URL } from "@/components/media/nightly-image-config";

type VenueImageGalleryProps = {
  imageClass: string | null;
  images: Array<{
    id: number;
    imageUrl: string;
  }>;
};

export default function VenueImageGallery({ imageClass, images }: VenueImageGalleryProps) {
  const validImages = useMemo(
    () => images.filter((image) => image.imageUrl && image.imageUrl.trim().length > 0),
    [images]
  );

  const [activeImageId, setActiveImageId] = useState<number | null>(null);

  const activeImage = validImages.find((image) => image.id === activeImageId) ?? null;

  if (!activeImage) {
    return (
      <section className="mt-6">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {validImages.length > 0
            ? validImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImageId(image.id)}
                  className="min-w-[16rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/5"
                  aria-label="Open venue photo"
                >
                  <NightlyImage src={image.imageUrl} alt="Venue gallery" ratio="landscape" sizes="(max-width: 640px) 78vw, 300px" className="rounded-none" />
                </button>
              ))
            : null}

          {validImages.length === 0 ? (
            <div className="w-full overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/5">
              {imageClass ? (
                <NightlyImage src={NIGHTLY_FALLBACK_IMAGE_URL} alt="Nightly venue fallback" ratio="landscape" sizes="(max-width: 640px) 78vw, 300px" className="rounded-none" />
              ) : (
                <div className="flex h-52 items-center justify-center bg-zinc-900 text-sm text-zinc-400">
                  Gallery coming soon
                </div>
              )}
            </div>
          ) : null}
        </div>

        <p className="mt-2 px-4 text-xs text-zinc-400 sm:px-5 lg:px-6">Tap an image to view larger</p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {validImages.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setActiveImageId(image.id)}
            className="min-w-[16rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/5"
            aria-label="Open venue photo"
          >
            <NightlyImage src={image.imageUrl} alt="Venue gallery" ratio="landscape" sizes="(max-width: 640px) 78vw, 300px" className="rounded-none" />
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-zinc-400">Tap an image to view larger</p>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/86 p-4" role="dialog" aria-modal="true">
        <button
          type="button"
          onClick={() => setActiveImageId(null)}
          className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs text-zinc-200"
        >
          Close
        </button>
        <div className="relative h-[82vh] w-full max-w-3xl overflow-hidden rounded-[1rem] border border-white/10 bg-black/30" aria-label="Venue enlarged" role="img">
          <Image src={activeImage.imageUrl} alt="Venue enlarged" fill sizes="100vw" className="object-contain" />
        </div>
      </div>
    </section>
  );
}
