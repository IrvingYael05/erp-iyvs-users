import { Router } from "express";
import { login, register, recoverPassword, logout, resetPassword } from "../controllers/auth.controller";

const router = Router();

// Ruta
router.post("/login", login);
router.post("/register", register);
router.post("/recover", recoverPassword);
router.post("/reset", resetPassword);
router.post("/logout", logout);

export default router;
