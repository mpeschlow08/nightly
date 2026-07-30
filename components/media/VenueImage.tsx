import NightlyImage from "@/components/media/NightlyImage";
import { NIGHTLY_FALLBACK_IMAGE_URL } from "@/components/media/nightly-image-config";

type Props = {
  src?: string | null;
  alt: string;
  orientation: "horizontal" | "portrait";
  className?: string;
  priority?: boolean;
};

export default function VenueImage({ src, alt, orientation, className, priority }: Props) {
  return (
    <NightlyImage
      src={src}
      fallbackSrc={NIGHTLY_FALLBACK_IMAGE_URL}
      alt={alt}
      ratio={orientation === "horizontal" ? "landscape" : "portrait"}
      sizes={orientation === "horizontal" ? "(max-width: 640px) 78vw, 320px" : "(max-width: 640px) 82vw, 320px"}
      className={className}
      priority={priority}
    />
  );
}
