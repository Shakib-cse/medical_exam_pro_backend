import { v2 as cloudinary } from "cloudinary";
import config from "../../core/config";
import { BadRequestError } from "../../core/errors/AppError";
import { AppLogger } from "../../core/logging/logger";

export class UploadService {
  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || config.cloudinary.cloudName;
    const apiKey = process.env.CLOUDINARY_API_KEY || config.cloudinary.apiKey;
    const apiSecret = process.env.CLOUDINARY_API_SECRET || config.cloudinary.apiSecret;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      AppLogger.info("☁️ Cloudinary SDK configured successfully.");
    } else {
      AppLogger.warn("⚠️ Cloudinary credentials missing in environment variables. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your backend .env file.");
    }
  }

  /**
   * Upload image file buffer or Base64 string to Cloudinary CDN
   */
  async uploadImage(
    file: Express.Multer.File | string,
    folder = "kawanf/uploads"
  ): Promise<{ url: string; publicId: string }> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || config.cloudinary.cloudName;
    const apiKey = process.env.CLOUDINARY_API_KEY || config.cloudinary.apiKey;
    const apiSecret = process.env.CLOUDINARY_API_SECRET || config.cloudinary.apiSecret;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestError(
        "Cloudinary configuration missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend .env file."
      );
    }

    // Ensure config is fresh
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        resource_type: "image" as const,
      };

      if (typeof file === "string") {
        // Base64 Data URI upload
        cloudinary.uploader.upload(file, uploadOptions, (error, result) => {
          if (error || !result) {
            AppLogger.error("Cloudinary upload error:", error);
            return reject(
              new BadRequestError(error?.message || "Failed to upload image to Cloudinary")
            );
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        });
      } else if (file && file.buffer) {
        // Multer File Buffer upload
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error || !result) {
            AppLogger.error("Cloudinary stream upload error:", error);
            return reject(
              new BadRequestError(error?.message || "Failed to upload image to Cloudinary")
            );
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        });
        stream.end(file.buffer);
      } else {
        reject(new BadRequestError("No file or base64 payload provided for upload"));
      }
    });
  }
}
