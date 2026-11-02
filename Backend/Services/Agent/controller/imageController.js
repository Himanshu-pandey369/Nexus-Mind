import Image from "../models/Image.js";
import { uploadImage, deleteImage } from "../utils/cloudinaryUpload.js";

/**
 * Upload an image for the authenticated user and save reference in DB
 * POST /images/upload (or POST /agent/images/upload)
 */
export const uploadUserImage = async (req, res) => {
  let uploadedAsset;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image",
      });
    }

    // Extract user ID: Gateway forwards user ID in x-user-id header,
    // or fall back to req.user / req.body for direct calls in dev.
    const userId =
      req.headers["x-user-id"] ||
      req.user?.id ||
      req.user?.userID ||
      req.body?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required: missing user identification",
      });
    }

    uploadedAsset = await uploadImage(req.file.buffer);

    const image = await Image.create({
      userId: String(userId),
      imageUrl: uploadedAsset.secure_url,
      publicId: uploadedAsset.public_id,
    });

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      image,
    });
  } catch (error) {
    // Avoid leaving an orphaned Cloudinary asset if the
    // database write fails after the upload succeeded.
    if (uploadedAsset?.public_id) {
      try {
        await deleteImage(uploadedAsset.public_id);
      } catch (cleanupError) {
        console.error("Cloudinary cleanup failed:", cleanupError);
      }
    }

    console.error("Image upload failed:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Image upload failed",
    });
  }
};

/**
 * Get all images uploaded by the authenticated user
 * GET /images (or GET /agent/images)
 */
export const getUserImages = async (req, res) => {
  try {
    const userId =
      req.headers["x-user-id"] ||
      req.user?.id ||
      req.user?.userID ||
      req.query?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const images = await Image.find({ userId: String(userId) }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      images,
    });
  } catch (error) {
    console.error("Failed to fetch images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch images",
    });
  }
};

/**
 * Delete an image by its database ID
 * DELETE /images/:id (or DELETE /agent/images/:id)
 */
export const deleteUserImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId =
      req.headers["x-user-id"] ||
      req.user?.id ||
      req.user?.userID ||
      req.body?.userId;

    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    if (userId && image.userId !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this image",
      });
    }

    await deleteImage(image.publicId);
    await Image.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Image deletion failed:", error);
    return res.status(500).json({
      success: false,
      message: "Image deletion failed",
    });
  }
};
