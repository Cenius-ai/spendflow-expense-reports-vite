import { useState } from "react";

import { Modal } from "./Overlays.jsx";

export default function DecisionDialog({ report, onCancel, onConfirm, busy, error }) {
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    if (!note.trim()) {
      setLocalError("Add a note explaining the rejection");
      return;
    }
    setLocalError("");
    onConfirm(note.trim());
  }

  return (
    <Modal
      title={`Reject “${report.title}”`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="decision-form" className="btn btn--danger" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : "Reject report"}
          </button>
        </>
      }
    >
      <form id="decision-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="decision-note">
            Note for {report.owner_name}
          </label>
          <textarea
            id="decision-note"
            className="textarea"
            name="note"
            placeholder="Missing the client dinner receipt — please re-submit with the itemised bill."
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              if (localError) setLocalError("");
            }}
            aria-invalid={localError ? "true" : undefined}
            aria-describedby="decision-note-hint"
          />
          <span className="field__hint" id="decision-note-hint">
            The employee sees this note on their report. A note is required to reject.
          </span>
          {localError ? (
            <span className="field__error" role="alert">
              {localError}
            </span>
          ) : null}
          {error ? (
            <span className="field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
