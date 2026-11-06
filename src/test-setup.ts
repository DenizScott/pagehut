import { loadMarkdown } from "@/lib/markdown/runtime";

// App entry points load the Markdown converters lazily; unit tests call the synchronous helpers
// (pageContentFromFile, …) directly, so load them once up front.
await loadMarkdown();
