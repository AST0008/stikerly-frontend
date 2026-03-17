import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Check,
  Download,
  RefreshCw,
  Loader2,
  ArrowRight,
  MousePointer2,
  MessageCircle,
} from "lucide-react";
import AdminPage from "./AdminPage";

gsap.registerPlugin(useGSAP);

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
  face_slot?: { width: number; height: number; x: number; y: number } | null;
}

function StickerCreator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [resultSticker, setResultSticker] = useState<string | null>(null);
  const [failedTemplateIds, setFailedTemplateIds] = useState<Set<string>>(
    new Set(),
  );

  // Template gallery
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function getWhatsAppShareHref(stickerUrl: string) {
    const shareTarget = stickerUrl.split("?")[0];
    const shareText = `I made this with Stickerly 🎉 ${shareTarget}`;
    const encodedText = encodeURIComponent(shareText);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      return `intent://send?text=${encodedText}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }

    return `https://wa.me/?text=${encodedText}`;
  }

  // Intro Animation with GSAP
  useGSAP(
    () => {
      const tl = gsap.timeline();
      tl.from(".gsap-fade-up", {
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.15,
        ease: "back.out(1.7)",
      });
    },
    { scope: containerRef },
  );

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
    if (!t.face_slot) return false;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  // Stagger animate templates when they render
  useEffect(() => {
    if (!templatesLoading && filtered.length > 0) {
      gsap.fromTo(
        ".meme-card",
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.5,
          ease: "power2.out",
          clearProps: "opacity,transform",
        },
      );
    }
  }, [templatesLoading, search]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setPreviewUrl(URL.createObjectURL(event.target.files[0]));
      setResultSticker(null);
      // Small pop animation
      gsap.fromTo(
        ".photo-preview-img",
        { scale: 0.8 },
        { scale: 1, duration: 0.4, ease: "back.out(2)" },
      );
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setPreviewUrl(URL.createObjectURL(e.dataTransfer.files[0]));
      setResultSticker(null);
      gsap.fromTo(
        ".photo-preview-img",
        { scale: 0.8 },
        { scale: 1, duration: 0.4, ease: "back.out(2)" },
      );
    }
  }

  function handleSubmit() {
    setResultSticker(null);
    if (!file) {
      // Shake effect if forgotten
      gsap.fromTo(
        ".upload-zone",
        { x: -10 },
        {
          x: 10,
          duration: 0.1,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            gsap.set(".upload-zone", { x: 0 });
          },
        },
      );
      return;
    }
    setIsLoading(true);
    setLoadingStep("Extracting...");

    const steps = ["Detecting face...", "Compositing...", "Finishing..."];
    let stepIndex = 0;

    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (stepIndex < steps.length) {
          const nextStep = steps[stepIndex];
          stepIndex++;
          return nextStep;
        }
        return prev;
      });
    }, 1500);

    const formData = new FormData();
    formData.append("file", file);
    if (selectedId) formData.append("template_id", selectedId);

    fetch(`${API_BASE}/create-sticker`, { method: "POST", body: formData })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.detail || "Server error occurred");
        }
        return data;
      })
      .then((data) => {
        if (data.final_meme_url) {
          setResultSticker(`${data.final_meme_url}?t=${Date.now()}`);
          // Wait for DOM to render result sticker, then animate it in
          setTimeout(() => {
            gsap.fromTo(
              ".result-card",
              { y: 50, opacity: 0, rotate: -5 },
              {
                y: 0,
                opacity: 1,
                rotate: 0,
                duration: 0.6,
                ease: "back.out(1.5)",
              },
            );
          }, 50);
        }
      })
      .catch((e) => {
        alert(`Failed to create sticker: ${e.message}`);
        gsap.fromTo(
          ".submit-btn",
          { x: -10 },
          {
            x: 10,
            duration: 0.1,
            yoyo: true,
            repeat: 3,
            backgroundColor: "#ff5c5c",
            onComplete: () => {
              gsap.set(".submit-btn", { x: 0 });
              setTimeout(
                () =>
                  gsap.set(".submit-btn", { clearProps: "backgroundColor" }),
                1000,
              );
            },
          },
        );
      })
      .finally(() => {
        clearInterval(interval);
        setIsLoading(false);
        setLoadingStep("");
      });
  }

  return (
    <div
      ref={containerRef}
      className="max-w-7xl mx-auto px-4 md:px-8 py-8 w-full"
    >
      {/* HEADER */}
      <header className="gsap-fade-up mb-12 flex flex-col md:flex-row items-center justify-between gap-6 border-b-4 border-black pb-6">
        <div>
          <h1
            className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none"
            style={{
              WebkitTextStroke: "2px black",
              color: "var(--color-brutal-yellow)",
            }}
          >
            Stickerly
          </h1>
          <p className="text-xl md:text-2xl font-bold font-mono mt-2 bg-black text-white inline-block px-3 py-1 -skew-x-6">
            // MAKE MEMES RAW
          </p>
        </div>
        <a
          href="#/admin"
          className="font-bold uppercase border-2 border-black bg-white px-6 py-2 brutal-shadow transition-transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
        >
          Admin Config
        </a>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* LEFT COLUMN: UPLOAD & ACTIONS */}
        <div className="lg:col-span-5 flex flex-col gap-8 gsap-fade-up">
          <div className="bg-white border-4 border-black p-6 md:p-8 brutal-shadow relative">
            <div className="absolute -top-5 -left-5 bg-[var(--color-brutal-pink)] text-black border-2 border-black font-black px-4 py-2 text-xl -rotate-6">
              STEP 1
            </div>

            <h2 className="text-3xl font-black uppercase mb-6 mt-2">
              Drop Portrait
            </h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="upload-zone border-4 border-dashed border-black bg-gray-50 hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer min-h-[300px] flex flex-col items-center justify-center p-4 relative overflow-hidden"
            >
              <input
                type="file"
                className="hidden"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="w-full h-full p-2">
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="photo-preview-img w-full h-[300px] object-cover border-2 border-black shadow-[4px_4px_0_0_#000]"
                  />
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white font-mono font-bold text-xl uppercase tracking-widest">
                      <RefreshCw className="inline mr-2" /> Switch
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <MousePointer2 className="w-16 h-16 mx-auto stroke-[1.5]" />
                  <p className="text-2xl font-bold uppercase">Click or Drag</p>
                  <p className="font-mono font-bold bg-white border-2 border-black px-3 py-1 inline-block">
                    JPG / PNG / WEBP
                  </p>
                </div>
              )}
            </div>

            {/* ACTION BUTTON */}
            <button
              className="submit-btn mt-6 w-full py-5 px-6 font-black text-2xl uppercase tracking-wider border-4 border-black bg-[var(--color-brutal-blue)] text-black brutal-shadow transition-transform active:translate-y-2 active:translate-x-2 active:shadow-none disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
              onClick={handleSubmit}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin w-8 h-8" /> {loadingStep}
                </>
              ) : (
                <>
                  <ArrowRight className="w-8 h-8" strokeWidth={3} /> Smash to
                  Create
                </>
              )}
            </button>
          </div>

          {/* RESULT AREA */}
          {resultSticker && (
            <div className="result-card bg-white border-4 border-black p-6 brutal-shadow flex flex-col items-center relative z-10">
              <div className="absolute -top-4 -right-4 bg-[var(--color-brutal-yellow)] text-black border-2 border-black font-black px-4 py-1 text-lg rotate-12">
                SUCCESS!
              </div>
              <img
                src={resultSticker}
                className="w-full max-w-[300px] object-contain border-2 border-black bg-gray-100 p-2 mb-6"
                alt="MEME"
              />

              <a
                href={resultSticker}
                download
                target="_blank"
                rel="noreferrer"
                className="w-full text-center bg-[#00e676] text-black border-4 border-black py-4 font-black uppercase text-xl brutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] transition-all"
              >
                <Download className="inline-block mr-2" strokeWidth={3} /> Grab
                It
              </a>

              <a
                href={getWhatsAppShareHref(resultSticker)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 w-full text-center bg-[#25D366] text-black border-4 border-black py-4 font-black uppercase text-xl brutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] transition-all"
              >
                <MessageCircle className="inline-block mr-2" strokeWidth={3} />
                Share on WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TEMPLATES */}
        <div className="lg:col-span-7 gsap-fade-up">
          <div className="bg-white border-4 border-black p-6 md:p-8 brutal-shadow relative min-h-[700px] flex flex-col">
            <div className="absolute -top-5 -left-5 bg-[var(--color-brutal-blue)] text-black border-2 border-black font-black px-4 py-2 text-xl rotate-3">
              STEP 2
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 mt-2 gap-4">
              <h2 className="text-4xl font-black uppercase leading-none">
                Select Base
              </h2>
              <input
                type="text"
                placeholder="Search..."
                className="w-full sm:w-64 border-4 border-black px-4 py-2 font-mono font-bold focus:bg-[var(--color-brutal-yellow)] outline-none transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Template Gallery Grid */}
            <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6 custom-scroll">
              {templatesLoading && (
                <div className="h-full flex items-center justify-center">
                  <div className="font-black text-2xl uppercase tracking-widest animate-pulse">
                    Loading templates...
                  </div>
                </div>
              )}

              {templatesError && (
                <div className="bg-red-400 border-4 border-black p-4 font-bold text-xl uppercase">
                  Error: {templatesError}
                </div>
              )}

              {!templatesLoading && !templatesError && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  {/* Random Button */}
                  <button
                    onClick={() => setSelectedId(null)}
                    className={`meme-card relative flex flex-col items-center justify-center p-6 border-4 border-black transition-all font-black text-2xl uppercase ${selectedId === null ? "bg-[var(--color-brutal-yellow)] shadow-[8px_8px_0_0_#000] -translate-y-2" : "bg-gray-100 hover:bg-gray-200"}`}
                    style={{ aspectRatio: "4/3" }}
                  >
                    <span className="text-6xl mb-4">🎲</span>
                    ANYTHING
                    {selectedId === null && (
                      <Check
                        className="absolute top-2 right-2 w-8 h-8 pointer-events-none"
                        strokeWidth={4}
                      />
                    )}
                  </button>

                  {/* Filtered Templates */}
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`meme-card relative flex flex-col items-center justify-end p-2 border-4 border-black transition-all overflow-hidden ${selectedId === t.id ? "bg-[var(--color-brutal-pink)] shadow-[8px_8px_0_0_#000] -translate-y-2" : "bg-white hover:bg-gray-100"}`}
                      style={{ aspectRatio: "4/3" }}
                    >
                      <div className="w-full h-full absolute inset-0 p-4 pb-14">
                        {!failedTemplateIds.has(t.id) ? (
                          <img
                            src={`${API_BASE}/templates-static/${encodeURIComponent(t.filename)}`}
                            alt={t.name}
                            className="w-full h-full object-contain mix-blend-multiply"
                            onError={() => {
                              setFailedTemplateIds((prev) => {
                                const next = new Set(prev);
                                next.add(t.id);
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-black bg-gray-200 flex items-center justify-center text-xs font-mono font-bold px-2 text-center">
                            PREVIEW
                          </div>
                        )}
                      </div>
                      <div className="w-full bg-black text-white p-2 font-mono font-bold truncate text-center z-10 bottom-0 relative">
                        {t.name}
                      </div>

                      {selectedId === t.id && (
                        <div className="absolute top-2 right-2 bg-black text-white p-1 border-2 border-white rounded-full z-20">
                          <Check
                            className="w-5 h-5 pointer-events-none"
                            strokeWidth={4}
                          />
                        </div>
                      )}
                    </button>
                  ))}

                  {filtered.length === 0 && search && (
                    <div className="col-span-full border-4 border-dashed border-black p-12 text-center text-2xl font-black uppercase bg-gray-200">
                      NO MATCHES FOUND.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
