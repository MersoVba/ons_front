import { RequestHandler } from "express";
import multer from "multer";

// Configurar multer para upload de arquivo CNAB
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .txt são permitidos"));
    }
  },
});

export const uploadMiddleware = upload.single("arquivo");

/**
 * Processa arquivo CNAB retornado do banco e atualiza status das parcelas
 */
export const handleProcessarCNAB: RequestHandler = async (req, res) => {
  try {
    const file = (req as any).file;
    
    if (!file) {
      return res.status(400).json({
        error: "Arquivo CNAB não foi enviado",
      });
    }

    console.log("📄 Processando arquivo CNAB:", {
      nome: file.originalname,
      tamanho: file.size,
    });

    // Ler conteúdo do arquivo
    const conteudo = file.buffer.toString('utf-8');
    const linhas = conteudo.split(/\r?\n/).filter(linha => linha.trim().length > 0);

    console.log(`📋 Total de linhas no arquivo: ${linhas.length}`);

    // Processar linhas do arquivo CNAB e retornar em streaming para atualização em tempo real
    const parcelasProcessadas: Array<{ cdParcela: number; status: string }> = [];
    
    // Configurar headers para streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Processar linha por linha e enviar atualizações em tempo real
    for (let index = 0; index < linhas.length; index++) {
      const linha = linhas[index];
      
      // Verificar se é linha de detalhe (tipo 3)
      if (linha.length >= 1 && linha[0] === '3') {
        // Segmento A (pagamento)
        if (linha.length >= 11 && linha[10] === 'A') {
          try {
            // Extrair nosso número (posições 130-149 no segmento A)
            const nossoNumero = linha.substring(129, 149).trim();
            // Extrair status do pagamento (posições 220-220)
            const codigoOcorrencia = linha.substring(219, 220);
            
            if (nossoNumero && codigoOcorrencia === '0') {
              // Pagamento confirmado
              const cdParcela = parseInt(nossoNumero);
              if (!isNaN(cdParcela)) {
                parcelasProcessadas.push({
                  cdParcela,
                  status: 'PAGO'
                });
                console.log(`✅ Parcela ${cdParcela} processada como PAGO`);
                
                // Enviar atualização em tempo real para o frontend
                res.write(JSON.stringify({
                  tipo: 'atualizacao',
                  cdParcela,
                  status: 'PAGO',
                  totalProcessadas: parcelasProcessadas.length
                }) + '\n');
              }
            }
          } catch (error) {
            console.error(`❌ Erro ao processar linha ${index + 1}:`, error);
          }
        }
      }
    }

    console.log(`✅ Total de parcelas processadas: ${parcelasProcessadas.length}`);

    // Enviar resultado final
    res.write(JSON.stringify({
      tipo: 'final',
      sucesso: true,
      totalProcessadas: parcelasProcessadas.length,
      parcelasProcessadas: parcelasProcessadas,
      mensagem: `${parcelasProcessadas.length} parcelas foram processadas com sucesso`
    }));
    
    res.end();

  } catch (error) {
    console.error("❌ Erro ao processar arquivo CNAB:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo CNAB",
    });
  }
};

