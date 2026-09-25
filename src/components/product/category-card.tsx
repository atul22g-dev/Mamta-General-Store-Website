import Link from "next/link";

import { cn } from "@/lib/utils";
import { ImageArea } from "@/components/ui/image-area";
import { SafeImage } from "@/components/product/safe-image";

interface CategoryCardProps {
  name: string;
  href: string;
  imageUrl: string | null;
  description?: string;
  className?: string;
}

/** Category tile: tall image with overlaid gradient-free caption bar. */
export function CategoryCard({ name, href, imageUrl, description, className }: CategoryCardProps) {
  return (
    <Link href={href} className={cn("group block", className)}>
      <ImageArea
        ratio="4/5"
        className="transition-shadow duration-300 ease-gentle group-hover:shadow-soft-lg"
      >
        {imageUrl && (
          <SafeImage
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-gentle group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-card/95 px-4 py-3 backdrop-blur-sm">
          <p className="font-display text-base font-medium">{name}</p>
          {description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </ImageArea>
    </Link>
  );
}
