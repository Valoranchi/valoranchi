import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type DefaultTheme } from "vitepress";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const typedocSidebarPath = path.resolve(__dirname, "../reference/typedoc-sidebar.json");

let typedocSidebar: DefaultTheme.SidebarItem[] = [];
if (fs.existsSync(typedocSidebarPath)) {
  try {
    typedocSidebar = JSON.parse(
      fs.readFileSync(typedocSidebarPath, "utf-8"),
    ) as DefaultTheme.SidebarItem[];
  } catch {
    typedocSidebar = [];
  }
}

export default defineConfig({
  title: "@valoranchi/riot-client",
  description:
    "TypeScript client and CLI for local Riot Client integration and Valorant inventory inspection.",
  base: "/valoranchi/",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Languages", link: "/languages/" },
      { text: "Reference", link: "/reference/" },
      { text: "npm", link: "https://www.npmjs.com/package/@valoranchi/riot-client" },
      { text: "GitHub", link: "https://github.com/Valoranchi/valoranchi" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "How It Works", link: "/guide/how-it-works" },
          { text: "Account", link: "/guide/account" },
          { text: "Social", link: "/guide/social" },
          { text: "Store", link: "/guide/store" },
          { text: "Matches", link: "/guide/matches" },
          { text: "Party", link: "/guide/party" },
          { text: "Analytics", link: "/guide/analytics" },
          { text: "Real-Time Events", link: "/guide/events" },
          { text: "High-Level Watchers", link: "/guide/watchers" },
          { text: "Instalock", link: "/guide/instalock" },
          { text: "Serve Mode", link: "/guide/serve" },
          { text: "MCP Server", link: "/guide/mcp" },
          { text: "Single Executable", link: "/guide/executable" },
          { text: "Writes & Safety", link: "/guide/writes-and-safety" },
          { text: "Other Languages", link: "/guide/other-languages" },
          { text: "Raw Layer", link: "/guide/raw-layer" },
          { text: "Official API", link: "/guide/official-api" },
          { text: "CLI Reference", link: "/guide/cli" },
          { text: "Releasing", link: "/guide/releasing" },
        ],
      },
      {
        text: "Usage by language",
        items: [
          { text: "Overview", link: "/languages/" },
          { text: "JavaScript", link: "/languages/javascript" },
          { text: "TypeScript", link: "/languages/typescript" },
          { text: "C#", link: "/languages/csharp" },
          { text: "Java", link: "/languages/java" },
          { text: "Python", link: "/languages/python" },
          { text: "Go", link: "/languages/go" },
          { text: "Rust", link: "/languages/rust" },
          { text: "PHP", link: "/languages/php" },
          { text: "Ruby", link: "/languages/ruby" },
          { text: "Shell", link: "/languages/shell" },
        ],
      },
      {
        text: "API Reference",
        items: [{ text: "Overview", link: "/reference/" }, ...typedocSidebar],
      },
    ],
    search: {
      provider: "local",
    },
    footer: {
      message: "Not affiliated with Riot Games",
    },
  },
});
