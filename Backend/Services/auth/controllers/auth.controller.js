import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../Shared/redis/redis.js";
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

    await redis.set(`session-${sessionID}`,JSON.stringify({
      userID:user._id,
      name:user.name,
      email:user.email,
      avatar:user.avatar
    }),"EX",5 * 24 * 60 * 60 * 1000)
    
    res.cookie("session", sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
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

export const logout = async (req, res) => {
  try {
    const sessionID = req.cookies?.session;

    if (!sessionID) {
      res.clearCookie("session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    }

    await redis.del(`session-${sessionID}`);

    const auth = getAuth(app);
    await auth.revokeRefreshTokens(
      (await auth.verifySessionCookie(sessionID)).uid
    );

    res.clearCookie("session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error.message);

    res.clearCookie("session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};