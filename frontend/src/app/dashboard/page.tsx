"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export default function Dashboard() {
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("Blog");
  const [results, setResults] = useState<{
    title: string;
    headings: string[];
    wordCount: number;
  } | null>(null);

  const handleGenerate = () => {
    setResults({
      title: `${topic || "Untitled"} — ${contentType} Outline`,
      headings: ["Introduction", "Main Points", "Evidence & Examples", "Conclusion"],
      wordCount: Math.floor(Math.random() * 4500) + 500,
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-[#4F46E5] px-6 py-4 flex items-center gap-3">
        <FileText className="h-6 w-6 text-white" />
        <h1 className="text-xl font-semibold text-white">DClaw Write</h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Outline Generator</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <textarea
              className="w-full h-32 rounded-lg border border-gray-300 p-4 text-sm focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none resize-none"
              placeholder="Enter topic..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content type</label>
            <select
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none bg-white"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            >
              <option>Blog</option>
              <option>Book</option>
              <option>Email</option>
              <option>Social</option>
            </select>
          </div>
          <button
            onClick={handleGenerate}
            className="rounded-md bg-[#4F46E5] px-6 py-3 text-white font-medium hover:bg-[#3730a3] transition-colors"
          >
            Generate Outline
          </button>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Results</h2>
          {results ? (
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Title</h3>
                <p className="text-xl font-bold text-[#4F46E5]">{results.title}</p>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Headings</h3>
                <ul className="space-y-2">
                  {results.headings.map((h, i) => (
                    <li key={i} className="text-gray-800 text-sm">{i + 1}. {h}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Word Count Estimate</h3>
                <p className="text-3xl font-bold text-[#4F46E5]">{results.wordCount.toLocaleString()} words</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-12 shadow-sm border border-gray-200 text-center text-gray-500">
              Generate an outline to see results
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
