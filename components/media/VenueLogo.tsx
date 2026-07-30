import NightlyImage from "@/components/media/NightlyImage";
import { NIGHTLY_FALLBACK_LOGO_IMAGE_URL } from "@/components/media/nightly-image-config";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
};

export default function VenueLogo({ src, alt, className, priority }: Props) {
  return (
    <NightlyImage
      src={src}
      fallbackSrc={NIGHTLY_FALLBACK_LOGO_IMAGE_URL}
      alt={alt}
      ratio="square"
      sizes="96px"
      className={className}
      imageClassName="object-contain p-2 bg-white/5"
      priority={priority}
    />
  );
}
