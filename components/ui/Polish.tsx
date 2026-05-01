"use client";

import { ReactNode } from "react";

export function EmptyState({
  eyebrow = "Aucun résultat",
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◆</div>
      <div className="eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-img" />
      <div className="skeleton-content">
        <div className="skeleton skeleton-pill" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function PremiumNotice({
  type = "info",
  title,
  children
}: {
  type?: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice notice-${type}`}>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function DemoBadge() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div className="demo-ribbon">
      Mode démonstration · données fictives
    </div>
  );
}
