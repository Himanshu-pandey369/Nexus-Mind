import cloudinary from "../config/cloudinary.js";

/**
 * Upload an image buffer to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer from multer
 * @param {Object} options - Optional cloudinary upload parameters
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadImage = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!buffer) {
      return reject(new Error("No file buffer provided for Cloudinary upload"));
    }

    const uploadOptions = {
      folder: options.folder || process.env.CLOUDINARY_FOLDER || "nexusmind/images",
      resource_type: options.resource_type || "image",
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary by public ID
 * @param {string} publicId
 * @returns {Promise<Object>}
 */
export const deleteImage = async (publicId) => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId);
};
