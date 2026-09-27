import { useEffect, useState } from "react";
import { isHex } from "../color/color";

interface Props {
  value: string;
  onCommit: (hex: string) => void;
  className?: string;
}

/** Text field that only commits valid hex colors (on Enter or blur). */
export function HexInput({ value, onCommit, className }: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const v = draft.trim().startsWith("#") ? draft.trim() : `#${draft.trim()}`;
    if (isHex(v) && v.toLowerCase() !== value.toLowerCase()) onCommit(v.toLowerCase());
    else setDraft(value);
  };

  return (
    <input
      className={"hex-input " + (className ?? "")}
      value={draft}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
