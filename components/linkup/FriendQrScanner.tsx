"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type BarcodeDetectorLike = {
  detect(video: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

export default function FriendQrScanner({ action }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "unsupported" | "denied" | "found" | "error">("idle");
  const [token, setToken] = useState("");

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function startScanner() {
    setState("starting");
    const BarcodeDetectorCtor = (globalThis as unknown as { BarcodeDetector?: new () => BarcodeDetectorLike }).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setState("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setState("scanning");
      const detector = new BarcodeDetectorCtor();
      let active = true;
      const scan = async () => {
        if (!active || !videoRef.current) return;
        try {
          const result = await detector.detect(videoRef.current);
          const value = result.find((item) => item.rawValue)?.rawValue?.trim();
          if (value) {
            active = false;
            setToken(value);
            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setState("found");
            return;
          }
        } catch {
          setState("error");
        }
        if (active) window.requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch {
      setState("denied");
    }
  }

  const message = state === "unsupported" ? "QR scanning is not supported in this browser. Use Friend Code instead." : state === "denied" ? "Camera access was denied. You can still add a friend with their Friend Code." : state === "error" ? "The camera could not read this QR. Try again or use Friend Code." : state === "found" ? "QR found. Confirm to send the friend request." : state === "scanning" ? "Point the camera at a Nightly Friend QR." : "Scan a Friend QR in person to start a request.";

  return (
    <section className="nightly-surface-elevated p-5 sm:p-6">
      <p className="nightly-eyebrow">Friend QR</p>
      <h1 className="nightly-section-title mt-2">Scan a friend&apos;s QR.</h1>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">The server validates the signed token. Your camera stops as soon as a code is found or you leave this page.</p>
      <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/40">
        <video ref={videoRef} muted playsInline className={`aspect-square w-full object-cover ${state === "scanning" ? "block" : "hidden"}`} aria-label="Friend QR camera preview" />
        {state !== "scanning" ? <div className="grid aspect-square place-items-center p-6 text-center text-sm text-[color:var(--text-secondary)]">{message}</div> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {state !== "scanning" && state !== "found" ? <button type="button" onClick={() => void startScanner()} className="nightly-btn-primary min-h-11 rounded-full px-5 text-sm">{state === "starting" ? "Opening camera..." : "Open camera"}</button> : null}
        {state === "found" ? <form action={action}><input type="hidden" name="qrToken" value={token} /><button type="submit" className="nightly-btn-primary min-h-11 rounded-full px-5 text-sm">Confirm friend request</button></form> : null}
        <Link href="/crews#friend-code" className="nightly-btn-secondary min-h-11 rounded-full px-5 text-sm">Use Friend Code</Link>
      </div>
    </section>
  );
}
