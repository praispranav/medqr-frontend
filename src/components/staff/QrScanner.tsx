'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Icon } from '@/components/patient/ui';

// Reads the QR code on the patient's own token screen (just the raw token id — see
// patient/[subdomain]/queue/[tokenId]/page.tsx) via the device camera, so reception can scan
// instead of typing the token number. No server round-trip: decoding happens entirely in the
// browser with jsQR, frame by frame, off a <video> feed.

export function QrScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        raf = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
      if (code?.data && !scannedRef.current) {
        scannedRef.current = true;
        onScan(code.data);
        return; // parent unmounts us on a successful scan
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => undefined);
        }
        raf = requestAnimationFrame(tick);
      })
      .catch((e: Error) => {
        setError(
          e.name === 'NotAllowedError'
            ? "Camera access was blocked. Allow it in your browser's site settings, or type the token number instead."
            : e.name === 'NotFoundError'
              ? 'No camera found on this device. Type the token number instead.'
              : "Couldn't start the camera. Type the token number instead.",
        );
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm flex items-center gap-2">
            <Icon name="qr_code_scanner" className="text-primary text-[22px]" />
            Scan patient&apos;s token
          </h2>
          <button onClick={onClose} aria-label="Close scanner" className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {error ? (
          <p className="font-body-md text-body-md text-error py-8 text-center">{error}</p>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-8 border-2 border-white/70 rounded-xl pointer-events-none" />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
          Hold the QR code on the patient&apos;s phone up to the camera.
        </p>
      </div>
    </div>
  );
}
