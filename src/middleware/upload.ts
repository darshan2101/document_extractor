import multer from "multer";

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf"
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new Error("UNSUPPORTED_FORMAT"));
      return;
    }

    callback(null, true);
  }
}).single("document");
