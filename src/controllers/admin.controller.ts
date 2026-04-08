import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { supabase, supabaseAdmin } from "../config/supabase";
import { ApiResponse } from "../interfaces/api-response";

// ----- Obtener la Información de Todos los Usuarios -----
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("usuarios")
      .select(
        "id, email, nombre_completo, direccion, telefono, fecha_nacimiento, permisos_globales, creado_en",
        { count: "exact" },
      );

    if (search) {
      query = query.or(
        `nombre_completo.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query
      .order("creado_en", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return res.status(500).json({
        statusCode: 500,
        intOpCode: 1,
        data: [
          { message: "Error al consultar la lista paginada de usuarios." },
        ],
      } as ApiResponse);
    }

    const mappedUsers = data.map((user) => ({
      id: user.id,
      email: user.email,
      nombreCompleto: user.nombre_completo,
      direccion: user.direccion,
      telefono: user.telefono,
      fechaNacimiento: user.fecha_nacimiento,
      permissions: user.permisos_globales,
      creadoEn: user.creado_en,
    }));

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [
        {
          users: mappedUsers,
          totalRecords: count || 0,
        },
      ],
    } as ApiResponse);
  } catch (err: any) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [{ message: "Error interno del servidor al consultar usuarios." }],
    } as ApiResponse);
  }
};

// ----- Crear Usuario -----
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, nombreCompleto } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "Correo electrónico inválido." }],
      } as ApiResponse);
    }

    const passwordRegex = /^.*[@$!%*?&#/\-+=<>].*$/;
    if (!password || password.length < 10 || !passwordRegex.test(password)) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [
          {
            message:
              "La contraseña debe tener al menos 10 caracteres y un carácter especial.",
          },
        ],
      } as ApiResponse);
    }

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

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password: password,
        email_confirm: true,
      });

    if (authError) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 2,
        data: [{ message: `Error al crear el usuario.` }],
      } as ApiResponse);
    }

    const newUserId = authData.user.id;

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        nombre_completo: nombreCompleto.trim(),
      })
      .eq("id", newUserId)
      .select(
        "id, email, nombre_completo, direccion, telefono, fecha_nacimiento, permisos_globales, creado_en",
      )
      .single();

    if (updateError || !updateData) {
      return res.status(500).json({
        statusCode: 500,
        intOpCode: 3,
        data: [
          {
            message:
              "Usuario creado en Auth, pero falló la actualización del nombre.",
          },
        ],
      } as ApiResponse);
    }

    const newUserProfile = {
      id: updateData.id,
      email: updateData.email,
      nombreCompleto: updateData.nombre_completo,
      direccion: updateData.direccion,
      telefono: updateData.telefono,
      fechaNacimiento: updateData.fecha_nacimiento,
      permissions: updateData.permisos_globales,
      creadoEn: updateData.creado_en,
    };

    return res.status(201).json({
      statusCode: 201,
      intOpCode: 0,
      data: [newUserProfile],
    } as ApiResponse);
  } catch (err) {
    console.error("Error en createUser:", err);
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [{ message: "Error interno del servidor al crear el usuario." }],
    } as ApiResponse);
  }
};

// ----- Actualizar Permisos Globales -----
export const updateUserPermissions = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!id) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "El ID del usuario es obligatorio." }],
      } as ApiResponse);
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [
          {
            message: "El formato de los permisos es inválido.",
          },
        ],
      } as ApiResponse);
    }

    if (id === req.user!.id) {
      return res.status(403).json({
        statusCode: 403,
        intOpCode: 1,
        data: [
          {
            message:
              "No puedes modificar tus propios permisos de administración por seguridad.",
          },
        ],
      } as ApiResponse);
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update({
        permisos_globales: permissions,
      })
      .eq("id", id)
      .select("id, email, permisos_globales")
      .single();

    if (error || !data) {
      return res.status(404).json({
        statusCode: 404,
        intOpCode: 2,
        data: [
          {
            message:
              "Usuario no encontrado o error al actualizar los permisos en la base de datos.",
          },
        ],
      } as ApiResponse);
    }

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [
        {
          message: "Permisos actualizados correctamente.",
          permissions: data.permisos_globales,
        },
      ],
    } as ApiResponse);
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [
        { message: "Error interno del servidor al actualizar los permisos." },
      ],
    } as ApiResponse);
  }
};

// ----- Eliminar Usuario -----
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = id.toString();

    if (!id) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 1,
        data: [{ message: "El ID del usuario es obligatorio." }],
      } as ApiResponse);
    }

    if (id === req.user!.id) {
      return res.status(403).json({
        statusCode: 403,
        intOpCode: 1,
        data: [{ message: "No puedes suspender tu propia cuenta." }],
      } as ApiResponse);
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: "87600h",
      },
    );

    if (error) {
      return res.status(400).json({
        statusCode: 400,
        intOpCode: 2,
        data: [{ message: `Error al suspender al usuario.` }],
      } as ApiResponse);
    }

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [
        {
          message:
            "El usuario ha sido suspendido exitosamente y ya no podrá acceder al sistema.",
        },
      ],
    } as ApiResponse);
  } catch (err) {
    console.error("Error en banUser:", err);
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [
        { message: "Error interno del servidor al procesar la suspensión." },
      ],
    } as ApiResponse);
  }
};
