import { observer } from "mobx-react-lite";
import { downloadBlob, downloadJson, slugify } from "../../export/exportTheme";
import { buildVsix, validateMeta } from "../../export/vsix";
import { store } from "../../stores/ThemeStore";
import { DownloadIcon, PackageIcon } from "../../ui/icons";
import { Modal } from "../../ui/Modal";

export const ExportDialog = observer(function ExportDialog({ onClose }: { onClose: () => void }) {
  const errors = validateMeta(store.name, store.meta);
  const slug = slugify(store.name);
  const vsixName = `${slug}-${store.meta.version}.vsix`;

  const downloadVsix = () => {
    const { filename, bytes } = buildVsix({
      name: store.name,
      type: store.type,
      themeJson: store.themeJson,
      meta: store.meta,
    });
    downloadBlob(filename, new Blob([bytes as BlobPart], { type: "application/vsix" }));
  };

  return (
    <Modal
      title="Export theme"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => downloadJson(`${slug}-color-theme.json`, store.themeJson)}>
            <DownloadIcon /> Theme .json only
          </button>
          <button className="btn primary" disabled={errors.length > 0} onClick={downloadVsix}>
            <PackageIcon /> Download .vsix
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>
          Theme name
          <input value={store.name} onChange={(e) => store.setName(e.target.value)} />
        </label>
        <label>
          Publisher
          <input value={store.meta.publisher} onChange={(e) => store.setMeta({ publisher: e.target.value })} />
        </label>
        <label>
          Version
          <input value={store.meta.version} onChange={(e) => store.setMeta({ version: e.target.value })} />
        </label>
        <label className="span-2">
          Description
          <input
            value={store.meta.description}
            placeholder={`${store.name}, a VS Code color theme.`}
            onChange={(e) => store.setMeta({ description: e.target.value })}
          />
        </label>
      </div>
      {errors.length > 0 && (
        <ul className="form-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="install-help">
        <h3>Install the .vsix</h3>
        <p>
          In VS Code open the Extensions view, click <b>⋯</b> → <b>Install from VSIX…</b>, and pick{" "}
          <code>{vsixName}</code>. Or run:
        </p>
        <pre>code --install-extension {vsixName}</pre>
        <p>
          Then choose <b>{store.name}</b> under <i>Preferences: Color Theme</i>. To update, bump the version and
          install again.
        </p>
      </div>
    </Modal>
  );
});
