"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpDown,
  CalendarDays,
  ChartBar,
  ChartGantt,
  ClipboardList,
  Columns3,
  Eye,
  Filter as FilterIcon,
  GalleryHorizontalEnd,
  Maximize2,
  MoreHorizontal,
  Plus,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useDebouncedSaver } from "@/lib/hooks/useDebouncedSaver";
import * as ops from "@/lib/database/ops";
import { runAutomations } from "@/lib/database/automations";
import { todayIso } from "@/lib/database/dates";
import { useGitHub } from "@/lib/github/session";
import { cellText, chartGroupable, groupRows, isEmptyCell, rowTitle, titleProperty, viewRows, visibleProperties, type QueryContext } from "@/lib/database/query";
import { filterOps, type CellValue, type DatabaseData, type Filter, type FilterOp, type PropertyType, type Row, type View, type ViewType } from "@/lib/database/types";
import type { PageRecord } from "@/lib/model/schemas";
import { getAsset, listPages, saveDatabase } from "@/lib/storage/local-repo";
import { useStatus } from "@/lib/stores/status";
import { cn } from "@/lib/utils";
import { Cell, OptionChip, type RelationSource } from "./Cell";
import { AutomationsButton } from "./Automations";
import { CalendarView, TimelineView } from "./DateViews";
import { ChartView, FormView } from "./ExtraViews";
import { PropertyMenu, typeIcon } from "./PropertyMenu";

const viewIcon: Record<ViewType, typeof Table2> = {
  table: Table2,
  board: Columns3,
  gallery: GalleryHorizontalEnd,
  calendar: CalendarDays,
  timeline: ChartGantt,
  chart: ChartBar,
  form: ClipboardList,
};

export interface Api {
  data: DatabaseData;
  view: View;
  rows: Row[];
  ctx: QueryContext;
  relations: RelationSource;
  set: (next: DatabaseData) => void;
  setCell: (rowId: string, propId: string, value: CellValue | undefined) => void;
  addOption: (propId: string, name: string) => string;
  addRow: (cells?: Row["cells"]) => void;
  openRow: (rowId: string) => void;
}

/** A database page: views (table, board, gallery) over typed rows, saved like any page. */
export function DatabaseView({ page }: { page: PageRecord }) {
  const t = useTranslations("database");
  const locale = useLocale();
  const [data, setData] = useState<DatabaseData>(() => page.database ?? { properties: [], views: [], rows: [] });
  const [viewId, setViewId] = useState(() => data.views[0]?.id ?? "");
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const saver = useDebouncedSaver((next: DatabaseData) => saveDatabase(page.id, next));
  const me = useGitHub((s) => s.user?.login);
  /** Runs the database's automations for one edited (or new, `before` undefined) row. */
  const automate = (next: DatabaseData, rowId: string, before: Row | undefined) => runAutomations(next, rowId, before, { today: todayIso(), me }).data;

  // Latest data, so several edits from one event (create an option, then select it) all apply.
  const latest = useRef(data);
  const set = (next: DatabaseData) => {
    useStatus.getState().noteUserEdit();
    latest.current = next;
    setData(next);
    saver.schedule(next);
  };

  // Other databases in the workspace, for relations.
  const pages = useLiveQuery(() => listPages(page.workspaceId), [page.workspaceId]);
  const relations = useMemo<RelationSource>(() => {
    const databases = new Map<string, { title: string; data: DatabaseData }>();
    for (const p of pages ?? []) if (p.kind === "database" && p.database) databases.set(p.id, { title: p.title, data: p.id === page.id ? data : p.database });
    return { databases };
  }, [pages, page.id, data]);
  const ctx = useMemo<QueryContext>(
    () => ({
      locale,
      relationTitle: (dbId, rowId) => {
        const target = relations.databases.get(dbId);
        const row = target?.data.rows.find((r) => r.id === rowId);
        return row && target ? rowTitle(target.data, row) || t("cell.untitledRow") : undefined;
      },
    }),
    [locale, relations, t],
  );

  const view = data.views.find((v) => v.id === viewId) ?? data.views[0];
  const rows = useMemo(() => (view ? viewRows(data, view, ctx) : []), [data, view, ctx]);
  if (!view) return null;

  const api: Api = {
    data,
    view,
    rows,
    ctx,
    relations,
    set,
    setCell: (rowId, propId, value) => {
      const before = latest.current.rows.find((r) => r.id === rowId);
      set(automate(ops.updateCell(latest.current, rowId, propId, value), rowId, before));
    },
    addOption: (propId, name) => {
      const r = ops.addOption(latest.current, propId, name);
      set(r.data);
      return r.optionId;
    },
    addRow: (cells = {}) => {
      // New rows match the view's "is" filters, so they don't disappear right away.
      const preset: Row["cells"] = { ...cells };
      for (const f of view.filters) {
        const prop = data.properties.find((p) => p.id === f.propertyId);
        if (f.op === "is" && f.value && prop && (prop.type === "select" || prop.type === "multiSelect")) preset[prop.id] ??= prop.type === "select" ? f.value : [f.value];
        if (f.op === "checked" && prop?.type === "checkbox") preset[prop.id] ??= true;
      }
      const r = ops.addRow(latest.current, preset);
      set(automate(r.data, r.row.id, undefined));
      if (view.type === "board" || view.type === "gallery" || view.type === "calendar" || view.type === "timeline") setOpenRowId(r.row.id);
    },
    openRow: setOpenRowId,
  };

  const openRow = data.rows.find((r) => r.id === openRowId);

  return (
    <section aria-label={t("label")} className="lk-database">
      <Toolbar api={api} onSelectView={setViewId} />
      {view.type === "table" && <TableView api={api} />}
      {view.type === "board" && <BoardView api={api} />}
      {view.type === "gallery" && <GalleryView api={api} />}
      {view.type === "calendar" && <CalendarView api={api} />}
      {view.type === "timeline" && <TimelineView api={api} />}
      {view.type === "chart" && <ChartView api={api} />}
      {view.type === "form" && <FormView api={api} />}
      {openRow && <RowDialog api={api} row={openRow} onClose={() => setOpenRowId(null)} />}
    </section>
  );
}

