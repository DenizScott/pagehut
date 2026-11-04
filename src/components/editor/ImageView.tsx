"use client";

import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { getAsset } from "@/lib/storage/local-repo";
import { cn } from "@/lib/utils";

/** Resolves repo-relative `assets/…` paths from IndexedDB into object URLs. */
function useResolvedSrc(src: string | null): string | null {
  const isAsset = !!src && src.startsWith("assets/");
  const [resolved, setResolved] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!src || !isAsset) return;
    let url: string | null = null;
    let cancelled = false;
    getAsset(src).then((asset) => {
      if (cancelled) return;
      url = asset ? URL.createObjectURL(asset.blob) : null;
      setResolved({ src, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, isAsset]);

  if (!src) return null;
  if (!isAsset) return src;
  return resolved?.src === src ? resolved.url : null;
}

function ImageView({ node, selected }: ReactNodeViewProps) {
  const { src, alt, title } = node.attrs as { src: string | null; alt: string | null; title: string | null };
  const url = useResolvedSrc(src);
  return (
    <NodeViewWrapper as="figure" className="my-2" data-drag-handle>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user content from IndexedDB/blob URLs
        <img src={url} alt={alt ?? ""} title={title ?? undefined} className={cn("rounded-lg", selected && "outline-2 outline-ring")} />
      ) : (
        <div className="grid h-32 place-items-center rounded-lg border border-dashed border-hairline text-sm text-fg-subtle">
          {src}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** Same schema as the base Image extension (see lib/editor/extensions.ts); only the view differs. */
export const AssetImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({ inline: false, allowBase64: false });
