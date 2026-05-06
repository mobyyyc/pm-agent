import type { KeyboardEventHandler, RefObject } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";

type ProjectHeaderProps = {
  projectName: string;
  projectIdea: string;
  isGuest: boolean;
  isEditingProjectTitle: boolean;
  isSavingProjectTitle: boolean;
  projectTitleDraft: string;
  projectTitleInputRef: RefObject<HTMLInputElement | null>;
  onProjectTitleEditStart: () => void;
  onProjectTitleDraftChange: (value: string) => void;
  onProjectTitleBlur: () => void;
  onProjectTitleKeyDown: KeyboardEventHandler<HTMLInputElement>;
};

export function ProjectHeader({
  projectName,
  projectIdea,
  isGuest,
  isEditingProjectTitle,
  isSavingProjectTitle,
  projectTitleDraft,
  projectTitleInputRef,
  onProjectTitleEditStart,
  onProjectTitleDraftChange,
  onProjectTitleBlur,
  onProjectTitleKeyDown,
}: ProjectHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <div className="relative min-h-10 w-full">
        <div className={`inline-flex max-w-full items-start gap-2 ${isEditingProjectTitle ? "invisible" : ""}`}>
          <h1 className="wrap-break-word text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {projectName || "Project Dashboard"}
          </h1>
          <button
            type="button"
            onClick={onProjectTitleEditStart}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Edit project title"
            title="Edit project title"
          >
            <PencilIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {isEditingProjectTitle ? (
          <input
            ref={projectTitleInputRef}
            type="text"
            value={projectTitleDraft}
            onChange={(event) => onProjectTitleDraftChange(event.target.value)}
            onBlur={onProjectTitleBlur}
            onKeyDown={onProjectTitleKeyDown}
            className="project-title-underline absolute left-0 top-0 w-full border-b bg-transparent p-0 text-2xl font-bold tracking-tight text-white outline-none sm:text-3xl"
            aria-label="Project title"
            disabled={isSavingProjectTitle}
          />
        ) : null}
      </div>
      <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">{projectIdea}</p>
      {isGuest ? (
        <p className="text-xs text-amber-500/80">Guest project &mdash; this data will be lost when you exit.</p>
      ) : null}
    </header>
  );
}
