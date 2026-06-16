import { Editor } from "@/components/Editor";

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <Editor documentId={id ?? null} />;
}
