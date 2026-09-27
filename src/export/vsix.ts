import { strToU8, zipSync } from "fflate";
import type { ExtensionMeta, ThemeType } from "../stores/types";
import { slugify } from "./exportTheme";

export interface VsixInput {
  name: string;
  type: ThemeType;
  themeJson: unknown;
  meta: ExtensionMeta;
}

const ENGINE = "^1.70.0";

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Problems that would make VS Code reject the package; empty when valid. */
export function validateMeta(name: string, meta: ExtensionMeta): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("Theme name is required.");
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(meta.publisher)) {
    errors.push("Publisher may only contain letters, digits and dashes.");
  }
  if (!/^\d+\.\d+\.\d+$/.test(meta.version)) errors.push("Version must look like 1.0.0.");
  return errors;
}

export function extensionFiles({ name, type, themeJson, meta }: VsixInput) {
  const slug = slugify(name);
  const themePath = `themes/${slug}-color-theme.json`;
  const description = meta.description || `${name}, a VS Code color theme.`;

  const packageJson = {
    name: slug,
    displayName: name,
    description,
    version: meta.version,
    publisher: meta.publisher,
    engines: { vscode: ENGINE },
    categories: ["Themes"],
    keywords: ["theme", "color-theme", type],
    contributes: {
      themes: [{ label: name, uiTheme: type === "dark" ? "vs-dark" : "vs", path: `./${themePath}` }],
    },
  };

  const readme = `# ${name}\n\n${description}\n\nGenerated with Theme Generator for VS Code.\n`;

  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${xml(slug)}" Version="${xml(meta.version)}" Publisher="${xml(meta.publisher)}" />
    <DisplayName>${xml(name)}</DisplayName>
    <Description xml:space="preserve">${xml(description)}</Description>
    <Tags>theme,color-theme,${type}</Tags>
    <Categories>Themes</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${ENGINE}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui,workspace" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
      <Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/readme.md" Addressable="true" />
  </Assets>
</PackageManifest>
`;

  const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json" /><Default Extension=".md" ContentType="text/markdown" /><Default Extension=".vsixmanifest" ContentType="text/xml" /></Types>
`;

  return {
    slug,
    files: {
      "[Content_Types].xml": contentTypes,
      "extension.vsixmanifest": manifest,
      "extension/package.json": JSON.stringify(packageJson, null, 2) + "\n",
      "extension/readme.md": readme,
      [`extension/${themePath}`]: JSON.stringify(themeJson, null, 2) + "\n",
    },
  };
}

/** Builds an installable .vsix (a zip in VS Code's extension package layout). */
export function buildVsix(input: VsixInput): { filename: string; bytes: Uint8Array } {
  const { slug, files } = extensionFiles(input);
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])),
    { level: 9 },
  );
  return { filename: `${slug}-${input.meta.version}.vsix`, bytes: zipped };
}
