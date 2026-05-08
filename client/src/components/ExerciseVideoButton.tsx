import { useEffect, useState } from "react";

type EmbedInfo =
  | { kind: "youtube"; embedSrc: string; videoId: string; thumbUrl: string }
  | { kind: "vimeo"; embedSrc: string; videoId: string }
  | { kind: "direct"; src: string }
  | { kind: "external"; src: string };

// Best-effort URL parsing. We avoid throwing for malformed URLs so the
// component is safe to use with whatever string the admin pasted.
export function getEmbedInfo(rawUrl: string): EmbedInfo {
  const url = rawUrl.trim();
  // YouTube — supports watch?v=, youtu.be/, /embed/, /shorts/, with optional
  // query params or trailing slashes.
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/i,
  );
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      kind: "youtube",
      videoId,
      embedSrc: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
      thumbUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  // Vimeo — vimeo.com/{id} or player.vimeo.com/video/{id}
  const vmMatch = url.match(
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i,
  );
  if (vmMatch) {
    const videoId = vmMatch[1];
    return {
      kind: "vimeo",
      videoId,
      embedSrc: `https://player.vimeo.com/video/${videoId}?autoplay=1`,
    };
  }
  // Direct video file
  if (/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(url)) {
    return { kind: "direct", src: url };
  }
  return { kind: "external", src: url };
}

function PlayIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExerciseVideoModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title?: string;
  onClose: () => void;
}) {
  const info = getEmbedInfo(url);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 18%)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{title ?? "فيديو التمرين"}</p>
            <p className="text-xs text-muted-foreground truncate">{info.kind === "external" ? "مصدر خارجي" : info.kind === "direct" ? "ملف فيديو" : info.kind}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="bg-black" style={{ aspectRatio: "16 / 9" }}>
          {info.kind === "youtube" && (
            <iframe
              src={info.embedSrc}
              title="YouTube video"
              className="w-full h-full"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          {info.kind === "vimeo" && (
            <iframe
              src={info.embedSrc}
              title="Vimeo video"
              className="w-full h-full"
              frameBorder={0}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}
          {info.kind === "direct" && (
            <video
              src={info.src}
              className="w-full h-full"
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          )}
          {info.kind === "external" && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                لا يمكن تشغيل الفيديو داخل التطبيق. اضغط الزر بالأسفل لفتحه في تبويب جديد.
              </p>
              <a
                href={info.src}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: "hsl(40 65% 48%)", color: "#000" }}
              >
                فتح الفيديو
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ExerciseVideoButtonProps {
  url: string | null | undefined;
  title?: string;
  /**
   * Visual style: "chip" is a small inline pill (default; matches the legacy
   * "فيديو" pill), "thumb" shows the YouTube thumbnail (when available) with a
   * play overlay, "icon" is an icon-only button.
   */
  variant?: "chip" | "thumb" | "icon";
  className?: string;
  /** Optional inline style override applied to the chip/icon button. */
  style?: React.CSSProperties;
  /** Custom label for the chip variant (defaults to "فيديو"). */
  label?: string;
}

export default function ExerciseVideoButton({
  url,
  title,
  variant = "chip",
  className,
  style,
  label,
}: ExerciseVideoButtonProps) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  const info = getEmbedInfo(url);

  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  if (variant === "thumb" && info.kind === "youtube") {
    return (
      <>
        <button
          type="button"
          onClick={click}
          className={`relative group rounded-lg overflow-hidden flex-shrink-0 ${className ?? ""}`}
          style={{ width: 96, height: 54, background: "hsl(0 0% 14%)", ...style }}
          aria-label="عرض الفيديو"
        >
          <img src={info.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          <span
            className="absolute inset-0 flex items-center justify-center transition-colors"
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "hsl(40 65% 48%)", color: "#000" }}
            >
              <PlayIcon className="w-3 h-3" />
            </span>
          </span>
        </button>
        {open && <ExerciseVideoModal url={url} title={title} onClose={() => setOpen(false)} />}
      </>
    );
  }

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={click}
          aria-label="عرض الفيديو"
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${className ?? ""}`}
          style={{
            background: "hsl(40 65% 48% / 0.15)",
            color: "hsl(40 65% 60%)",
            ...style,
          }}
        >
          <PlayIcon className="w-3 h-3" />
        </button>
        {open && <ExerciseVideoModal url={url} title={title} onClose={() => setOpen(false)} />}
      </>
    );
  }

  // Default chip
  return (
    <>
      <button
        type="button"
        onClick={click}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${className ?? ""}`}
        style={{
          background: "hsl(40 65% 48% / 0.12)",
          color: "hsl(40 65% 60%)",
          ...style,
        }}
      >
        <PlayIcon className="w-3 h-3" />
        {label ?? "فيديو"}
      </button>
      {open && <ExerciseVideoModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
