import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true,
  });
} else {
  let apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Defensive fallback: if the secret was accidentally formatted as a full cloudinary:// URL, extract secret
  if (apiSecret && apiSecret.startsWith("cloudinary://")) {
    const match = apiSecret.match(/cloudinary:\/\/[^:]+:([^@]+)@/);
    if (match) {
      apiSecret = match[1];
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: apiSecret,
    secure: true,
  });
}

export default cloudinary;
