import { useEffect } from "react";

export default function DownloadDoc() {
  useEffect(() => {
    const link = document.createElement("a");
    link.href = "/docs/rukisha-ai-technical-architecture.md";
    link.download = "Rukisha-AI-Technical-Architecture.md";
    link.click();
    window.history.back();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Downloading document...</p>
    </div>
  );
}
