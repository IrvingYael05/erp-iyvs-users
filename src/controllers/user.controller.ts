import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { supabase, supabaseAdmin } from "../config/supabase";
import { ApiResponse } from "../interfaces/api-response";
import { createClient } from "@supabase/supabase-js";

// ----- Obtener Información Personal -----
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "id, email, nombre_completo, direccion, telefono, fecha_nacimiento, permisos_globales",
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        statusCode: 404,
        intOpCode: 1,
        data: [{ message: "Perfil no encontrado en la base de datos." }],
      } as ApiResponse);
    }

    const userProfile = {
      id: data.id,
      email: data.email,
      nombreCompleto: data.nombre_completo,
      direccion: data.direccion,
      telefono: data.telefono,
      fechaNacimiento: data.fecha_nacimiento,
      permissions: data.permisos_globales,
    };

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [userProfile],
    } as ApiResponse);
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [{ message: "Error interno del servidor al obtener el perfil." }],
    } as ApiResponse);
  }
};

// ----- Actualizar Información Personal -----
export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { nombreCompleto, direccion, telefono, fechaNacimiento } = req.body;

    if (
      !nombreCompleto ||
      typeof nombreCompleto !== "string" ||
      nombreCompleto.trim().length < 5
    ) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [
          {
            message: "El nombre completo es obligatorio.",
          },
        ],
      } as ApiResponse);
    }

    if (
      !direccion ||
      typeof direccion !== "string" ||
      direccion.trim().length === 0
    ) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "La dirección es obligatoria." }],
      } as ApiResponse);
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!telefono || !phoneRegex.test(telefono)) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [
          {
            message: "El formato del teléfono no es válido.",
          },
        ],
      } as ApiResponse);
    }

    if (!fechaNacimiento) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "La fecha de nacimiento es obligatoria." }],
      } as ApiResponse);
    }

    const birthDateObj = new Date(fechaNacimiento);
    if (isNaN(birthDateObj.getTime())) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "Formato de fecha de nacimiento inválido." }],
      } as ApiResponse);
    }

    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [
          { message: "Debes ser mayor de 18 años para actualizar tu perfil." },
        ],
      } as ApiResponse);
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update({
        nombre_completo: nombreCompleto.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        fecha_nacimiento: birthDateObj.toISOString().split("T")[0],
      })
      .eq("id", userId)
      .select(
        "id, email, nombre_completo, direccion, telefono, fecha_nacimiento, permisos_globales",
      )
      .single();

    if (error || !data) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 2,
        data: [
          { message: "No se pudo actualizar el perfil en la base de datos." },
        ],
      } as ApiResponse);
    }

    const updatedProfile = {
      id: data.id,
      email: data.email,
      nombreCompleto: data.nombre_completo,
      direccion: data.direccion,
      telefono: data.telefono,
      fechaNacimiento: data.fecha_nacimiento,
      permissions: data.permisos_globales,
    };

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [updatedProfile],
    } as ApiResponse);
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [
        { message: "Error interno del servidor al actualizar el perfil." },
      ],
    } as ApiResponse);
  }
};

// ----- Actualizar Contraseña -----
export const updatePassword = async (req: AuthRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 1,
      data: [{ message: "Las contraseñas son obligatorias." }],
    } as ApiResponse);
  }

  try {
    const userId = req.user!.id;

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        statusCode: 404,
        intOpCode: 1,
        data: [{ message: "Usuario no encontrado en la base de datos." }],
      } as ApiResponse);
    }

    const tempSupabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );

    const { error: loginError } = await tempSupabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (loginError) {
      return res.status(401).json({
        statusCode: 401,
        intOpCode: 1,
        data: [{ message: "La contraseña actual es incorrecta." }],
      } as ApiResponse);
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (updateError) throw updateError;

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [{ message: "Contraseña actualizada exitosamente." }],
    } as ApiResponse);
  } catch (err: any) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [
        { message: "Error interno del servidor al actualizar la contraseña." },
      ],
    });
  }
};

// ----- Eliminar Cuenta Propia -----
export const deleteMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: "87600h",
      },
    );

    await supabaseAdmin.from("usuarios").update({ ban: true }).eq("id", userId);

    if (error) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "Error al intentar eliminar la cuenta." }],
      } as ApiResponse);
    }

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [{ message: "Cuenta eliminada correctamente." }],
    } as ApiResponse);
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [{ message: "Error interno al intentar eliminar la cuenta." }],
    });
  }
};
