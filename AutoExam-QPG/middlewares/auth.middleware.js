import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { ACCESS_TOKEN_REQUIRED } from "../utils/constants";
dotenv.config();

export const verifyAccessToken = (req, res, next) => {
  try {
    const token = req.headers["authorization"];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: ACCESS_TOKEN_REQUIRED });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (req.method === "POST") {
      req.body.userId = decoded.id;
    } else if (req.method === "GET") {
      req.query.userId = decoded.id;
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error(error.message);
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired access token" });
  }
};
