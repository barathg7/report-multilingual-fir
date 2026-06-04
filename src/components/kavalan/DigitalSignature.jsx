import { useRef, useState, useEffect, useCallback } from "react";
import { Pen, Trash2, CheckCircle, Shield } from "lucide-react";
import Button from "@/components/ui/Button";

export default function DigitalSignature({ label = "Signature", signerName = "", signerRole = "Complainant", onSign, readOnly = false }) {
  const canvasRef   = useRef(null);
  const [drawing, setDrawing]   = useState(false);
  const [signed, setSigned]     = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signedAt, setSignedAt] = useState(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
  }, []);

  const getPos = (e, canvas) => {
    const rect  = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const src  = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  };

  const start = useCallback((e) => {
    if (readOnly || confirmed) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const pos    = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  }, [readOnly, confirmed]);

  const draw = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos    = getPos(e, canvas);
    canvas.getContext("2d").lineTo(pos.x, pos.y);
    canvas.getContext("2d").stroke();
    setSigned(true);
  }, [drawing]);

  const stop = useCallback(() => setDrawing(false), []);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false); setConfirmed(false); setSignedAt(null);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    const ts     = new Date().toISOString();
    setConfirmed(true); setSignedAt(ts);
    onSign?.({ imageData: canvas.toDataURL("image/png"), signerName, signerRole, signedAt: ts });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pen className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            {signerName && <p className="text-xs text-gray-500">{signerRole}: {signerName}</p>}
          </div>
        </div>
        {confirmed && <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="h-4 w-4" />Signed</span>}
      </div>

      <div className={`relative rounded-lg border-2 ${confirmed ? "border-green-300 bg-green-50" : "border-dashed border-gray-300 bg-gray-50 hover:border-blue-400"}`}>
        <canvas
          ref={canvasRef} width={580} height={140}
          className="w-full touch-none"
          style={{ height: 110, cursor: confirmed ? "default" : "crosshair" }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
        {!signed && !confirmed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Draw signature here</p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
        <Shield className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          By confirming, <strong>{signerName || "the signatory"}</strong> agrees this signature is legally valid under the Information Technology Act, 2000.
        </p>
      </div>

      {signedAt && <p className="text-xs text-gray-400">Signed: {new Date(signedAt).toLocaleString("en-IN")}</p>}

      {!readOnly && (
        <div className="flex gap-2">
          {!confirmed ? (
            <>
              <Button variant="outline" size="sm" onClick={clear} disabled={!signed}><Trash2 className="h-3.5 w-3.5" />Clear</Button>
              <Button size="sm" onClick={confirm} disabled={!signed} full><CheckCircle className="h-3.5 w-3.5" />Confirm Signature</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={clear}><Trash2 className="h-3.5 w-3.5" />Re-sign</Button>
          )}
        </div>
      )}
    </div>
  );
}
