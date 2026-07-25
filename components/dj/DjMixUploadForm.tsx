"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createDjMixFromBlobAction } from "@/app/dj/mixes/actions";

type DjMixUploadFormProps = {
  djProfileId: number;
};

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
];

const ALLOWED_COVER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const MAX_AUDIO_SIZE_BYTES = 80 * 1024 * 1024;
const MAX_COVER_SIZE_BYTES = 8 * 1024 * 1024;

function audioExtension(file: File) {
  if (file.type === "audio/mpeg") {
    return "mp3";
  }

  if (file.type === "audio/wav" || file.type === "audio/x-wav") {
    return "wav";
  }

  if (file.type === "audio/mp4" || file.type === "audio/x-m4a" || file.type === "audio/m4a") {
    return "m4a";
  }

  if (file.type === "audio/aac") {
    return "aac";
  }

  return null;
}

function coverExtension(file: File) {
  if (file.type === "image/jpeg") {
    return "jpg";
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/avif") {
    return "avif";
  }

  return null;
}

export function DjMixUploadForm({ djProfileId }: DjMixUploadFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const titleRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const genreRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const isPublicRef = useRef<HTMLInputElement | null>(null);
  const isFeaturedRef = useRef<HTMLInputElement | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      const title = titleRef.current?.value?.trim() ?? "";

      if (!title) {
        setErrorMessage("Mix title is required.");
        return;
      }

      const audioFile = audioRef.current?.files?.[0] ?? null;

      if (!audioFile) {
        setErrorMessage("Audio file is required.");
        return;
      }

      if (!ALLOWED_AUDIO_CONTENT_TYPES.includes(audioFile.type)) {
        setErrorMessage("Unsupported audio type. Use MP3, WAV, M4A, or AAC.");
        return;
      }

      if (audioFile.size <= 0) {
        setErrorMessage("Audio file cannot be empty.");
        return;
      }

      if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
        setErrorMessage("Audio file must be 80 MB or smaller.");
        return;
      }

      const audioExt = audioExtension(audioFile);

      if (!audioExt) {
        setErrorMessage("Could not determine audio file extension.");
        return;
      }

      const coverFile = coverRef.current?.files?.[0] ?? null;

      if (coverFile) {
        if (!ALLOWED_COVER_CONTENT_TYPES.includes(coverFile.type)) {
          setErrorMessage("Unsupported cover image type.");
          return;
        }

        if (coverFile.size <= 0) {
          setErrorMessage("Cover image cannot be empty.");
          return;
        }

        if (coverFile.size > MAX_COVER_SIZE_BYTES) {
          setErrorMessage("Cover image must be 8 MB or smaller.");
          return;
        }
      }

      try {
        const audioPath = `dj-mixes/${djProfileId}/audio/${Date.now()}-${crypto.randomUUID()}.${audioExt}`;
        const audioBlob = await upload(audioPath, audioFile, {
          access: "public",
          handleUploadUrl: "/api/dj/mixes/upload",
          clientPayload: JSON.stringify({ djProfileId, uploadType: "audio" }),
          multipart: audioFile.size > 4_500_000,
        });

        let coverUrl: string | null = null;

        if (coverFile) {
          const coverExt = coverExtension(coverFile);

          if (!coverExt) {
            setErrorMessage("Could not determine cover image extension.");
            return;
          }

          const coverPath = `dj-mixes/${djProfileId}/cover/${Date.now()}-${crypto.randomUUID()}.${coverExt}`;
          const coverBlob = await upload(coverPath, coverFile, {
            access: "public",
            handleUploadUrl: "/api/dj/mixes/upload",
            clientPayload: JSON.stringify({ djProfileId, uploadType: "cover" }),
            multipart: coverFile.size > 4_500_000,
          });

          coverUrl = coverBlob.url;
        }

        const result = await createDjMixFromBlobAction({
          title,
          description: descriptionRef.current?.value ?? null,
          genre: genreRef.current?.value ?? null,
          audioUrl: audioBlob.url,
          coverImageUrl: coverUrl,
          isPublic: isPublicRef.current?.checked ?? true,
          isFeatured: isFeaturedRef.current?.checked ?? false,
        });

        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }

        setSuccessMessage("Sample mix uploaded.");
        router.push("/dj/mixes?success=sample-mix-uploaded");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setErrorMessage(message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-5">
      <div>
        <label htmlFor="mix-title" className="mb-2 block text-sm font-medium text-zinc-200">
          Mix title
        </label>
        <input
          ref={titleRef}
          id="mix-title"
          name="title"
          required
          className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
          placeholder="Afterhours Session Vol. 1"
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="mix-description" className="mb-2 block text-sm font-medium text-zinc-200">
          Description
        </label>
        <textarea
          ref={descriptionRef}
          id="mix-description"
          name="description"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
          placeholder="A late-night blend of tech house and afrobeats transitions."
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="mix-genre" className="mb-2 block text-sm font-medium text-zinc-200">
          Genre
        </label>
        <input
          ref={genreRef}
          id="mix-genre"
          name="genre"
          className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
          placeholder="House"
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="mix-audio" className="mb-2 block text-sm font-medium text-zinc-200">
          Audio file
        </label>
        <input
          ref={audioRef}
          id="mix-audio"
          name="audioFile"
          type="file"
          accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/x-m4a,audio/m4a"
          required
          disabled={isPending}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/25 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-cyan-100"
        />
        <p className="mt-2 text-xs text-zinc-400">MP3, WAV, M4A, or AAC. Up to 80 MB.</p>
      </div>

      <div>
        <label htmlFor="mix-cover" className="mb-2 block text-sm font-medium text-zinc-200">
          Cover image (optional)
        </label>
        <input
          ref={coverRef}
          id="mix-cover"
          name="coverImage"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          disabled={isPending}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-full file:border-0 file:bg-violet-500/25 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-100"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="text-sm text-zinc-200">Public mix</span>
          <input ref={isPublicRef} type="checkbox" defaultChecked className="h-4 w-4 accent-cyan-400" />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="text-sm text-zinc-200">Feature this mix</span>
          <input ref={isFeaturedRef} type="checkbox" className="h-4 w-4 accent-violet-400" />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Uploading..." : "Upload sample mix"}
      </button>

      {successMessage ? <p className="text-sm text-emerald-200">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-200">{errorMessage}</p> : null}
    </form>
  );
}
