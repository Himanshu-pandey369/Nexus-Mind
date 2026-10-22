export const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Get current user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch current user",
    });
  }
};