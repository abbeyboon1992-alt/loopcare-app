"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NotesPage() {
  const { id } = useParams();
  const router = useRouter();

  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, [id]);

  const loadNotes = async () => {
    const { data } = await supabase
      .from("visit_notes")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });

    if (data) setNotes(data);
    setLoading(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    const { error } = await supabase.from("visit_notes").insert({
      client_id: id,
      notes: newNote,
    });

    if (error) {
      alert("Error saving note");
      return;
    }

    setNewNote("");
    loadNotes();
  };

  if (loading) {
    return <div className="p-6 text-[var(--text)]">Loading notes...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">

      {/* 🔙 BACK */}
      <button
        onClick={() => router.back()}
        className="mb-6 text-blue-400"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Notes
      </h1>

      {/* ✍️ QUICK ADD */}
      <div className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg mb-6">

        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a note..."
          className="w-full p-3 text-base rounded bg-[var(--card)] mb-3"
        />

        <button
          onClick={addNote}
          className="bg-green-600 px-4 py-2 rounded"
        >
          Add Note
        </button>

      </div>

      {/* 📜 HISTORY */}
      <div className="space-y-3">

        {notes.length === 0 && (
          <p className="text-gray-500">
            No notes yet
          </p>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            className="bg-[var(--card)] p-3 sm:p-4 md:p-5 rounded-lg-lg"
          >
            <p className="text-sm text-[var(--muted)] mb-2">
              {new Date(note.created_at).toLocaleString()}
            </p>

            <p>{note.notes}</p>
          </div>
        ))}

      </div>

    </div>
  );
}