import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Standard page width and horizontal padding (matches TopNav). */
export function PageContainer({ children, className = "" }: Props) {
  return <div className={`page-container ${className}`.trim()}>{children}</div>;
}