/* ---------------- Toolbar: views, filter, sort, properties, new ---------------- */

function Toolbar({ api, onSelectView }: { api: Api; onSelectView: (id: string) => void }) {
  const t = useTranslations("database");
  const { data, view, set } = api;
  const [renaming, setRenaming] = useState(false);
  const [viewName, setViewName] = useState(view.name);
  const startRename = () => {
    setViewName(view.name);
    setRenaming(true);
  };

  const addView = (type: ViewType) => {
    const r = ops.addView(data, t(`views.${type}`), type);
    set(r.data);
    onSelectView(r.view.id);
  };

  return (
    <div className="lk-no-print mb-2 flex flex-wrap items-center gap-1 border-b border-hairline pb-2">
      <div role="tablist" aria-label={t("views.label")} className="flex min-w-0 flex-wrap items-center gap-0.5">
        {data.views.map((v) => {
          const Icon = viewIcon[v.type];
          const selected = v.id === view.id;
          return selected && renaming ? (
            <input
              key={v.id}
              autoFocus
              aria-label={t("views.rename")}
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (viewName.trim() && viewName !== v.name) set(ops.updateView(data, v.id, { name: viewName.trim() }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              }}
              className="h-7 w-32 rounded-md border border-border-control bg-canvas px-2 text-sm"
            />
          ) : (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectView(v.id)}
              onDoubleClick={() => selected && startRename()}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2 text-sm",
                selected ? "bg-surface-active font-medium text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {v.name}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 items-center">
        <Menu>
          <MenuTrigger className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={t("views.add")}>
            <Plus className="size-4" />
          </MenuTrigger>
          <MenuContent align="start">
            {(["table", "board", "gallery", "calendar", "timeline", "chart", "form"] as const).map((type) => {
              const Icon = viewIcon[type];
              return (
                <MenuItem key={type} onSelect={() => addView(type)}>
                  <Icon /> {t(`views.${type}`)}
                </MenuItem>
              );
            })}
          </MenuContent>
        </Menu>
      </div>

      <FilterPopover api={api} />
      <SortPopover api={api} />
      <AutomationsButton api={api} />
      <ViewSettings api={api} onRename={startRename} onDeleted={() => onSelectView(data.views.find((v) => v.id !== view.id)?.id ?? "")} />
      <Button variant="primary" size="sm" onClick={() => api.addRow()}>
        <Plus /> {t("rows.new")}
      </Button>
    </div>
  );
}

const opsFor = (type: PropertyType): FilterOp[] => {
  switch (type) {
    case "checkbox":
      return ["checked", "unchecked"];
    case "number":
    case "formula":
    case "date":
      return ["is", "isNot", "gt", "lt", "isEmpty", "isNotEmpty"];
    case "select":
    case "multiSelect":
    case "relation":
      return ["is", "isNot", "isEmpty", "isNotEmpty"];
    default:
      return filterOps.filter((o) => !["gt", "lt", "checked", "unchecked"].includes(o));
  }
};
const needsValue = (op: FilterOp) => !["isEmpty", "isNotEmpty", "checked", "unchecked"].includes(op);

function FilterPopover({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, set } = api;
  const update = (filters: Filter[]) => set(ops.updateView(data, view.id, { filters }));
  const props = data.properties;
  const count = view.filters.length;

  return (
    <Popover.Root>
      <Popover.Trigger className={cn("flex h-7 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-surface-hover", count ? "text-accent-text" : "text-fg-muted")}>
        <FilterIcon className="size-4" aria-hidden="true" />
        {count ? t("filter.count", { count }) : t("filter.label")}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8} className="z-50 w-[min(34rem,calc(100vw-1rem))] rounded-lg border border-hairline bg-surface-glass p-2 text-sm shadow-float backdrop-blur-xl">
          {!count && <p className="px-1 pb-2 text-fg-subtle">{t("filter.none")}</p>}
          <ul className="space-y-1.5">
            {view.filters.map((f, i) => {
              const prop = props.find((p) => p.id === f.propertyId);
              if (!prop) return null;
              const replace = (patch: Partial<Filter>) => update(view.filters.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <li key={i} className="flex flex-wrap items-center gap-1">
                  <select
                    aria-label={t("filter.property")}
                    value={f.propertyId}
                    onChange={(e) => {
                      const np = props.find((p) => p.id === e.target.value)!;
                      replace({ propertyId: np.id, op: opsFor(np.type)[0], value: undefined });
                    }}
                    className="h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1"
                  >
                    {props.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t("filter.operator")}
                    value={f.op}
                    onChange={(e) => replace({ op: e.target.value as FilterOp })}
                    className="h-7 rounded-md border border-border-control bg-canvas px-1"
                  >
                    {opsFor(prop.type).map((o) => (
                      <option key={o} value={o}>
                        {t(`filter.ops.${o}`)}
                      </option>
                    ))}
                  </select>
                  {needsValue(f.op) &&
                    (prop.type === "select" || prop.type === "multiSelect" ? (
                      <select
                        aria-label={t("filter.value")}
                        value={f.value ?? ""}
                        onChange={(e) => replace({ value: e.target.value })}
                        className="h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1"
                      >
                        <option value="">—</option>
                        {(prop.options ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={t("filter.value")}
                        type={prop.type === "date" ? "date" : "text"}
                        value={f.value ?? ""}
                        onChange={(e) => replace({ value: e.target.value })}
                        className="h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-2"
                      />
                    ))}
                  <button type="button" aria-label={t("filter.remove")} onClick={() => update(view.filters.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover">
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Button size="sm" className="mt-2" onClick={() => update([...view.filters, { propertyId: props[0].id, op: opsFor(props[0].type)[0] }])}>
            <Plus /> {t("filter.add")}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SortPopover({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, set } = api;
  const update = (sorts: View["sorts"]) => set(ops.updateView(data, view.id, { sorts }));
  const count = view.sorts.length;
  const unused = data.properties.filter((p) => !view.sorts.some((s) => s.propertyId === p.id));

  return (
    <Popover.Root>
      <Popover.Trigger className={cn("flex h-7 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-surface-hover", count ? "text-accent-text" : "text-fg-muted")}>
        <ArrowUpDown className="size-4" aria-hidden="true" />
        {count ? t("sort.count", { count }) : t("sort.label")}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8} className="z-50 w-80 rounded-lg border border-hairline bg-surface-glass p-2 text-sm shadow-float backdrop-blur-xl">
          {!count && <p className="px-1 pb-2 text-fg-subtle">{t("sort.none")}</p>}
          <ul className="space-y-1.5">
            {view.sorts.map((s, i) => (
              <li key={s.propertyId} className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate px-1">{data.properties.find((p) => p.id === s.propertyId)?.name}</span>
                <select
                  aria-label={t("sort.direction")}
                  value={s.dir}
                  onChange={(e) => update(view.sorts.map((x, j) => (j === i ? { ...x, dir: e.target.value as "asc" | "desc" } : x)))}
                  className="h-7 rounded-md border border-border-control bg-canvas px-1"
                >
                  <option value="asc">{t("sort.asc")}</option>
                  <option value="desc">{t("sort.desc")}</option>
                </select>
                <button type="button" aria-label={t("sort.remove")} onClick={() => update(view.sorts.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {unused.length > 0 && (
            <select
              aria-label={t("sort.add")}
              value=""
              onChange={(e) => e.target.value && update([...view.sorts, { propertyId: e.target.value, dir: "asc" }])}
              className="mt-2 h-7 w-full rounded-md border border-border-control bg-canvas px-1"
            >
              <option value="">{t("sort.add")}</option>
              {unused.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ViewSettings({ api, onRename, onDeleted }: { api: Api; onRename: () => void; onDeleted: () => void }) {
  const t = useTranslations("database");
  const { data, view, set } = api;
  const selects = data.properties.filter((p) => p.type === "select");
  const urls = data.properties.filter((p) => p.type === "url");

  return (
    <Popover.Root>
      <Popover.Trigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-fg-muted hover:bg-surface-hover">
        <Eye className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("views.properties")}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8} className="z-50 w-72 rounded-lg border border-hairline bg-surface-glass p-2 text-sm shadow-float backdrop-blur-xl">
          {view.type === "board" && (
            <label className="mb-2 flex items-center gap-2">
              <span className="shrink-0 text-fg-muted">{t("views.groupBy")}</span>
              <select
                value={view.groupBy ?? ""}
                onChange={(e) => set(ops.updateView(data, view.id, { groupBy: e.target.value || undefined }))}
                className="h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1"
              >
                <option value="">{selects.length ? "—" : t("views.needSelect")}</option>
                {selects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view.type === "chart" && <ChartSettings api={api} />}
          {(view.type === "calendar" || view.type === "timeline") && <DateSettings api={api} />}
          {view.type === "gallery" && (
            <label className="mb-2 flex items-center gap-2">
              <span className="shrink-0 text-fg-muted">{t("views.cover")}</span>
              <select
                value={view.coverProperty ?? ""}
                onChange={(e) => set(ops.updateView(data, view.id, { coverProperty: e.target.value || undefined }))}
                className="h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1"
              >
                <option value="">{urls.length ? "—" : t("views.needUrl")}</option>
                {urls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="px-1 pb-1 text-xs font-medium text-fg-subtle">{t("views.shownProperties")}</p>
          <ul>
            {data.properties
              .filter((p) => p.type !== "title")
              .map((p) => {
                const Icon = typeIcon[p.type];
                const shown = !view.hidden.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-hover">
                      <Icon className="size-4 text-fg-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <input
                        type="checkbox"
                        checked={shown}
                        onChange={() => set(ops.updateView(data, view.id, { hidden: shown ? [...view.hidden, p.id] : view.hidden.filter((h) => h !== p.id) }))}
                        className="size-4 accent-(--accent)"
                      />
                    </label>
                  </li>
                );
              })}
          </ul>
          <div className="my-1 h-px bg-hairline" />
          <Popover.Close className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-start hover:bg-surface-hover" onClick={onRename}>
            {t("views.rename")}
          </Popover.Close>
          {data.views.length > 1 && (
            <Popover.Close
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-start text-danger hover:bg-surface-hover"
              onClick={() => {
                set(ops.deleteView(data, view.id));
                onDeleted();
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" /> {t("views.delete")}
            </Popover.Close>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------------- Table ---------------- */

function TableView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, rows, set } = api;
  const props = visibleProperties(data, view);
  const numberProps = data.properties.filter((p) => p.type === "number" || p.type === "formula");
  const databases = [...api.relations.databases.entries()].map(([id, d]) => ({ id, title: d.title }));

  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-fg-muted">
            {props.map((p) => {
              const Icon = typeIcon[p.type];
              return (
                <th key={p.id} scope="col" className={cn("border-e border-hairline p-0 text-start font-normal last:border-e-0", p.type === "title" ? "min-w-56" : "min-w-36")}>
                  <PropertyMenu
                    prop={p}
                    numberProps={numberProps.filter((x) => x.id !== p.id)}
                    databases={databases}
                    triggerLabel={t("property.menu", { name: p.name })}
                    className="flex h-8 w-full items-center gap-1.5 px-2 hover:bg-surface-hover"
                    onRename={(name) => set(ops.updateProperty(data, p.id, { name }))}
                    onChangeType={(type) => set(ops.changePropertyType(data, p.id, type))}
                    onPatch={(patch) => set(ops.updateProperty(data, p.id, patch))}
                    onSort={(dir) => set(ops.updateView(data, view.id, { sorts: [{ propertyId: p.id, dir }] }))}
                    onHide={() => set(ops.updateView(data, view.id, { hidden: [...view.hidden, p.id] }))}
                    onDelete={() => set(ops.deleteProperty(data, p.id))}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{p.name}</span>
                  </PropertyMenu>
                </th>
              );
            })}
            <th scope="col" className="w-10 p-0">
              <AddPropertyButton api={api} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group border-b border-hairline hover:bg-surface-hover/50">
              {props.map((p) => (
                <td key={p.id} className="relative border-e border-hairline p-0 align-top last:border-e-0">
                  <div className="flex items-start">
                    <div className="min-w-0 flex-1">
                      <Cell
                        data={data}
                        row={row}
                        prop={p}
                        ctx={api.ctx}
                        relations={api.relations}
                        label={`${p.name}, ${rowTitle(data, row) || t("cell.untitledRow")}`}
                        onChange={(v) => api.setCell(row.id, p.id, v)}
                        onAddOption={(name) => api.addOption(p.id, name)}
                      />
                    </div>
                    {p.type === "title" && (
                      <button
                        type="button"
                        onClick={() => api.openRow(row.id)}
                        aria-label={t("rows.open", { name: rowTitle(data, row) || t("cell.untitledRow") })}
                        className="m-1 grid size-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 group-hover:opacity-100 hover:bg-surface-active focus-visible:opacity-100"
                      >
                        <Maximize2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              ))}
              <td className="p-0 align-top">
                <RowMenu api={api} row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => api.addRow()} className="lk-no-print flex h-8 w-full items-center gap-1.5 px-2 text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg">
        <Plus className="size-4" aria-hidden="true" /> {t("rows.new")}
      </button>
      <p className="px-2 pt-1 text-xs text-fg-subtle">{t("rows.count", { count: rows.length })}</p>
    </div>
  );
}

function AddPropertyButton({ api }: { api: Api }) {
  const t = useTranslations("database");
  return (
    <Menu>
      <MenuTrigger className="grid h-8 w-10 place-items-center text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={t("property.add")}>
        <Plus className="size-4" />
      </MenuTrigger>
      <MenuContent align="end">
        {(["text", "number", "select", "multiSelect", "checkbox", "date", "url", "person", "relation", "formula"] as const).map((type) => {
          const Icon = typeIcon[type];
          return (
            <MenuItem key={type} onSelect={() => api.set(ops.addProperty(api.data, t(`types.${type}`), type).data)}>
              <Icon /> {t(`types.${type}`)}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

function RowMenu({ api, row }: { api: Api; row: Row }) {
  const t = useTranslations("database");
  const name = rowTitle(api.data, row) || t("cell.untitledRow");
  return (
    <Menu>
      <MenuTrigger className="m-1 grid size-6 place-items-center rounded text-fg-muted opacity-0 group-hover:opacity-100 hover:bg-surface-active focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label={t("rows.actions", { name })}>
        <MoreHorizontal className="size-4" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem onSelect={() => api.openRow(row.id)}>
          <Maximize2 /> {t("rows.openShort")}
        </MenuItem>
        <MenuItem onSelect={() => api.set(ops.addRow(api.data, { ...row.cells }, { before: undefined }).data)}>
          <Plus /> {t("rows.duplicate")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem className="text-danger" onSelect={() => api.set(ops.deleteRow(api.data, row.id))}>
          <Trash2 className="!text-danger" /> {t("rows.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/* ---------------- Board ---------------- */

function CardProps({ api, row, skip }: { api: Api; row: Row; skip?: string }) {
  const props = visibleProperties(api.data, api.view).filter((p) => p.type !== "title" && p.id !== skip && !isEmptyCell(api.data, row, p));
  if (!props.length) return null;
  return (
    <dl className="mt-1 space-y-0.5 text-xs text-fg-muted">
      {props.map((p) => (
        <div key={p.id} className="flex min-w-0 items-center gap-1">
          <dt className="sr-only">{p.name}</dt>
          <dd className="flex min-w-0 flex-wrap gap-1">
            {(p.type === "select" || p.type === "multiSelect") && p.options
              ? [row.cells[p.id]].flat().map((id) => {
                  const o = p.options!.find((x) => x.id === id);
                  return o ? <OptionChip key={o.id} option={o} /> : null;
                })
              : <span className="truncate">{p.type === "checkbox" ? `✓ ${p.name}` : cellText(api.data, row, p, api.ctx)}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BoardView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, rows } = api;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const groupProp = data.properties.find((p) => p.id === view.groupBy && p.type === "select");
  const groups = groupRows(data, view, rows);

  if (!groupProp) {
    return <p className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-fg-muted">{t("views.boardNeedsGroup")}</p>;
  }

  const drop = (e: DragEvent, optionId: string | null) => {
    e.preventDefault();
    const rowId = e.dataTransfer.getData("text/x-pagehut-row") || dragging;
    setDragging(null);
    setOver(null);
    if (rowId) api.setCell(rowId, groupProp.id, optionId ?? undefined);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {groups.map((g) => {
        const key = g.option?.id ?? "";
        return (
          <section
            key={key || "none"}
            aria-label={g.option?.name ?? t("views.noValue", { name: groupProp.name })}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(key);
            }}
            onDragLeave={() => setOver((o) => (o === key ? null : o))}
            onDrop={(e) => drop(e, g.option?.id ?? null)}
            className={cn("flex w-64 shrink-0 flex-col rounded-lg bg-surface-hover/60 p-2", over === key && dragging && "outline-2 outline-(--ring)")}
          >
            <header className="mb-2 flex items-center gap-2 px-1 text-sm">
              {g.option ? <OptionChip option={g.option} /> : <span className="text-fg-muted">{t("views.noValue", { name: groupProp.name })}</span>}
              <span className="text-xs text-fg-subtle">{g.rows.length}</span>
            </header>
            <ul className="flex flex-col gap-2">
              {g.rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-pagehut-row", row.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(row.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => api.openRow(row.id)}
                    className={cn("w-full rounded-md border border-hairline bg-canvas p-2 text-start text-sm shadow-card hover:border-border-control", dragging === row.id && "opacity-50")}
                  >
                    <span className="block font-medium">{rowTitle(data, row) || <span className="text-fg-subtle">{t("cell.untitledRow")}</span>}</span>
                    <CardProps api={api} row={row} skip={groupProp.id} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => api.addRow(g.option ? { [groupProp.id]: g.option.id } : {})}
              className="mt-2 flex h-7 items-center gap-1.5 rounded-md px-1 text-sm text-fg-subtle hover:bg-surface-active hover:text-fg"
            >
              <Plus className="size-4" aria-hidden="true" /> {t("rows.new")}
            </button>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Gallery ---------------- */

function useCoverUrl(src: string): string | null {
  // Images stored in the workspace (assets/…) are read from IndexedDB as blob URLs.
  const [asset, setAsset] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => {
    if (!src.startsWith("assets/")) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getAsset(src).then((a) => {
      if (cancelled || !a) return;
      objectUrl = URL.createObjectURL(a.blob);
      setAsset({ src, url: objectUrl });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (/^https?:\/\//.test(src)) return src;
  return asset?.src === src ? asset.url : null;
}

function Cover({ src }: { src: string }) {
  const url = useCoverUrl(src);
  if (!url) return <div className="aspect-[16/10] bg-surface-hover" />;
  // eslint-disable-next-line @next/next/no-img-element -- user images (http or local blob URLs)
  return <img src={url} alt="" className="aspect-[16/10] w-full object-cover" referrerPolicy="no-referrer" />;
}

function GalleryView({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, rows } = api;
  const cover = data.properties.find((p) => p.id === view.coverProperty);
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
      {rows.map((row) => {
        const src = cover ? row.cells[cover.id] : undefined;
        return (
          <li key={row.id}>
            <button type="button" onClick={() => api.openRow(row.id)} className="block w-full overflow-hidden rounded-lg border border-hairline bg-canvas text-start shadow-card hover:border-border-control">
              {cover && <Cover src={typeof src === "string" ? src : ""} />}
              <span className="block p-2 text-sm">
                <span className="block font-medium">{rowTitle(data, row) || <span className="text-fg-subtle">{t("cell.untitledRow")}</span>}</span>
                <CardProps api={api} row={row} skip={cover?.id} />
              </span>
            </button>
          </li>
        );
      })}
      <li>
        <button type="button" onClick={() => api.addRow()} className="grid h-full min-h-24 w-full place-items-center rounded-lg border border-dashed border-hairline text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg">
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" aria-hidden="true" /> {t("rows.new")}
          </span>
        </button>
      </li>
    </ul>
  );
}

/* ---------------- Calendar and timeline settings ---------------- */

function DateSettings({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, set } = api;
  const dates = data.properties.filter((p) => p.type === "date");
  const select = "h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1";
  const field = (key: "dateProperty" | "endProperty", label: string, emptyLabel: string) => (
    <label className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-fg-muted">{label}</span>
      <select value={view[key] ?? ""} onChange={(e) => set(ops.updateView(data, view.id, { [key]: e.target.value || undefined }))} className={select}>
        <option value="">{emptyLabel}</option>
        {dates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mb-2 space-y-2">
      {field("dateProperty", view.type === "timeline" ? t("timeline.start") : t("calendar.date"), dates.length ? "—" : t("calendar.needDateShort"))}
      {view.type === "timeline" && field("endProperty", t("timeline.end"), t("timeline.noEnd"))}
    </div>
  );
}

/* ---------------- Chart settings ---------------- */

function ChartSettings({ api }: { api: Api }) {
  const t = useTranslations("database");
  const { data, view, set } = api;
  const groups = data.properties.filter(chartGroupable);
  const numbers = data.properties.filter((p) => p.type === "number" || p.type === "formula");
  const select = "h-7 min-w-0 flex-1 rounded-md border border-border-control bg-canvas px-1";
  return (
    <div className="mb-2 space-y-2">
      <label className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-fg-muted">{t("chart.groupBy")}</span>
        <select value={view.groupBy ?? ""} onChange={(e) => set(ops.updateView(data, view.id, { groupBy: e.target.value || undefined }))} className={select}>
          <option value="">{t("chart.all")}</option>
          {groups.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-fg-muted">{t("chart.value")}</span>
        <select
          value={view.chartValue ?? ""}
          onChange={(e) => set(ops.updateView(data, view.id, { chartValue: e.target.value || undefined, chartAgg: e.target.value ? (view.chartAgg === "avg" ? "avg" : "sum") : "count" }))}
          className={select}
        >
          <option value="">{t("chart.count")}</option>
          {numbers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {view.chartValue && (
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-fg-muted">{t("chart.agg")}</span>
          <select value={view.chartAgg === "avg" ? "avg" : "sum"} onChange={(e) => set(ops.updateView(data, view.id, { chartAgg: e.target.value as "sum" | "avg" }))} className={select}>
            <option value="sum">{t("chart.sum")}</option>
            <option value="avg">{t("chart.avg")}</option>
          </select>
        </label>
      )}
    </div>
  );
}

/* ---------------- Row dialog ---------------- */

function RowDialog({ api, row, onClose }: { api: Api; row: Row; onClose: () => void }) {
  const t = useTranslations("database");
  const { data } = api;
  const title = titleProperty(data);
  const name = rowTitle(data, row);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={name || t("cell.untitledRow")} className="max-w-xl">
        <div className="min-h-0 overflow-y-auto px-4 pt-2 pb-4">
          <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] items-start gap-x-3 gap-y-1 text-sm">
            {[title, ...data.properties.filter((p) => p.id !== title.id)].map((p) => {
              const Icon = typeIcon[p.type];
              return (
                <div key={p.id} className="contents">
                  <dt className="flex h-8 items-center gap-1.5 text-fg-muted">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{p.name}</span>
                  </dt>
                  <dd className="min-w-0">
                    <Cell
                      variant="field"
                      data={data}
                      row={row}
                      prop={p}
                      ctx={api.ctx}
                      relations={api.relations}
                      label={p.name}
                      onChange={(v) => api.setCell(row.id, p.id, v)}
                      onAddOption={(n) => api.addOption(p.id, n)}
                    />
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              className="text-danger"
              onClick={() => {
                api.set(ops.deleteRow(data, row.id));
                onClose();
              }}
            >
              <Trash2 /> {t("rows.delete")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
