import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../Shared/redis/redis.js";
import {
  createLogoutHandler,
  getSessionCookieOptions,
} from "./logout.js";

export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken)
      return res.status(400).json({ message: "Token required" });

    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);

    let user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: decoded.name || "",
        email: decoded.email,
        avatar: decoded.picture || "",
      });
    }

    const sessionID = await auth.createSessionCookie(idToken, {
      expiresIn: 5 * 24 * 60 * 60 * 1000,
    });

    await redis.set(
      `session-${sessionID}`,
      JSON.stringify({
        userID: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        credits: user.credits ?? 1000,
      }),
      "EX",
      5 * 24 * 60 * 60 // 5 days in seconds
    );
    
    res.cookie(
      "session",
      sessionID,
      getSessionCookieOptions({
        maxAge: 5 * 24 * 60 * 60 * 1000,
      })
    );

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        credits: user.credits ?? 1000,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const logout = createLogoutHandler({
  redisClient: redis,
  getAuthFn: getAuth,
  firebaseApp: app,
});