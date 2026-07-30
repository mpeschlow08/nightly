import NightlyImage from "@/components/media/NightlyImage";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
};

export default function HeroImage({ src, alt, className, priority = true }: Props) {
  return (
    <NightlyImage
      src={src}
      alt={alt}
      ratio="hero"
      sizes="(max-width: 640px) 100vw, 980px"
      className={className}
      priority={priority}
    />
  );
}
