import { Router } from "express";
import {
  deleteMe,
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
router.delete("/me", deleteMe);

export default router;