import { observer } from "mobx-react-lite";
import { store } from "../../stores/ThemeStore";
import type { ColorAssignment } from "../../stores/types";
import { LinkIcon } from "../../ui/icons";

/** Swatch over a checkerboard (so alpha shows), with a chain when palette-linked. */
export const AssignmentSwatch = observer(function AssignmentSwatch({
  assignment,
}: {
  assignment: ColorAssignment | null | undefined;
}) {
  const hex = store.resolve(assignment);
  const linked = !!assignment && !assignment.source.startsWith("#");
  return (
    <span className={"assign-swatch" + (hex ? "" : " unset")}>
      <span style={{ background: hex ?? "transparent" }} />
      {linked && (
        <i title="Linked to palette">
          <LinkIcon size={9} />
        </i>
      )}
    </span>
  );
});
