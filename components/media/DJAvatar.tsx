import DJImage from "@/components/media/DJImage";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
};

export default function DJAvatar({ src, alt, className, priority }: Props) {
  return <DJImage src={src} alt={alt} className={className} priority={priority} />;
}
