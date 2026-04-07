import { Request, Response } from "express";
import { supabase, supabaseAdmin } from "../config/supabase";
import { ApiResponse } from "../interfaces/api-response";
import { permission } from "node:process";

// ----- Login -----
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validaciones
  if (!email || !password) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 1,
      data: [{ message: "El correo y la contraseña son obligatorios." }],
    });
  }

  // Consulta
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        statusCode: 401,
        intOpCode: 2,
        data: [{ message: "Correo o contraseña incorrectos." }],
      });
    }

    const { data: userData } = await supabase
      .from("usuarios")
      .select("nombre_completo, permisos_globales")
      .eq("id", data.user.id)
      .single();

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [
        {
          message: "Inicio de sesión exitoso.",
          token: data.session.access_token,
          usuario: {
            id: data.user.id,
            email: data.user.email,
            nombreCompleto: userData?.nombre_completo || "Usuario",
            permission: userData?.permisos_globales || [],
          },
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [{ message: "Error interno del servidor." }],
    });
  }
};

// ----- Registro -----
export const register = async (req: Request, res: Response) => {
  const {
    email,
    password,
    nombreCompleto,
    telefono,
    direccion,
    fechaNacimiento,
  } = req.body;

  // Validaciones
  if (
    !email ||
    !password ||
    !nombreCompleto ||
    !telefono ||
    !direccion ||
    !fechaNacimiento
  ) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 1,
      data: [
        {
          message: "Todos los campos son obligatorios.",
        },
      ],
    });
  }

  const passwordRegex = /^.*[@$!%*?&#/\-+=<>].*$/;
  if (password.length < 10 || !passwordRegex.test(password)) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 2,
      data: [
        {
          message:
            "La contraseña debe tener al menos 10 caracteres y un símbolo especial.",
        },
      ],
    });
  }

  const birthDate = new Date(fechaNacimiento);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 18) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 3,
      data: [{ message: "Debes ser mayor de 18 años para registrarte." }],
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 4,
      data: [{ message: "El formato del correo electrónico no es válido." }],
    });
  }

  const telefonoRegex = /^\d{10}$/;
  if (!telefonoRegex.test(telefono)) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 5,
      data: [
        {
          message: "El formato del teléfono no es válido.",
        },
      ],
    });
  }

  // Consulta
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombreCompleto,
          telefono,
          direccion,
          fechaNacimiento,
        },
      },
    });

    if (error) {
      const isUserExistsError = error.message
        .toLowerCase()
        .includes("already registered");

      return res.status(400).json({
        statusCode: 400,
        intOpCode: 6,
        data: [
          {
            message: isUserExistsError
              ? "El correo electrónico ya está registrado."
              : error.message,
          },
        ],
      });
    }

    return res.status(201).json({
      statusCode: 201,
      intOpCode: 0,
      data: [
        {
          message: "Usuario registrado correctamente.",
          id: data.user?.id,
          email: data.user?.email,
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [{ message: "Error interno del servidor." }],
    });
  }
};

// ----- Recuperar contraseña -----
export const recoverPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      statusCode: 400,
      intOpCode: 1,
      data: [{ message: "El correo electrónico es obligatorio." }],
    });
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      const isUserExistsError =
        error.message.toLowerCase().includes("not found") ||
        error.message.toLowerCase().includes("is invalid");

      return res.status(400).json({
        statusCode: 400,
        intOpCode: 2,
        data: [
          {
            message: isUserExistsError ? "El correo no está registrado o es inválido." : error.message,
          },
        ],
      });
    }

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [
        {
          message:
            "Si el correo existe en nuestro sistema, recibirás las instrucciones en breve.",
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({
      statusCode: 500,
      intOpCode: 99,
      data: [
        { message: "Error interno del servidor al procesar la solicitud." },
      ],
    });
  }
};

// ----- Cerrar sesión -----
export const logout = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [{ message: "Sesión cerrada en el cliente." }],
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (!userError && user) {
      await supabaseAdmin.auth.admin.signOut(token);
    }

    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [{ message: "Sesión cerrada correctamente en el servidor." }],
    });
  } catch (err) {
    return res.status(200).json({
      statusCode: 200,
      intOpCode: 0,
      data: [{ message: "Sesión finalizada." }],
    });
  }
};
