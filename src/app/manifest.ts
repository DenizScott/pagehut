import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: "A free, open-source workspace for writing, planning and organizing.",
    id: `/${BRAND.slug}`,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#466d50",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
