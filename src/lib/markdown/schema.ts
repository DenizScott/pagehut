import { getSchema } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { schemaExtensions } from "@/lib/editor/extensions";

let cached: Schema | null = null;

/** The ProseMirror schema used by both the editor and the Markdown converters. */
export function getDocSchema(): Schema {
  cached ??= getSchema(schemaExtensions());
  return cached;
}
