import React, { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";

interface PhotoFile {
  original: File;
  resized: File; // after client‑side resizing
  preview: string; // object URL for preview
  position: number;
}

type PhotoUploaderProps = {
  /** Callback with the ordered array of resized files */
  onChange: (files: File[]) => void;
  /** Existing files (e.g., when editing) */
  initialFiles?: PhotoFile[];
};

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ onChange, initialFiles = [] }) => {
  const [photos, setPhotos] = useState<PhotoFile[]>(initialFiles);

  // Notify parent whenever the ordered list of resized files changes
  useEffect(() => {
    onChange(photos.map((p) => p.resized));
  }, [photos, onChange]);

  const MAX_COUNT = 8;
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MiB
  const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

  const handleFiles = async (files: FileList) => {
    const newFiles: PhotoFile[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type)) {
        alert(`Unsupported type: ${file.type}`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        alert(`File too big: ${(file.size / 1024 / 1024).toFixed(1)} MiB`);
        continue;
      }
      const resized = await resizeImage(file, 1600);
      const preview = URL.createObjectURL(resized);
      newFiles.push({ original: file, resized, preview, position: photos.length + newFiles.length - 1 });
    }
    const combined = [...photos, ...newFiles].slice(0, MAX_COUNT);
    setPhotos(combined);
  };

  const resizeImage = (file: File, maxWidth: number): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const newFile = new File([blob], file.name, { type: blob.type });
          resolve(newFile);
        }, file.type);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const move = (from: number, to: number) => {
    const updated = [...photos];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setPhotos(updated.map((p, i) => ({ ...p, position: i })));
  };

  const remove = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    setPhotos(updated.map((p, i) => ({ ...p, position: i })));
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-white mb-2">
        Photos (max {MAX_COUNT})
      </label>
      <input
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        onChange={(e) => handleFiles(e.target.files!)}
        className="hidden"
        id="photo-input"
      />
      <label htmlFor="photo-input" className="flex items-center cursor-pointer p-4 border border-teal-500 rounded text-teal-500 hover:bg-teal-900/30">
        <Upload className="mr-2" /> Add photos
      </label>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p, idx) => (
          <div key={idx} className="relative">
            <img src={p.preview} alt="preview" className="object-cover w-full h-32 rounded" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="absolute bottom-1 left-1 flex space-x-1">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => move(idx, idx - 1)}
                  className="bg-black/50 rounded p-0.5"
                >
                  ↑
                </button>
              )}
              {idx < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => move(idx, idx + 1)}
                  className="bg-black/50 rounded p-0.5"
                >
                  ↓
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
