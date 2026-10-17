import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { converter, formatHex, parse as parseColour } from "culori"
import { isInGamut, lchToHex, wrapHue, type Lch as OKLCH } from "../../color/color"
import { ScrubNumber } from "../../ui/ScrubNumber"
const rgb = converter("rgb")
const oklch = converter("oklch")
const fromOKLCH = (value: OKLCH) => rgb({ mode: "oklch", ...value })
const toHex = formatHex
const toOKLCH = (value: NonNullable<ReturnType<typeof parseColour>>): OKLCH => {
  const result = oklch(value)
  return { l: result.l, c: result.c, h: wrapHue(result.h ?? 0) }
}

// the plane's pixels, half its size on screen, so a hue drag can redraw it
// every frame; and the chroma at its right edge
const WIDTH = 120
const HEIGHT = 75
const CHROMA = 0.4

// Chromium's screen eyedropper; other browsers have none
type EyeDropper = new () => { open: () => Promise<{ sRGBHex: string }> }
const Dropper = (globalThis as { EyeDropper?: EyeDropper }).EyeDropper

const unit = (value: number) => Math.min(1, Math.max(0, value))

// Which plane the picker shows: lightness against chroma at the color's hue,
// with a hue strip; or hue against chroma at its lightness, with a lightness
// strip, as Tristen's HCL picker (https://tristen.ca/hcl-picker/) lays them
// out, for choosing hues at an even lightness.
type Plane = "lc" | "hc"
const planeKey = "theme-generator:picker-plane"
const savedPlane = (): Plane => {
  try {
    return localStorage.getItem(planeKey) === "hc" ? "hc" : "lc"
  } catch {
    return "lc"
  }
}

// black to white through the color's hue and chroma, each stop pulled into
// sRGB, for the lightness strip
const lightnesses = ({ c, h }: OKLCH) =>
  `linear-gradient(to right, ${Array.from({ length: 11 }, (_, i) => {
    let at = { l: i / 10, c, h }
    while (at.c > 0.001 && !isInGamut(at)) at = { ...at, c: at.c * 0.9 }
    return toHex(fromOKLCH(at))
  }).join(", ")})`
