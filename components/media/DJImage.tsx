import NightlyImage from "@/components/media/NightlyImage";
import { NIGHTLY_FALLBACK_DJ_IMAGE_URL } from "@/components/media/nightly-image-config";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
};

export default function DJImage({ src, alt, className, priority }: Props) {
  return (
    <NightlyImage
      src={src}
      fallbackSrc={NIGHTLY_FALLBACK_DJ_IMAGE_URL}
      alt={alt}
      ratio="square"
      sizes="(max-width: 640px) 76vw, 280px"
      className={className}
      priority={priority}
    />
  );
}
