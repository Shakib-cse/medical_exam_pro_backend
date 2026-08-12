import { Router } from "express";
import multer from "multer";
import { UploadController } from "./UploadController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file limit
});

export function createUploadRoutes(controller: UploadController): Router {
  const router = Router();

  router.post("/image", upload.single("file"), controller.uploadImage);

  return router;
}
