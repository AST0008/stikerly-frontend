import { useEffect, useRef, useState } from "react";
import "./AdminPage.css";

const API_BASE = "http://localhost:8000";

interface FaceSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Template {
  id: string;
  name: string;
  filename: string;
  tags: string[];
  face_slot: FaceSlot;
}

interface UploadResult {
  filename: string;
  image_url: string;
  face_slot: FaceSlot | null;
  face_detected: boolean;
}

type Tab = "upload" | "manage";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>(
    () => localStorage.getItem("admin_key") ?? "",
  );
  const [tab, setTab] = useState<Tab>("upload");

  // ── Upload & Create ──────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template form fields
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formFaceSlot, setFormFaceSlot] = useState<FaceSlot>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ── Manage ───────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Persist admin key
  useEffect(() => {
    localStorage.setItem("admin_key", adminKey);
  }, [adminKey]);

  // Auto-load templates when switching to manage tab
  useEffect(() => {
    if (tab === "manage") fetchTemplates();
  }, [tab]);

  // Populate face_slot form fields from upload result
  useEffect(() => {
    if (uploadResult?.face_slot) {
      setFormFaceSlot(uploadResult.face_slot);
    }
  }, [uploadResult]);

  function headers() {
    return { "x-admin-key": adminKey };
  }

  // ── Upload image ─────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setUploadResult(null);
    setUploadError(null);
    setSaveMsg(null);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    setSaveMsg(null);

    const body = new FormData();
    body.append("file", uploadFile);

    try {
      const res = await fetch(`${API_BASE}/admin/templates/upload`, {
        method: "POST",
        headers: headers(),
        body,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? res.statusText);
      }
      const data: UploadResult = await res.json();
      setUploadResult(data);
      // Pre-fill filename in form
      if (!formId) setFormId(data.filename.replace(/\.[^.]+$/, ""));
      if (!formName) setFormName(data.filename.replace(/\.[^.]+$/, ""));
    } catch (e: unknown) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // ── Save template ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!uploadResult) return;
    if (!formId.trim() || !formName.trim()) {
      setSaveMsg("ID and Name are required.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);

    const payload = {
      id: formId.trim(),
      name: formName.trim(),
      filename: uploadResult.filename,
      tags: formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      face_slot: formFaceSlot,
    };

    try {
      const res = await fetch(`${API_BASE}/admin/templates`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? res.statusText);
      }
      setSaveMsg("Template saved successfully!");
      // Reset form
      setUploadFile(null);
      setPreviewUrl(null);
      setUploadResult(null);
      setFormId("");
      setFormName("");
      setFormTags("");
      setFormFaceSlot({ x: 0, y: 0, width: 0, height: 0 });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: unknown) {
      setSaveMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Fetch templates ──────────────────────────────────────────────────────
  async function fetchTemplates() {
    setLoadingTemplates(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/templates`, {
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? res.statusText);
      }
      const data: Template[] = await res.json();
      setTemplates(data);
    } catch (e: unknown) {
      setLoadError((e as Error).message);
    } finally {
      setLoadingTemplates(false);
    }
  }

  // ── Delete template ──────────────────────────────────────────────────────
  async function handleDelete(id: string, deleteFile: boolean) {
    if (
      !confirm(`Delete template "${id}"${deleteFile ? " and its file" : ""}?`)
    )
      return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/templates/${id}?delete_file=${deleteFile}`,
        { method: "DELETE", headers: headers() },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? res.statusText);
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: unknown) {
      alert(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="admin-page">
      <header className="admin-header">
        <a href="#" className="admin-back" title="Back to app">
          ← App
        </a>
        <h1>Stickerly Admin</h1>
        <div className="admin-key-row">
          <label htmlFor="admin-key">Admin Key</label>
          <input
            id="admin-key"
            type="password"
            placeholder="Enter admin key..."
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
        </div>
      </header>

      <nav className="admin-tabs">
        <button
          className={tab === "upload" ? "active" : ""}
          onClick={() => setTab("upload")}
        >
          Upload Template
        </button>
        <button
          className={tab === "manage" ? "active" : ""}
          onClick={() => setTab("manage")}
        >
          Manage Templates
        </button>
      </nav>

      {/* ── Upload Tab ─────────────────────────────────────────────────── */}
      {tab === "upload" && (
        <section className="admin-section">
          <h2>Upload &amp; Create Template</h2>

          {/* Step 1: Upload image */}
          <div className="upload-step card">
            <h3>Step 1 — Upload Image</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
            />
            {previewUrl && (
              <div className="preview-wrap">
                <img src={previewUrl} alt="preview" className="preview-img" />
              </div>
            )}
            <button
              className="btn-primary"
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
            >
              {uploading ? "Uploading..." : "Upload Image"}
            </button>
            {uploadError && <p className="msg error">{uploadError}</p>}
            {uploadResult && (
              <div className="upload-result">
                <p className="msg success">
                  Uploaded: <strong>{uploadResult.filename}</strong>
                </p>
                <p>
                  Face detected:{" "}
                  <strong>{uploadResult.face_detected ? "Yes" : "No"}</strong>
                </p>
                {uploadResult.face_slot && (
                  <p className="face-slot-info">
                    Face slot — x:{uploadResult.face_slot.x} y:
                    {uploadResult.face_slot.y} w:{uploadResult.face_slot.width}{" "}
                    h:{uploadResult.face_slot.height}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Fill details */}
          {uploadResult && (
            <div className="form-step card">
              <h3>Step 2 — Fill Details</h3>

              <div className="form-grid">
                <label>Template ID *</label>
                <input
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="e.g. funky-frame-01"
                />

                <label>Name *</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Funky Frame"
                />

                <label>Tags</label>
                <input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="comma-separated, e.g. fun, birthday, colorful"
                />

                <label>Face Slot</label>
                <div className="face-slot-fields">
                  {(["x", "y", "width", "height"] as (keyof FaceSlot)[]).map(
                    (k) => (
                      <label key={k} className="fs-field">
                        <span>{k}</span>
                        <input
                          type="number"
                          value={formFaceSlot[k]}
                          onChange={(e) =>
                            setFormFaceSlot((prev) => ({
                              ...prev,
                              [k]: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
              </div>

              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
              {saveMsg && (
                <p
                  className={`msg ${saveMsg.startsWith("Error") ? "error" : "success"}`}
                >
                  {saveMsg}
                </p>
              )}
            </div>
          )}

          {/* Standalone save message after reset */}
          {!uploadResult && saveMsg && <p className="msg success">{saveMsg}</p>}
        </section>
      )}

      {/* ── Manage Tab ─────────────────────────────────────────────────── */}
      {tab === "manage" && (
        <section className="admin-section">
          <div className="manage-header">
            <h2>Manage Templates</h2>
            <button className="btn-secondary" onClick={fetchTemplates}>
              {loadingTemplates ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadError && <p className="msg error">{loadError}</p>}

          {!loadingTemplates && templates.length === 0 && !loadError && (
            <p className="empty-state">No templates found.</p>
          )}

          <div className="template-grid">
            {templates.map((t) => (
              <div key={t.id} className="template-card">
                <img
                  src={`${API_BASE}/templates-static/${t.filename}`}
                  alt={t.name}
                  className="template-thumb"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
                <div className="template-info">
                  <p className="template-name">{t.name}</p>
                  <p className="template-id">ID: {t.id}</p>
                  <p className="template-tags">
                    {t.tags.length ? t.tags.join(", ") : <em>no tags</em>}
                  </p>
                  {t.face_slot && (
                    <p className="template-face">
                      Face: {t.face_slot.x},{t.face_slot.y} {t.face_slot.width}×
                      {t.face_slot.height}
                    </p>
                  )}
                </div>
                <div className="template-actions">
                  <button
                    className="btn-danger-outline"
                    disabled={deletingId === t.id}
                    onClick={() => handleDelete(t.id, false)}
                  >
                    Delete
                  </button>
                  <button
                    className="btn-danger"
                    disabled={deletingId === t.id}
                    onClick={() => handleDelete(t.id, true)}
                  >
                    Delete + File
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
