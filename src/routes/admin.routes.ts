import { Router } from "express";
import { getAllUsers, createUser, updateUserPermissions, deleteUser } from "../controllers/admin.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";

const router = Router();

router.use(verifyToken);

router.get("/users", requirePermission("user-manage:view"), getAllUsers);
router.post("/users", requirePermission("user-manage:add"), createUser);
router.put("/users/:id/permissions", requirePermission("user-manage:edit"), updateUserPermissions);
router.delete("/users/:id", requirePermission("user-manage:delete"), deleteUser);

export default router;
