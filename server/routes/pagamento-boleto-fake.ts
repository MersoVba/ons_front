import { RequestHandler } from "express";
import { PagamentoBoleto } from "../../shared/api";

/**
 * Endpoint fake para receber dados de pagamento de boleto
 * Apenas para visualização do payload que seria enviado
 */
export const handleFakeEnvio: RequestHandler = async (req, res) => {
  try {
    const dados: PagamentoBoleto = req.body;

    console.log("=".repeat(80));
    console.log("📤 PAYLOAD RECEBIDO NA API FAKE");
    console.log("=".repeat(80));
    console.log(JSON.stringify(dados, null, 2));
    console.log("=".repeat(80));
    console.log("📋 DETALHES DO PAYLOAD:");
    console.log("- Banco:", dados.banco || "Não informado");
    console.log("- Agência:", dados.agencia || "Não informado");
    console.log("- Conta:", dados.conta || "Não informado");
    console.log("- Beneficiário:", dados.beneficiario || "Não informado");
    console.log("- CNPJ Beneficiário:", dados.cnpjBeneficiario || "Não informado");
    console.log("- Pagador:", dados.pagador || "Não informado");
    console.log("- Número Identificação:", dados.numeroIdentificacao || "Não informado");
    console.log("- Data Vencimento:", dados.dataVencimento || "Não informado");
    console.log("- Data Pagamento:", dados.dataPagamento || "Não informado");
    console.log("- Valor Documento:", dados.valorDocumento || "Não informado");
    console.log("- Valor Cobrado:", dados.valorCobrado || "Não informado");
    console.log("- Tipo Documento:", dados.tipoDocumento || "Não informado");
    console.log("=".repeat(80));

    // Retornar sucesso
    res.status(200).json({
      sucesso: true,
      mensagem: "Payload recebido com sucesso (API Fake)",
      dadosRecebidos: dados,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Erro ao processar payload fake:", error);
    res.status(500).json({
      sucesso: false,
      erro: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};

