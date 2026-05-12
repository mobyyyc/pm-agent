"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectActivityEvent, ProjectMember } from "@/types/models";

type ActivitySectionProps = {
  events: ProjectActivityEvent[];
  projectMembers: ProjectMember[];
  isGuest: boolean;
  variant?: "default" | "compact";
};

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatEntityLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ActivitySection({ events, projectMembers, isGuest, variant = "default" }: ActivitySectionProps) {
  const isCompact = variant === "compact";
  const visibleEvents = isCompact ? events.slice(0, 6) : events;
  const activityScrollRef = useRef<HTMLUListElement>(null);
  const [showActivityFadeTop, setShowActivityFadeTop] = useState(false);
  const [showActivityFadeBottom, setShowActivityFadeBottom] = useState(false);

  const updateActivityScrollFades = useCallback(() => {
    const scrollArea = activityScrollRef.current;
    if (!isCompact || !scrollArea) {
      setShowActivityFadeTop(false);
      setShowActivityFadeBottom(false);
      return;
    }

    const hasOverflow = scrollArea.scrollHeight - scrollArea.clientHeight > 1;
    if (!hasOverflow) {
      setShowActivityFadeTop(false);
      setShowActivityFadeBottom(false);
      return;
    }

    const nextShowTop = scrollArea.scrollTop > 1;
    const nextShowBottom = scrollArea.scrollTop + scrollArea.clientHeight < scrollArea.scrollHeight - 1;

    setShowActivityFadeTop((current) => (current === nextShowTop ? current : nextShowTop));
    setShowActivityFadeBottom((current) => (current === nextShowBottom ? current : nextShowBottom));
  }, [isCompact]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      updateActivityScrollFades();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [visibleEvents.length, updateActivityScrollFades]);

  useEffect(() => {
    const handleResize = () => {
      updateActivityScrollFades();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateActivityScrollFades]);

  const getActorLabel = (actorUserId: string | null) => {
    if (!actorUserId) return "System";

    const member = projectMembers.find((projectMember) => projectMember.userId === actorUserId);
    return member?.displayName?.trim() || actorUserId;
  };
  const activityItems = visibleEvents.map((event) => (
    <li key={event.id} className={`app-frame-item app-frame-hover rounded-xl bg-white/5 transition-colors ${isCompact ? "p-3" : "p-4"}`}>
      <div className={`flex flex-col ${isCompact ? "gap-2" : "gap-3 sm:flex-row sm:items-start sm:justify-between"}`}>
        <div className="min-w-0">
          <p className="wrap-break-word text-sm font-semibold text-white">{event.summary}</p>
          <div className={`mt-2 flex min-w-0 flex-wrap gap-2 text-xs text-neutral-500 ${isCompact ? "[&>span]:h-6" : ""}`}>
            <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2">
              {getActorLabel(event.actorUserId)}
            </span>
            <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2">
              {formatEntityLabel(event.entityType)}
            </span>
            <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2">
              {event.source}
            </span>
          </div>
        </div>
        <time className="shrink-0 text-xs text-neutral-500" dateTime={event.createdAt}>
          {formatEventTime(event.createdAt)}
        </time>
      </div>
    </li>
  ));

  return (
    <section className={`app-frame rounded-2xl bg-white/5 ${isCompact ? "p-4" : "p-4 sm:p-5 md:p-6"}`}>
      <div className={`${isCompact ? "mb-3" : "mb-4"} flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between`}>
        <div>
          <h2 className={`${isCompact ? "text-base" : "text-xl"} font-semibold tracking-tight text-white`}>Activity</h2>
          {isGuest ? (
            <p className="mt-1 text-xs text-neutral-500">Guest projects do not store durable activity history.</p>
          ) : null}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {isGuest ? "Sign in to keep a durable activity trail." : "No activity recorded yet."}
        </p>
      ) : isCompact ? (
        <div className="scroll-fade scroll-fade--activity">
          <ul
            ref={activityScrollRef}
            onScroll={updateActivityScrollFades}
            className="scroll-fade__viewport max-h-96 space-y-3 overflow-y-auto pr-1"
          >
            {activityItems}
          </ul>
          <div
            aria-hidden="true"
            className={`scroll-fade__edge scroll-fade__edge--top ${showActivityFadeTop ? "opacity-100" : "opacity-0"}`}
          />
          <div
            aria-hidden="true"
            className={`scroll-fade__edge scroll-fade__edge--bottom ${showActivityFadeBottom ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      ) : (
        <ul className="space-y-3">{activityItems}</ul>
      )}
      {isCompact && events.length > visibleEvents.length ? (
        <p className="mt-3 text-xs font-medium text-neutral-500">{events.length - visibleEvents.length} older events hidden</p>
      ) : null}
    </section>
  );
}
