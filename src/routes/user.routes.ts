import { Router } from "express";
import {
  getMe,
  updateMe,
  updatePassword,
} from "../controllers/user.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";

const router = Router();

router.use(verifyToken);

router.get("/me", getMe);
router.put("/me", requirePermission("user:edit"), updateMe);
router.put("/me/password", requirePermission("user:edit"), updatePassword);

export default router;