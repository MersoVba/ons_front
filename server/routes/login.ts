import { RequestHandler } from "express";
import { LoginRequest, AuthenticationResponse } from "@shared/api";

/**
 * Endpoint mock de login - aceita login sem validação de senha
 * Apenas com email/username
 */
export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { username }: LoginRequest = req.body;

    if (!username) {
      return res.status(400).json({
        message: "Email/username é obrigatório",
      });
    }

    // Gera um token mock simples (apenas para desenvolvimento)
    const mockToken = `mock_token_${Buffer.from(username).toString('base64')}_${Date.now()}`;

    const response: AuthenticationResponse = {
      token: mockToken,
      mfaRequired: false,
    };

    console.log(`✅ Login bem-sucedido (sem senha): ${username}`);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Erro ao processar login:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao fazer login",
    });
  }
};

/**
 * Endpoint mock para validar TOTP (MFA)
 */
export const handleValidateTotp: RequestHandler = async (req, res) => {
  try {
    const { username, codigoTotp } = req.body;

    if (!username || !codigoTotp) {
      return res.status(400).json({
        message: "Username e código TOTP são obrigatórios",
      });
    }

    // Aceita qualquer código TOTP de 6 dígitos (apenas para desenvolvimento)
    if (codigoTotp.length !== 6) {
      return res.status(400).json({
        message: "Código TOTP deve ter 6 dígitos",
      });
    }

    const mockToken = `mock_token_${Buffer.from(username).toString('base64')}_${Date.now()}`;

    const response: AuthenticationResponse = {
      token: mockToken,
      mfaRequired: false,
    };

    console.log(`✅ TOTP validado com sucesso para: ${username}`);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Erro ao validar TOTP:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao validar código",
    });
  }
};

