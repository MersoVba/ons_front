import { RequestHandler } from "express";
import multer from "multer";
import { createRequire } from "module";
import { ProcessarComprovanteResponse, TipoDocumento } from "../../shared/api";
import { processarTextoPDF } from "../utils/pdf-parsers";

// pdf-parse 1.1.1 é CommonJS, usar createRequire para importar
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// Nota: Para processar PDFs escaneados, instale:
// npm install tesseract.js pdf2pic
// Tesseract.js para OCR (será carregado dinamicamente se necessário)

// Configurar multer para armazenar em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são permitidos"));
    }
  },
});

export const handleUploadComprovante: RequestHandler = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 INÍCIO DO PROCESSAMENTO DE PDF");
    console.log("=".repeat(80));
    const file = req.file;
    
    if (!file) {
      console.log("❌ Erro: Nenhum arquivo foi enviado");
      const response: ProcessarComprovanteResponse = {
        sucesso: false,
        erro: "Nenhum arquivo foi enviado",
      };
      return res.status(400).json(response);
    }

    console.log("📄 Arquivo recebido:", {
      nome: file.originalname,
      tamanho: file.size,
      tipo: file.mimetype
    });

    // Extrair texto do PDF usando pdf-parse 1.1.1
    console.log("🔍 Extraindo texto do PDF...");
    const pdfData = await pdfParse(file.buffer);
    const texto = pdfData.text;

    console.log("📝 Texto extraído do PDF:");
    console.log("📏 Tamanho total:", texto.length, "caracteres");
    
    // Mostrar texto completo usando JSON.stringify para ver caracteres especiais
    console.log("\n" + "=".repeat(80));
    console.log("======= TEXTO EXTRAÍDO DO PDF (INÍCIO) =======");
    console.log(JSON.stringify(texto));
    console.log("======= TEXTO EXTRAÍDO DO PDF (FIM) =======");
    console.log("=".repeat(80) + "\n");
    
    // Mostrar partes do texto que contêm "Valor" para debug
    const trechosValor = texto.match(/.{0,200}Valor.{0,200}/gi);
    if (trechosValor) {
      console.log("📋 Trechos do texto contendo 'Valor':");
      console.log("-".repeat(80));
      trechosValor.forEach((trecho, index) => {
        console.log(`\nTrecho ${index + 1}:`);
        console.log(JSON.stringify(trecho));
        console.log("Visual:", trecho);
      });
      console.log("-".repeat(80) + "\n");
    }
    
    console.log("📄 Primeiros 1500 caracteres (visual):");
    console.log("-".repeat(80));
    console.log(texto.substring(0, 1500));
    console.log("-".repeat(80));
    
    // Se o texto for muito grande, mostrar também os últimos caracteres
    if (texto.length > 1500) {
      console.log("📄 Últimos 500 caracteres:");
      console.log("-".repeat(80));
      console.log(texto.substring(texto.length - 500));
      console.log("-".repeat(80));
    }

    // Verificar se o PDF é uma imagem escaneada
    const producer = pdfData.info?.Producer || "";
    const isScannedPDF = producer.includes("Print To PDF") || 
                         producer.includes("Microsoft") ||
                         texto.trim().length < 10;
    
    if (!texto || texto.trim().length === 0 || isScannedPDF) {
      console.log("⚠️ PDF parece ser uma imagem escaneada ou não contém texto extraível");
      
      const response: ProcessarComprovanteResponse = {
        sucesso: false,
        erro: `⚠️ PDF não contém texto extraível (imagem escaneada).\n\n` +
              `Este PDF foi gerado pelo "Microsoft Print To PDF", o que significa que é uma imagem escaneada.\n\n` +
              `📚 BIBLIOTECAS DE OCR DISPONÍVEIS:\n\n` +
              `1. Tesseract.js (Recomendado para Node.js):\n` +
              `   npm install tesseract.js\n\n` +
              `2. pdf2pic (Para converter PDF em imagem):\n` +
              `   npm install pdf2pic\n\n` +
              `Informações do PDF:\n` +
              `- Páginas: ${pdfData.numpages}\n` +
              `- Produtor: ${producer}\n` +
              `- Tamanho do texto: ${texto.length} caracteres`,
      };
      return res.status(200).json(response);
    }

    // Processar texto e extrair dados
    console.log("🔎 Processando texto e extraindo dados...");
    const { banco, dados } = processarTextoPDF(texto);

    // Log detalhado de todos os dados extraídos
    console.log("\n" + "=".repeat(80));
    console.log("📋 RESUMO COMPLETO DOS DADOS EXTRAÍDOS");
    console.log("=".repeat(80));
    console.log("🏦 Banco:", banco);
    console.log("📄 Tipo Documento:", dados.tipoDocumento || "não informado");
    console.log("");
    console.log("🏛️ DADOS BANCÁRIOS:");
    console.log("  • Agência:", dados.agencia || "❌ não encontrado");
    console.log("  • Conta:", dados.conta || "❌ não encontrado");
    console.log("  • Número de Identificação:", dados.numeroIdentificacao || "❌ não encontrado");
    console.log("");
    console.log("👤 BENEFICIÁRIO:");
    console.log("  • Nome:", dados.beneficiario || "❌ não encontrado");
    console.log("  • CNPJ/CPF:", dados.cnpjBeneficiario || "❌ não encontrado");
    console.log("");
    console.log("💳 PAGADOR:");
    console.log("  • Nome:", dados.pagador || "❌ não encontrado");
    console.log("");
    console.log("📅 DATAS:");
    console.log("  • Data de Vencimento:", dados.dataVencimento || "❌ não encontrado");
    console.log("  • Data de Pagamento:", dados.dataPagamento || "❌ não encontrado");
    if (dados.dataHoraSolicitacao) {
      console.log("  • Data/Hora Solicitação:", dados.dataHoraSolicitacao || "❌ não encontrado");
    }
    console.log("");
    console.log("💰 VALORES:");
    console.log("  • Valor do Documento:", dados.valorDocumento ? `R$ ${dados.valorDocumento.toFixed(2).replace('.', ',')}` : "❌ não encontrado");
    console.log("  • Valor Cobrado:", dados.valorCobrado ? `R$ ${dados.valorCobrado.toFixed(2).replace('.', ',')}` : "❌ não encontrado");
    
    // Campos específicos para TED/Transferência
    if (dados.tipoDocumento === TipoDocumento.TED || dados.tipoDocumento === TipoDocumento.TRANSFERECIA) {
      console.log("");
      console.log("🏦 DADOS DO DESTINO (TED/Transferência):");
      console.log("  • Banco Destino:", dados.bancoDestino || "❌ não encontrado");
      console.log("  • Banco Destino (Número):", dados.bancoDestinoNumero || "❌ não encontrado");
      console.log("  • Banco Destino (ISPB):", dados.bancoDestinoISPB || "❌ não encontrado");
      console.log("  • Agência Destino:", dados.agenciaDestino || "❌ não encontrado");
      console.log("  • Conta Destino:", dados.contaDestino || "❌ não encontrado");
      console.log("  • Nome Favorecido:", dados.beneficiario || "❌ não encontrado");
      console.log("  • CNPJ Favorecido:", dados.cnpjBeneficiario || "❌ não encontrado");
      console.log("  • Finalidade:", dados.finalidade || "❌ não encontrado");
      console.log("  • Controle:", dados.controle || "❌ não encontrado");
    }
    
    console.log("");
    console.log("=".repeat(80));
    console.log("📦 DADOS COMPLETOS EM JSON:");
    console.log(JSON.stringify(dados, null, 2));
    console.log("=".repeat(80) + "\n");

    const response: ProcessarComprovanteResponse = {
      sucesso: true,
      dados: dados as any,
      bancoDetectado: banco,
    };

    console.log("✅ Processamento concluído com sucesso!");
    console.log("📤 Enviando resposta para o frontend...\n");
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Erro ao processar comprovante:", error);
    const response: ProcessarComprovanteResponse = {
      sucesso: false,
      erro: error instanceof Error ? error.message : "Erro desconhecido ao processar PDF",
    };
    res.status(500).json(response);
  }
};

// Middleware para upload de arquivo único
export const uploadMiddleware = upload.single("pdf");