const hues = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) =>
  toHex(fromOKLCH({ l: 0.72, c: 0.17, h: i * 30 })),
).join(", ")})`

export interface ColorPickerProps {
  name: string
  color: OKLCH
  // the color when the picker opened, shown in the left half of the sample
  original: OKLCH
  // the swatch it opened from, which it stays beside
  anchor: HTMLElement
  onStart: (guard?: boolean) => void
  onChange: (next: Partial<OKLCH>) => void
  onEnd: () => void
  // puts back what the picker has changed since it opened
  onRestore: () => void
  onClose: () => void
}

/**
 * Lightness and chroma at the color's hue, a hue strip, its hex and values,
 * and an eyedropper that takes a color from anywhere on the screen. The
 * clear part of the plane is past what sRGB can show.
 */
export function ColorPicker({
  name,
  color,
  original,
  anchor,
  onStart,
  onChange,
  onEnd,
  onRestore,
  onClose,
}: ColorPickerProps) {
  const panel = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { panel.current?.showPopover?.() }, [])
  const plane = useRef<HTMLCanvasElement>(null)
  // the plane's or the strip's box, from the press to the release
  const pressed = useRef<DOMRect | null>(null)
  const closing = useRef(onClose)
  closing.current = onClose
  const [place, setPlace] = useState({ left: -9999, top: 0 })
  const [mode, setMode] = useState(savedPlane)
  const choose = (next: Plane) => {
    setMode(next)
    try {
      localStorage.setItem(planeKey, next)
    } catch {
      // kept for this picker only
    }
  }
  const hc = mode === "hc"
  const hex = lchToHex(color)
  const hexField = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (hexField.current && document.activeElement !== hexField.current) hexField.current.value = hex
  }, [hex])
  const once = (next: Partial<OKLCH>, guard = true) => {
    onStart(guard)
    onChange(next)
    onEnd()
  }

  // beside its swatch, below it, or above where there's no room below
  useLayoutEffect(() => {
    const follow = () => {
      const box = anchor.getBoundingClientRect()
      const own = panel.current?.getBoundingClientRect()
      const width = own?.width ?? 0
      const height = own?.height ?? 0
      const below = box.bottom + 6
      setPlace({
        left: Math.max(8, Math.min(box.left, innerWidth - width - 8)),
        top:
          below + height > innerHeight - 8
            ? Math.max(8, box.top - height - 6)
            : below,
      })
    }
    follow()
    window.addEventListener("scroll", follow, true)
    window.addEventListener("resize", follow)
    return () => {
      window.removeEventListener("scroll", follow, true)
      window.removeEventListener("resize", follow)
    }
  }, [anchor])

  // It closes on a press anywhere else. Closed from inside, focus would be
  // left with nothing, so it goes back to the swatch.
  useEffect(() => {
    plane.current?.parentElement?.focus({ preventScroll: true })
    const close = (event: Event) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !anchor.contains(target)) {
        // Commit focused hex/numeric inputs before removing them from the DOM.
        // Native blur would otherwise happen after pointerdown unmounted them.
        const focused = document.activeElement
        if (focused instanceof HTMLElement && panel.current?.contains(focused)) focused.blur()
        closing.current()
      }
    }
    document.addEventListener("pointerdown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      if (!document.activeElement || document.activeElement === document.body)
        anchor.focus({ preventScroll: true })
    }
  }, [anchor])

  // the plane's fixed axis: the hue, or in HCL the lightness, so a move
  // along the other one doesn't redraw it
  const fixed = hc ? color.l : color.h
  useEffect(() => {
    const context = plane.current?.getContext("2d")
    if (!context) return
    const image = context.createImageData(WIDTH, HEIGHT)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const at = hc
          ? {
              l: fixed,
              c: (1 - y / (HEIGHT - 1)) * CHROMA,
              h: (x / (WIDTH - 1)) * 360,
            }
          : {
              l: 1 - y / (HEIGHT - 1),
              c: (x / (WIDTH - 1)) * CHROMA,
              h: fixed,
            }
        if (!isInGamut(at)) continue
        const { r, g, b } = fromOKLCH(at)
        const i = (y * WIDTH + x) * 4
        image.data[i] = r * 255
        image.data[i + 1] = g * 255
        image.data[i + 2] = b * 255
        image.data[i + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
  }, [hc, fixed])

  // a drag on the plane or the strip is one edit, from press to release
  const dragging = (read: (x: number, y: number) => Partial<OKLCH>) => {
    const at = (event: PointerEvent<HTMLDivElement>) => {
      // measured at the press, not per move: a drag restyles the preview, and
      // reading layout mid-drag forces that (~25 ms) to run inside the move
      pressed.current ??= event.currentTarget.getBoundingClientRect()
      const box = pressed.current
      return read(
        unit((event.clientX - box.left) / box.width),
        unit((event.clientY - box.top) / box.height),
      )
    }
    return {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        event.currentTarget.setPointerCapture(event.pointerId)
        pressed.current = event.currentTarget.getBoundingClientRect()
        onStart()
        onChange(at(event))
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          onChange(at(event))
      },
      onLostPointerCapture: () => {
        pressed.current = null
        onEnd()
      },
    }
  }
  const keys =
    (step: (by: number, key: string) => Partial<OKLCH> | null) =>
    (event: KeyboardEvent) => {
      const next = step(event.shiftKey ? 10 : 1, event.key)
      if (!next) return
      event.preventDefault()
      once(next)
    }

  return (
    <div
      ref={panel}
      className="te-picker"
      popover="manual"
      role="dialog"
      aria-label={`${name} color`}
      style={place}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <fieldset className="te-picker-modes" aria-label="Plane">
        {(
          [
            ["lc", "L × C", "Lightness and chroma at this hue"],
            ["hc", "H × C", "Hue and chroma at this lightness (HCL)"],
          ] as const
        ).map(([value, label, title]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            title={title}
            onClick={() => choose(value)}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <div
        className="te-picker-plane"
        role="slider"
        tabIndex={0}
        aria-label={hc ? "Hue and chroma" : "Lightness and chroma"}
        aria-valuemin={0}
        aria-valuemax={hc ? 360 : 100}
        aria-valuenow={hc ? Math.round(color.h) : Math.round(color.l * 100)}
        aria-valuetext={
          hc
            ? `Hue ${Math.round(color.h)}°, chroma ${color.c.toFixed(3)}`
            : `Lightness ${Math.round(color.l * 100)}%, chroma ${color.c.toFixed(3)}`
        }
        {...dragging((x, y) =>
          hc
            ? { h: x * 360, c: (1 - y) * CHROMA }
            : { l: 1 - y, c: x * CHROMA },
        )}
        onKeyDown={keys((by, key) => {
          const chroma = (sign: number) => ({
            c: Math.min(CHROMA, Math.max(0, color.c + sign * 0.002 * by)),
          })
          const hue = (sign: number) => ({
            h: (color.h + sign * by + 360) % 360,
          })
          if (key === "ArrowUp")
            return hc ? chroma(1) : { l: unit(color.l + 0.01 * by) }
          if (key === "ArrowDown")
            return hc ? chroma(-1) : { l: unit(color.l - 0.01 * by) }
          if (key === "ArrowRight") return hc ? hue(1) : chroma(1)
          if (key === "ArrowLeft") return hc ? hue(-1) : chroma(-1)
          return null
        })}
      >
        <canvas ref={plane} width={WIDTH} height={HEIGHT} />
        <span
          className="te-picker-mark"
          style={{
            left: `${(hc ? color.h / 360 : unit(color.c / CHROMA)) * 100}%`,
            top: `${(hc ? 1 - unit(color.c / CHROMA) : 1 - color.l) * 100}%`,
            background: hex,
          }}
        />
      </div>
      {hc ? (
        <div
          className="te-picker-hue"
          role="slider"
          tabIndex={0}
          aria-label="Lightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(color.l * 100)}
          style={{ background: lightnesses(color) }}
          {...dragging((x) => ({ l: x }))}
          onKeyDown={keys((by, key) => {
            if (key === "ArrowRight" || key === "ArrowUp")
              return { l: unit(color.l + 0.01 * by) }
            if (key === "ArrowLeft" || key === "ArrowDown")
              return { l: unit(color.l - 0.01 * by) }
            return null
          })}
        >
          <span
            className="te-picker-mark"
            style={{ left: `${color.l * 100}%`, background: hex }}
          />
        </div>
      ) : (
        <div
          className="te-picker-hue"
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(color.h)}
          style={{ background: hues }}
          {...dragging((x) => ({ h: x * 360 }))}
          onKeyDown={keys((by, key) => {
            if (key === "ArrowRight" || key === "ArrowUp")
              return { h: (color.h + by + 360) % 360 }
            if (key === "ArrowLeft" || key === "ArrowDown")
              return { h: (color.h - by + 360) % 360 }
            return null
          })}
        >
          <span
            className="te-picker-mark"
            style={{ left: `${(color.h / 360) * 100}%`, background: hex }}
          />
        </div>
      )}
      <div className="te-picker-row">
        <div className="te-picker-compare">
          <button
            type="button"
            aria-label="Back to the color it had when opened"
            title={`Back to ${lchToHex(original)}`}
            style={{ background: lchToHex(original) }}
            onClick={onRestore}
          />
          <span style={{ background: hex }} />
        </div>
        <input
          ref={hexField}
          className="te-hex"
          aria-label="Hex"
          spellCheck={false}
          defaultValue={hex}
          onBlur={(event) => {
            const typed = parseColour(event.target.value)
            if (typed && toHex(typed) !== hex) once(toOKLCH(typed), false)
            else event.target.value = hex
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <button
          type="button"
          className="te-picker-dropper"
          aria-label="Pick a color from the screen"
          title={
            Dropper
              ? "Pick a color from anywhere on the screen"
              : "This browser can't pick colors from the screen"
          }
          disabled={!Dropper}
          onClick={async () => {
            if (!Dropper) return
            try {
              const picked = parseColour((await new Dropper().open()).sRGBHex)
              if (picked) once(toOKLCH(picked), false)
            } catch {
              // Escape leaves the color as it was
            }
          }}
        >
          <span aria-hidden="true">⌾</span>
        </button>
      </div>
      <div className="te-picker-axes">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is the ScrubNumber */}
        <label>
          L
          <ScrubNumber
            label="Lightness"
            value={color.l}
            min={0}
            max={1}
            step={0.005}
            format={(value) => `${Number((value * 100).toFixed(1))}%`}
            parse={(text) => {
              const number = Number.parseFloat(text.replace(/[^0-9.-]/g, ""))
              return Number.isFinite(number) ? number / 100 : null
            }}
            onStart={onStart}
            onEnd={onEnd}
            onChange={(l) => onChange({ l })}
          />
        </label>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is the ScrubNumber */}
        <label>
          C
          <ScrubNumber
            label="Chroma"
            value={color.c}
            min={0}
            max={CHROMA}
            step={0.002}
            format={(value) => value.toFixed(3)}
            onStart={onStart}
            onEnd={onEnd}
            onChange={(c) => onChange({ c })}
          />
        </label>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is the ScrubNumber */}
        <label>
          H
          <ScrubNumber
            label="Hue"
            value={color.h}
            min={0}
            max={360}
            step={1}
            format={(value) => `${Math.round(value)}°`}
            onStart={onStart}
            onEnd={onEnd}
            onChange={(h) => onChange({ h })}
          />
        </label>
      </div>
    </div>
  )
}

