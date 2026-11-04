declare module "markdown-it-ins" {
  import type { PluginSimple } from "markdown-it";
  const ins: PluginSimple;
  export default ins;
}

declare module "markdown-it-container" {
  import type { PluginWithParams } from "markdown-it";
  const container: PluginWithParams;
  export default container;
}
