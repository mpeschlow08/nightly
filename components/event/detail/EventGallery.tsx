"use client";

import Image from "next/image";
import { useState } from "react";

import EventImage from "@/components/media/EventImage";

type EventGalleryProps = {
  images: string[];
};

export default function EventGallery({ images }: EventGalleryProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {images.map((imageUrl, index) => (
          <button
            key={`${imageUrl}-${index}`}
            type="button"
            onClick={() => setExpandedImage(imageUrl)}
            className="min-w-[16rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/5"
            aria-label="Open event image"
          >
            <EventImage src={imageUrl} alt="Event gallery" orientation="horizontal" className="rounded-none" />
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-zinc-400">Tap an image to view larger</p>

      {expandedImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/86 p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs text-zinc-200"
          >
            Close
          </button>
          <div className="relative h-[82vh] w-full max-w-3xl overflow-hidden rounded-[1rem] border border-white/10 bg-black/30" role="img" aria-label="Expanded event media">
            <Image src={expandedImage} alt="Expanded event media" fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
