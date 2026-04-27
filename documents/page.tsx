"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function DocumentsPage() {
  const [file, setFile] = useState<any>(null);

  const upload = async () => {
    if (!file) return;

    await supabase.storage
      .from("documents")
      .upload(`files/${Date.now()}-${file.name}`, file);

    alert("Uploaded");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl mb-4">Upload Evidence</h1>

      <input type="file" onChange={(e) => setFile(e.target.files?.[0])} />

      <button
        onClick={upload}
        className="bg-blue-600 px-4 py-2 mt-3 rounded"
      >
        Upload
      </button>
    </div>
  );
}