import { Router } from "express";
import { handleSingleUpload } from "../middleware/upload.js";
import {
  uploadUserImage,
  getUserImages,
  deleteUserImage,
} from "../controller/imageController.js";

const router = Router();

router.post("/upload", handleSingleUpload("image"), uploadUserImage);
router.get("/", getUserImages);
router.delete("/:id", deleteUserImage);

export default router;
