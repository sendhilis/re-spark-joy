import { useState, useEffect } from "react";
import { FileDown, ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function DownloadDoc() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/docs/rukisha-ai-technical-architecture.md")
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Rukisha-AI-Technical-Architecture.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  return (
    <>
      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadMd} className="gap-2">
              <FileDown className="h-4 w-4" />
              Download .md
            </Button>
            <Button size="sm" onClick={handleExportPdf} className="gap-2">
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Document content */}
      <article className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        <div className="prose prose-sm sm:prose dark:prose-invert max-w-none
          prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
          prose-table:text-sm prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2
          prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-xs
          prose-code:text-primary prose-code:text-sm
          print:prose print:prose-sm print:text-black
          [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border
          print:[&_th]:border-gray-400 print:[&_td]:border-gray-400">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </article>
    </>
  );
}
