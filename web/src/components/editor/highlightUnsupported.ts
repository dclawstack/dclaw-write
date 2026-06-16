// TipTap extension: underlines sentences flagged as unsupported by grounding.
// Decorations are computed from a list of claim strings held in plugin state and
// refreshed via a transaction meta, so highlighting updates without losing focus.
import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export const highlightKey = new PluginKey<DecorationSet>("highlight-unsupported");

// Map plain-text character offsets back to ProseMirror document positions.
function decorate(doc: PMNode, phrases: string[]): DecorationSet {
  if (!phrases.length) return DecorationSet.empty;

  const segments: { text: string; from: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) segments.push({ text: node.text, from: pos });
    return true;
  });
  const flat = segments.map((s) => s.text).join("");
  const lower = flat.toLowerCase();

  const toPos = (charIdx: number): number => {
    let acc = 0;
    for (const seg of segments) {
      if (charIdx <= acc + seg.text.length) return seg.from + (charIdx - acc);
      acc += seg.text.length;
    }
    return segments.length ? segments[segments.length - 1].from : 0;
  };

  const decos: Decoration[] = [];
  for (const phrase of phrases) {
    const needle = phrase.trim().toLowerCase();
    if (needle.length < 6) continue;
    const idx = lower.indexOf(needle);
    if (idx === -1) continue;
    decos.push(
      Decoration.inline(toPos(idx), toPos(idx + needle.length), {
        class: "unsupported-claim",
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

export const HighlightUnsupported = Extension.create({
  name: "highlightUnsupported",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const phrases = tr.getMeta(highlightKey) as string[] | undefined;
            if (phrases) return decorate(tr.doc, phrases);
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return highlightKey.getState(state);
          },
        },
      }),
    ];
  },
});
