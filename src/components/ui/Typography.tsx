import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type TitleSize = "page" | "section" | "card" | "modal";

type TitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4";
  size?: TitleSize;
};

const titleSizeClass: Record<TitleSize, string> = {
  page: "text-lg sm:text-xl font-semibold",
  section: "text-xl sm:text-2xl font-semibold",
  card: "text-base sm:text-lg font-semibold",
  modal: "text-lg font-semibold",
};

export function Title({
  as: Component = "h2",
  size = "section",
  className,
  ...props
}: TitleProps) {
  return (
    <Component
      className={cn(
        "leading-tight text-[var(--app-text)]",
        titleSizeClass[size],
        className,
      )}
      {...props}
    />
  );
}

type TextTone = "default" | "muted";
type TextSize = "sm" | "base" | "lg";

type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: TextTone;
  size?: TextSize;
};

const textToneClass: Record<TextTone, string> = {
  default: "text-[var(--app-text)]",
  muted: "text-[var(--app-muted)]",
};

const textSizeClass: Record<TextSize, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

export function Text({
  tone = "default",
  size = "sm",
  className,
  ...props
}: TextProps) {
  return (
    <p
      className={cn(
        "leading-relaxed",
        textToneClass[tone],
        textSizeClass[size],
        className,
      )}
      {...props}
    />
  );
}
