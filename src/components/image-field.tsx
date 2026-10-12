"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/upload-image";

/**
 * 썸네일 · 표지 이미지 칸.
 *
 * 파일을 고르면 바로 올라가고, 올라간 주소가 아래 칸에 채워집니다. 폼은 예전처럼 그 주소를
 * 저장하므로, 이미 다른 곳에 올려 둔 그림이라면 주소를 직접 붙여넣어도 됩니다.
 */
export function ImageField({
  name,
  label,
  value,
  onChange,
  onUploaded,
  hint,
}: {
  /** 폼으로 함께 보낼 때의 이름 (주소가 이 이름으로 들어갑니다) */
  name?: string;
  label?: string;
  value: string;
  onChange: (url: string) => void;
  /** 파일을 올려서 주소가 정해졌을 때 — 바로 저장하고 싶은 화면에서 씁니다. */
  onUploaded?: (url: string) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일을 다시 골라도 change 가 나게
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
      onUploaded?.(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지를 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const shown = value.trim();

  return (
    <div>
      {label && <span className="text-sm font-semibold block mb-1.5">{label}</span>}
      <div className="flex items-start gap-3">
        <div className="w-28 shrink-0 aspect-[16/10] rounded-lg overflow-hidden bg-ink-850 border border-ink-800 grid place-items-center">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-2xl opacity-30">🖼️</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-lg border border-ink-600 px-3.5 py-2 text-sm font-semibold hover:border-neon-400/60 transition-colors disabled:opacity-50"
            >
              {busy ? "올리는 중…" : shown ? "다른 이미지로 바꾸기" : "이미지 선택"}
            </button>
            {shown && !busy && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-sm text-ink-400 hover:text-ink-100 transition-colors"
              >
                지우기
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            hidden
            onChange={pick}
          />
          <input
            name={name}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="또는 이미지 주소 붙여넣기"
            aria-label={label ? `${label} 주소` : "이미지 주소"}
            className="w-full rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-1.5 text-xs text-ink-400 placeholder:text-ink-600 focus:border-neon-400/60 focus:text-ink-100 focus:outline-none"
          />
          {error && <p className="text-sm text-punch-400">{error}</p>}
          {hint && !error && <p className="text-xs text-ink-600">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
