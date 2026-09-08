import { useState, useRef } from "react";
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

/**
 * Compresses an image file to a lightweight JPEG Base64 data URL.
 * Ensures evidence persists across reloads, localStorage, and database writes.
 */
function compressImage(file, maxDimension = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ onPhotosUpdated, maxPhotos = 6, initialPhotos = [] }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [compressing, setCompressing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef(null);

  const handleFiles = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles.length) return;

    const availableSlots = maxPhotos - photos.length;
    const filesToProcess = rawFiles.slice(0, availableSlots);

    setCompressing(true);
    setUploadError("");

    try {
      const processed = [];
      for (const file of filesToProcess) {
        if (file.type.startsWith("image/")) {
          const dataUrl = await compressImage(file);
          processed.push({
            id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            url: dataUrl,
          });
        }
      }

      const updated = [...photos, ...processed];
      setPhotos(updated);
      onPhotosUpdated?.(updated);
    } catch (err) {
      console.error("Evidence upload error:", err);
      setUploadError("Could not process one or more images. Please retry with standard JPG/PNG files.");
    } finally {
      setCompressing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (id) => {
    const updated = photos.filter((p) => p.id !== id);
    setPhotos(updated);
    onPhotosUpdated?.(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Evidence Documentation</h3>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
          {photos.length} / {maxPhotos} attached
        </span>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {uploadError}
        </div>
      )}

      {/* Upload zone */}
      {photos.length < maxPhotos && (
        <div
          onClick={() => !compressing && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
            compressing
              ? "border-blue-300 bg-blue-50/50 cursor-wait"
              : "border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer bg-white"
          }`}
        >
          {compressing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-blue-800">Optimizing evidence for secure storage…</p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Add Evidence Photos</p>
              <p className="text-xs text-gray-400 mt-1">Scene photos, stolen item receipts, damage marks (JPG, PNG)</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
            disabled={compressing}
          />
        </div>
      )}

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video shadow-sm"
            >
              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 shadow-lg transition-transform active:scale-95"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-1.5">
                <p className="text-white text-[11px] font-medium truncate">{p.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !compressing && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <ImageIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span>No evidence uploaded yet. Photos are optional but strengthen your complaint.</span>
        </div>
      )}
    </div>
  );
}
