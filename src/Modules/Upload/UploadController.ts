import { Request, Response, NextFunction } from "express";
import { BaseController } from "../../core/BaseController";
import { UploadService } from "./UploadService";
import { BadRequestError } from "../../core/errors/AppError";

export class UploadController extends BaseController {
  constructor(private uploadService: UploadService) {
    super();
  }

  public uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let fileToUpload: Express.Multer.File | string | undefined = req.file;

      if (!fileToUpload && req.body?.image) {
        fileToUpload = req.body.image;
      }

      if (!fileToUpload) {
        throw new BadRequestError("No image file or base64 data was provided in request");
      }

      const folder = req.body?.folder || "kawanf/uploads";
      const result = await this.uploadService.uploadImage(fileToUpload, folder);

      return this.sendResponse(req, res, "Image uploaded successfully to Cloudinary", 200, result);
    } catch (error) {
      next(error);
    }
  };
}
