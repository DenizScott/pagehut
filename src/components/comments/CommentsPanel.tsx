"use client";

import { Check, MessageSquare, MoreHorizontal, Pencil, RotateCcw, Trash2, Unlink, X } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import type { Anchor, Comment, Thread } from "@/lib/comments/types";
import { addReply, addThread, deleteComment, editComment, setResolved } from "@/lib/storage/comments";
import { cn } from "@/lib/utils";

export interface CommentsPanelProps {
  pageId: string;
  workspaceId: string;
  threads: Thread[];
  /** Signed-in GitHub login, or "" in local mode. */
  me: string;
  /** People who can be @mentioned. */
  people: string[];
  active: string | null;
  onActivate: (threadId: string | null) => void;
  /** A new inline thread waiting for its first comment. */
  draft: Anchor | null;
  onDraftDone: () => void;
  /** Inline threads whose quoted text is no longer in the page (null: not known, e.g. databases). */
  detached: ReadonlySet<string> | null;
  onClose: () => void;
}

/** Side panel with a page's comment threads: inline (anchored to text) and page comments. */
export function CommentsPanel(p: CommentsPanelProps) {
  const t = useTranslations("common.comments");
  const [showResolved, setShowResolved] = useState(false);
  const open = p.threads.filter((th) => !th.resolved);
  const resolved = p.threads.filter((th) => th.resolved);
  const shown = showResolved ? [...open, ...resolved] : open;

  const focusHighlight = (id: string) => {
    p.onActivate(id);
    document.querySelector(`.lk-editor [data-thread="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <aside
      aria-label={t("title")}
      className="lk-no-print fixed inset-y-0 end-0 z-40 flex w-[min(22rem,92vw)] flex-col border-s border-hairline bg-surface-glass shadow-float backdrop-blur-xl md:static md:z-auto md:w-80 md:bg-bg md:shadow-none md:backdrop-blur-none"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-3">
        <MessageSquare className="size-4 text-fg-muted" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-semibold">{t("title")}</h2>
        {resolved.length > 0 && (
          <button type="button" onClick={() => setShowResolved((v) => !v)} aria-pressed={showResolved} className="rounded-md px-1.5 py-0.5 text-xs text-fg-muted hover:bg-surface-hover">
            {t("showResolved", { count: resolved.length })}
          </button>
        )}
        <button type="button" onClick={p.onClose} aria-label={t("close")} className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg">
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {p.draft && (
          <section aria-label={t("newThread")} className="rounded-lg border border-accent bg-canvas p-2 shadow-card">
            <Quote text={p.draft.exact} />
            <Composer
              autoFocus
              people={p.people}
              placeholder={t("placeholder")}
              submitLabel={t("submit")}
              onCancel={p.onDraftDone}
              onSubmit={async (body) => {
                const th = await addThread(p.pageId, p.workspaceId, { anchor: p.draft!, author: p.me, body });
                p.onDraftDone();
                p.onActivate(th.id);
              }}
            />
          </section>
        )}

        {!shown.length && !p.draft && <p className="px-1 py-6 text-center text-sm text-fg-subtle">{t("empty")}</p>}

        {shown.map((th) => (
          <ThreadCard
            key={th.id}
            thread={th}
            {...p}
            selected={p.active === th.id}
            isDetached={!!th.anchor && !!p.detached?.has(th.id)}
            onSelect={() => (th.anchor ? focusHighlight(th.id) : p.onActivate(th.id))}
          />
        ))}
      </div>

      <footer className="shrink-0 border-t border-hairline p-3">
        <Composer
          people={p.people}
          placeholder={t("pagePlaceholder")}
          submitLabel={t("submit")}
          onSubmit={async (body) => {
            const th = await addThread(p.pageId, p.workspaceId, { author: p.me, body });
            p.onActivate(th.id);
          }}
        />
      </footer>
    </aside>
  );
}

function Quote({ text, detached }: { text: string; detached?: boolean }) {
  const t = useTranslations("common.comments");
  return (
    <blockquote className={cn("mb-2 line-clamp-3 border-s-2 ps-2 text-xs", detached ? "border-warning text-fg-subtle line-through" : "border-accent text-fg-muted")}>
      {text}
      {detached && <span className="sr-only"> ({t("detached")})</span>}
    </blockquote>
  );
}

function ThreadCard({
  thread,
  pageId,
  workspaceId,
  me,
  people,
  selected,
  isDetached,
  onSelect,
}: CommentsPanelProps & { thread: Thread; selected: boolean; isDetached: boolean; onSelect: () => void }) {
  const t = useTranslations("common.comments");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <article
      ref={ref}
      aria-label={thread.anchor ? t("threadOn", { text: thread.anchor.exact.slice(0, 60) }) : t("pageThread")}
      data-thread-card={thread.id}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, textarea, a, [role=menuitem]")) onSelect();
      }}
      className={cn(
        "rounded-lg border bg-canvas p-2 text-sm",
        selected ? "border-accent shadow-card" : "border-hairline",
        thread.resolved && "opacity-75",
      )}
    >
      {thread.anchor && <Quote text={thread.anchor.exact} detached={isDetached} />}
      {isDetached && (
        <p className="mb-2 flex items-center gap-1 text-xs text-warning">
          <Unlink className="size-3.5" aria-hidden="true" /> {t("detached")}
        </p>
      )}
      <ol className="space-y-2">
        {thread.comments.map((c) => (
          <li key={c.id}>
            <CommentItem comment={c} me={me} people={people} onEdit={(body) => editComment(pageId, workspaceId, thread.id, c.id, body)} onDelete={() => deleteComment(pageId, workspaceId, thread.id, c.id)} />
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <Composer compact people={people} placeholder={t("reply")} submitLabel={t("submitReply")} onSubmit={(body) => addReply(pageId, workspaceId, thread.id, { author: me, body })} />
        </div>
        <Button
          size="icon-sm"
          onClick={() => void setResolved(pageId, workspaceId, thread.id, !thread.resolved)}
          aria-label={thread.resolved ? t("reopen") : t("resolve")}
          title={thread.resolved ? t("reopen") : t("resolve")}
        >
          {thread.resolved ? <RotateCcw /> : <Check />}
        </Button>
      </div>
    </article>
  );
}

const hue = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

function Avatar({ login }: { login: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ background: `hsl(${hue(login || "local")} 35% 45%)` }}
      className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white uppercase"
    >
      {(login || "•").slice(0, 1)}
    </span>
  );
}

/** Comment text with @mentions highlighted (plain text; no Markdown, no HTML). */
export function CommentBody({ body }: { body: string }) {
  const parts: ReactNode[] = [];
  const re = /(^|[^\w@/])(@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/g;
  let last = 0;
  for (const m of body.matchAll(re)) {
    const at = m.index! + m[1].length;
    parts.push(body.slice(last, at));
    parts.push(
      <span key={at} className="rounded bg-accent-soft px-0.5 font-medium text-accent-text">
        {m[2]}
      </span>,
    );
    last = at + m[2].length;
  }
  parts.push(body.slice(last));
  return <p className="break-words whitespace-pre-wrap">{parts}</p>;
}

function CommentItem({ comment, me, people, onEdit, onDelete }: { comment: Comment; me: string; people: string[]; onEdit: (body: string) => void; onDelete: () => void }) {
  const t = useTranslations("common.comments");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [editing, setEditing] = useState(false);
  const mine = comment.author === me;
  const name = mine ? t("you") : comment.author ? `@${comment.author}` : t("localAuthor");

  return (
    <div className="group flex gap-2">
      <Avatar login={comment.author} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-xs">
          <span className="font-semibold text-fg">{name}</span>
          <time dateTime={new Date(comment.createdAt).toISOString()} className="text-fg-subtle">
            {format.relativeTime(new Date(comment.createdAt), now)}
          </time>
          {comment.editedAt && <span className="text-fg-subtle">· {t("edited")}</span>}
        </p>
        {editing ? (
          <Composer
            autoFocus
            initial={comment.body}
            people={people}
            placeholder={t("placeholder")}
            submitLabel={t("save")}
            onCancel={() => setEditing(false)}
            onSubmit={(body) => {
              onEdit(body);
              setEditing(false);
            }}
          />
        ) : (
          <CommentBody body={comment.body} />
        )}
      </div>
      {mine && !editing && (
        <Menu>
          <MenuTrigger className="grid size-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 group-hover:opacity-100 hover:bg-surface-hover focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label={t("actions")}>
            <MoreHorizontal className="size-4" />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => setEditing(true)}>
              <Pencil /> {t("edit")}
            </MenuItem>
            <MenuItem className="text-danger" onSelect={onDelete}>
              <Trash2 className="!text-danger" /> {t("delete")}
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}

/** Text box with @mention suggestions. Ctrl/Cmd+Enter sends; Escape cancels. */
function Composer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  people,
  autoFocus,
  initial = "",
  compact,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => unknown;
  onCancel?: () => void;
  people: string[];
  autoFocus?: boolean;
  initial?: string;
  compact?: boolean;
}) {
  const t = useTranslations("common.comments");
  const [text, setText] = useState(initial);
  const [caret, setCaret] = useState(initial.length);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();

  const query = useMemo(() => /(?:^|\s)@([A-Za-z0-9-]*)$/.exec(text.slice(0, caret))?.[1], [text, caret]);
  const matches = useMemo(
    () => (query === undefined ? [] : people.filter((l) => l.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6)),
    [people, query],
  );
  const showList = focused && matches.length > 0;

  const pick = (login: string) => {
    const before = text.slice(0, caret).replace(/@[A-Za-z0-9-]*$/, `@${login} `);
    const next = before + text.slice(caret);
    // The caret goes right after the mention as soon as React has rendered the new text, before
    // any further keystroke (a frame later is too late for fast typing).
    pendingCaret.current = before.length;
    setText(next);
    setCaret(before.length);
    setIndex(0);
  };
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null || !box.current) return;
    pendingCaret.current = null;
    box.current.focus();
    box.current.setSelectionRange(at, at);
  }, [text]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    await onSubmit(body);
    setText("");
    setCaret(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
    } else if (showList && (e.key === "Enter" || e.key === "Tab") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      pick(matches[Math.min(index, matches.length - 1)]);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const expanded = !compact || focused || !!text;
  return (
    <div className="relative">
      <textarea
        ref={box}
        autoFocus={autoFocus}
        value={text}
        rows={expanded ? 2 : 1}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${index}` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(e) => {
          setText(e.target.value);
          setCaret(e.target.selectionStart);
          setIndex(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className="block w-full resize-none rounded-md border border-border-control bg-canvas px-2 py-1 text-sm placeholder:text-fg-subtle"
      />
      {showList && (
        <ul id={listId} role="listbox" aria-label={t("people")} className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border border-hairline bg-surface p-1 text-sm shadow-float">
          {matches.map((login, i) => (
            <li
              key={login}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === index}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(login);
              }}
              className={cn("flex cursor-default items-center gap-2 rounded-md px-2 py-1", i === index && "bg-surface-active")}
            >
              <Avatar login={login} /> @{login}
            </li>
          ))}
        </ul>
      )}
      {expanded && (
        <div className="mt-1 flex items-center justify-end gap-1">
          {onCancel && (
            <Button size="sm" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => void submit()} title="Ctrl+Enter">
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
