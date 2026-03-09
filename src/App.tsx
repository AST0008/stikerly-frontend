import { useEffect, useState } from "react";
import "./App.css";
import AdminPage from "./AdminPage";

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash;
}

function App() {
  const hash = useHash();

  if (hash === "#/admin") return <AdminPage />;

  return <StickerCreator />;
}

const API_BASE = "http://localhost:8000";

interface Template {
  id: string;
  name: string;
  filename: string;
  tags: string[];
}

function StickerCreator() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultSticker, setResultSticker] = useState<string | null>(null);

  // Template gallery
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/admin/templates`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data: Template[]) => setTemplates(data))
      .catch((e: Error) => setTemplatesError(e.message))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setPreviewUrl(URL.createObjectURL(event.target.files[0]));
      setResultSticker(null);
    }
  }

  function handleSubmit() {
    if (!file) {
      alert("Please select a file first!");
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    if (selectedId) formData.append("template_id", selectedId);

    fetch(`${API_BASE}/create-sticker`, { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.final_meme_url) setResultSticker(data.final_meme_url);
        alert(`Success! Generated meme: ${data.meme_selected}.`);
      })
      .catch(() => alert("Something went wrong. Check console."))
      .finally(() => setIsLoading(false));
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <div className="App">
      <h1>Stickerly Creator</h1>

      {/* ── Step 1: Template picker ─────────────────────────── */}
      <div className="section">
        <div className="section-header">
          <span className="step-badge">1</span>
          <b>Pick a Template</b>
          {selectedTemplate && (
            <span className="selected-badge">{selectedTemplate.name}</span>
          )}
          {selectedId && (
            <button
              className="clear-btn"
              onClick={() => setSelectedId(null)}
              title="Clear selection (random)"
            >
              ✕ Random
            </button>
          )}
        </div>

        <input
          className="gallery-search"
          type="search"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {templatesLoading && (
          <p className="gallery-status">Loading templates…</p>
        )}
        {templatesError && (
          <p className="gallery-status error">
            Failed to load: {templatesError}
          </p>
        )}

        {!templatesLoading && !templatesError && (
          <>
            {/* Random card */}
            <div className="template-gallery">
              <button
                className={`tpl-card tpl-random${
                  selectedId === null ? " tpl-selected" : ""
                }`}
                onClick={() => setSelectedId(null)}
              >
                <div className="tpl-thumb tpl-thumb-random">🎲</div>
                <span className="tpl-name">Random</span>
              </button>

              {filtered.map((t) => (
                <button
                  key={t.id}
                  className={`tpl-card${
                    selectedId === t.id ? " tpl-selected" : ""
                  }`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <img
                    src={`${API_BASE}/templates-static/${t.filename}`}
                    alt={t.name}
                    className="tpl-thumb"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23222'/%3E%3C/svg%3E";
                    }}
                  />
                  <span className="tpl-name">{t.name}</span>
                  {t.tags.length > 0 && (
                    <span className="tpl-tags">{t.tags.join(", ")}</span>
                  )}
                </button>
              ))}
            </div>

            {filtered.length === 0 && search && (
              <p className="gallery-status">No templates match "{search}"</p>
            )}
          </>
        )}
      </div>

      {/* ── Step 2: Upload photo ────────────────────────────── */}
      <div className="section">
        <div className="section-header">
          <span className="step-badge">2</span>
          <b>Add Your Photo</b>
        </div>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {previewUrl && (
          <img src={previewUrl} alt="preview" className="photo-preview" />
        )}
      </div>

      {/* ── Submit ─────────────────────────────────────────── */}
      <button
        className="create-btn"
        onClick={handleSubmit}
        disabled={!file || isLoading}
      >
        {isLoading ? "Generating…" : "Create Sticker"}
      </button>

      {/* ── Result ─────────────────────────────────────────── */}
      {resultSticker && (
        <div className="result-box">
          <h2>Done!</h2>
          <img src={resultSticker} alt="Final Sticker" className="result-img" />
          <a href={resultSticker} download target="_blank" rel="noreferrer">
            Download
          </a>
        </div>
      )}

      <p className="admin-link">
        <a href="#/admin">Admin Panel</a>
      </p>
    </div>
  );
}

export default App;
