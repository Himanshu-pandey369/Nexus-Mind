import express from "express";
import "dotenv/config";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from agent" });
});

const PORT = process.env.PORT || 8083;

app.listen(PORT, () => {
  console.log(`Agent service started on port ${PORT}`);
});
