import { useState, useRef } from "react";
import { Camera, Upload, X, Image } from "lucide-react";

export default function PhotoUpload({ onPhotosUpdated, maxPhotos = 10 }) {
  const [photos, setPhotos] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files).slice(0, maxPhotos - photos.length);
    const newPhotos = files.map((f) => ({
      id:   `p_${Date.now()}_${Math.random()}`,
      name: f.name,
      size: f.size,
      url:  URL.createObjectURL(f),
    }));
    const updated = [...photos, ...newPhotos];
    setPhotos(updated);
    onPhotosUpdated?.(updated);
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
          <h3 className="font-semibold text-gray-800">Evidence Photos</h3>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          {photos.length} / {maxPhotos}
        </span>
      </div>

      {/* Upload zone */}
      {photos.length < maxPhotos && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
        >
          <Upload className="h-8 w-8 text-gray-300 group-hover:text-blue-400 mx-auto mb-2 transition-colors" />
          <p className="text-sm text-gray-500 group-hover:text-blue-600">Click to upload photos or videos</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, MP4 — up to 10MB each</p>
          <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFiles} />
        </div>
      )}

      {/* Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-square">
              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => remove(p.id)} className="bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 px-2 py-1">
                <p className="text-white text-xs truncate">{p.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Image className="h-3.5 w-3.5" /> No evidence photos attached yet
        </p>
      )}
    </div>
  );
}
