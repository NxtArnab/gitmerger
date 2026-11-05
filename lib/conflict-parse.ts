export type Segment =
  | { kind: "text"; lines: string[] }
  | {
      kind: "conflict"
      id: number
      current: string[]
      incoming: string[]
      base?: string[]
    }

export type Choice =
  | { type: "current" }
  | { type: "incoming" }
  | { type: "both"; first: "current" | "incoming" }
  | { type: "custom"; text: string }

/** Splits a file containing git conflict markers into plain and conflicted parts. */
export function parseConflicts(text: string): Segment[] {
  const lines = text.split(/\r?\n/)
  const segments: Segment[] = []
  let plain: string[] = []
  let id = 0
  let i = 0

  while (i < lines.length) {
    if (!lines[i].startsWith("<<<<<<<")) {
      plain.push(lines[i++])
      continue
    }
    const current: string[] = []
    const incoming: string[] = []
    let base: string[] | undefined
    let section: "current" | "base" | "incoming" = "current"
    let j = i + 1
    for (; j < lines.length; j++) {
      const line = lines[j]
      if (line.startsWith(">>>>>>>")) break
      if (line.startsWith("|||||||") && section === "current") {
        section = "base"
        base = []
      } else if (line.startsWith("=======") && section !== "incoming") {
        section = "incoming"
      } else if (section === "current") current.push(line)
      else if (section === "base") base!.push(line)
      else incoming.push(line)
    }
    if (j >= lines.length) {
      // Unterminated marker: treat the rest as plain text.
      plain.push(...lines.slice(i))
      break
    }
    if (plain.length) segments.push({ kind: "text", lines: plain })
    plain = []
    segments.push({ kind: "conflict", id: id++, current, incoming, base })
    i = j + 1
  }
  if (plain.length) segments.push({ kind: "text", lines: plain })
  return segments
}

export function resolvedLines(
  seg: Extract<Segment, { kind: "conflict" }>,
  choice: Choice
): string[] {
  switch (choice.type) {
    case "current":
      return seg.current
    case "incoming":
      return seg.incoming
    case "both":
      return choice.first === "current"
        ? [...seg.current, ...seg.incoming]
        : [...seg.incoming, ...seg.current]
    case "custom":
      return choice.text.split(/\r?\n/)
  }
}

export function buildResolved(
  segments: Segment[],
  choices: Record<number, Choice>
): string | null {
  const out: string[] = []
  for (const seg of segments) {
    if (seg.kind === "text") out.push(...seg.lines)
    else {
      const choice = choices[seg.id]
      if (!choice) return null
      out.push(...resolvedLines(seg, choice))
    }
  }
  return out.join("\n")
}
