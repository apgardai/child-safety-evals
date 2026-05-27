import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  className?: string;
  width?: number;
  height?: number;
  /** Icon only (nav). `full` uses the logo image that includes the apgard wordmark. */
  variant?: "mark" | "full";
  /** Shown beside the mark (e.g. nav brand lockup). Ignored when variant is `full`. */
  title?: string;
};

export function ApgardLogo({
  href = "/",
  className = "",
  width,
  height,
  variant = "mark",
  title,
}: Props) {
  const isFull = variant === "full";
  const src = isFull ? "/apgard_logo.png" : "/apgard_without_name.png";
  const w = width ?? (isFull ? 120 : 72);
  const h = height ?? (isFull ? 48 : 28);
  const showTitle = !isFull && !!title;

  const img = (
    <Image
      src={src}
      alt={isFull ? "apgard" : ""}
      width={w}
      height={h}
      className={`h-auto w-auto shrink-0 object-contain ${className}`}
      priority
      aria-hidden={showTitle}
    />
  );

  const content = showTitle ? (
    <span className="inline-flex min-w-0 items-center gap-2">
      {img}
      <span className="truncate text-sm font-semibold leading-tight text-brand-dark md:text-base">
        {title}
      </span>
    </span>
  ) : (
    img
  );

  const ariaLabel = isFull ? "apgard home" : showTitle ? title : "apgard home";

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 items-center hover:opacity-90"
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  return content;
}
