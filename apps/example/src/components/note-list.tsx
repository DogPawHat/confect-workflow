import { useMutation, useQuery } from "@confect/react";
import { Array } from "effect";
import refs from "../../confect/_generated/refs.js";

function NoteList() {
  const notes = useQuery(refs.public.notesAndRandom.notes.list, {});

  const deleteNote = useMutation(refs.public.notesAndRandom.notes.delete_);

  if (notes === undefined) {
    return <p>Loading…</p>;
  }

  return (
    <ul>
      {Array.map(notes, (note) => (
        <li key={note._id}>
          <p>{note.text}</p>
          <button
            type="button"
            onClick={() => void deleteNote({ noteId: note._id })}
          >
            Delete note
          </button>
        </li>
      ))}
    </ul>
  );
}

export default NoteList;
