"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  addOwnerVenueImageFromBlobAction,
  type AddOwnerVenueImageFromBlobActionResult,
} from "@/app/owner/actions";

const ALLOWED_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

type OwnerBlobImageUploadProps = {
  venueId: number;
};

function extensionForFile(file: File) {
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

export function OwnerBlobImageUpload({ venueId }: OwnerBlobImageUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      const selectedFile = inputRef.current?.files?.[0] ?? null;

      if (!selectedFile) {
        setErrorMessage("Choose an image before uploading.");
        return;
      }

      if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(selectedFile.type)) {
        setErrorMessage("Only JPEG, PNG, WebP, and AVIF are supported.");
        return;
      }

      if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
        setErrorMessage("Image must be 10 MB or smaller.");
        return;
      }

      const extension = extensionForFile(selectedFile);

      if (!extension) {
        setErrorMessage("Could not determine the image file type.");
        return;
      }

      const pathname = `venue-images/${venueId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      try {
        const blob = await upload(pathname, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/owner/images/upload",
          clientPayload: JSON.stringify({ venueId }),
          multipart: selectedFile.size > 4_500_000,
        });

        const result: AddOwnerVenueImageFromBlobActionResult = await addOwnerVenueImageFromBlobAction({
          venueId,
          blobUrl: blob.url,
        });

        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }

        if (inputRef.current) {
          inputRef.current.value = "";
        }

        setSuccessMessage("Image uploaded.");
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setErrorMessage(message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <label htmlFor="owner-image-file" className="text-sm font-medium text-zinc-200">
        Upload from computer
      </label>
      <p className="mt-1 text-xs text-zinc-400">JPEG, PNG, WebP, or AVIF. Up to 10 MB.</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          id="owner-image-file"
          name="imageFile"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/25 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-cyan-100"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Uploading..." : "Upload image"}
        </button>
      </div>
      {successMessage ? (
        <p className="mt-3 text-xs text-emerald-200">{successMessage}</p>
      ) : null}
      {errorMessage ? <p className="mt-3 text-xs text-rose-200">{errorMessage}</p> : null}
    </form>
  );
}
