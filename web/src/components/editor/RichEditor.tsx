"use client";

import { useEditor, EditorContent, Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { HighlightUnsupported, highlightKey } from "./highlightUnsupported";

type Props = {
  onTextChange: (text: string) => void;
  onBlur?: () => void;
  unsupported: string[];
  registerHandle: (h: EditorHandle) => void;
};

export type EditorHandle = {
  getText: () => string;
  append: (chunk: string) => void;
  setText: (text: string) => void;
};

export function RichEditor({ onTextChange, onBlur, unsupported, registerHandle }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, HighlightUnsupported],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[55vh] w-full rounded-xl border border-white/10 bg-[var(--panel)] p-4 leading-7 outline-none focus:border-brand",
      },
    },
    onUpdate: ({ editor }) => onTextChange(editor.getText()),
    onBlur: () => onBlur?.(),
  });

  useEffect(() => {
    if (!editor) return;
    registerHandle({
      getText: () => editor.getText(),
      append: (chunk: string) =>
        editor.chain().focus("end").insertContent(chunk).run(),
      setText: (text: string) => editor.commands.setContent(text),
    });
  }, [editor, registerHandle]);

  // Push unsupported-claim phrases into the highlight plugin.
  useEffect(() => {
    if (!editor) return;
    const tr = editor.state.tr.setMeta(highlightKey, unsupported);
    editor.view.dispatch(tr);
  }, [editor, unsupported]);

  return <EditorContent editor={editor as TiptapEditor} />;
}
