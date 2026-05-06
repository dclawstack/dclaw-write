import Link from "next/link";
import { FileText } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <FileText className="h-16 w-16 text-[#4F46E5] mb-6" />
      <h1 className="text-4xl font-bold text-[#4F46E5] mb-4">DClaw Write</h1>
      <p className="text-lg text-gray-600 mb-8">Long-form writing, blogging & books</p>
      <Link
        href="/dashboard"
        className="rounded-md bg-[#4F46E5] px-6 py-3 text-white font-medium hover:bg-[#3730a3] transition-colors"
      >
        Open Dashboard
      </Link>
    </main>
  );
}
