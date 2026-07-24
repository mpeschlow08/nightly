"use client";

import { useMemo, useState } from "react";

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

  const [activeImageId, setActiveImageId] = useState<number | null>(validImages[0]?.id ?? null);

  const activeImage =
    validImages.find((image) => image.id === activeImageId) ?? validImages[0] ?? null;

  if (!activeImage) {
    return (
      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5">
        {imageClass ? (
          <div className={`h-64 bg-gradient-to-br ${imageClass} sm:h-72`} />
        ) : (
          <div className="flex h-64 items-center justify-center bg-zinc-900 text-sm text-zinc-400 sm:h-72">
            Cover image coming soon
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="mt-6">
      <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5">
        <img
          src={activeImage.imageUrl}
          alt="Venue hero"
          className="h-64 w-full object-cover sm:h-72"
        />
      </div>

      {validImages.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {validImages.map((image) => {
            const isActive = image.id === activeImage.id;

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageId(image.id)}
                aria-label="Select venue image"
                className={`overflow-hidden rounded-xl border bg-white/5 transition ${
                  isActive
                    ? "border-cyan-300/70 ring-2 ring-cyan-300/40"
                    : "border-white/10 hover:border-cyan-300/40"
                }`}
              >
                <img
                  src={image.imageUrl}
                  alt="Venue thumbnail"
                  className="h-16 w-full object-cover sm:h-20"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
