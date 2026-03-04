"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import {
  FileUp,
  File,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
} from "lucide-react";

export default function ShopeeOptimizer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pageCount, setPageCount] = useState<number>(0);

  // Extras
  const [isKitChat, setIsKitChat] = useState(false);
  const [kitChatColors, setKitChatColors] = useState("");

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        setPageCount(pdf.getPageCount());
      } catch (err) {
        setError("Erro ao ler o PDF. Tem certeza de que é um arquivo válido?");
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const processPDF = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const originalPagesCount = originalPdf.getPageCount();

      if (originalPagesCount < 2) {
        throw new Error(
          "O PDF precisa ter pelo menos 2 páginas para ser otimizado (1 Etiqueta, 1 Declaração).",
        );
      }

      const newPdf = await PDFDocument.create();
      const customFont = await newPdf.embedFont(StandardFonts.HelveticaBold);

      const a4Width = 595.28;
      const a4Height = 841.89;
      const halfHeight = a4Height / 2;

      for (let i = 0; i < originalPagesCount; i += 2) {
        const hasDeclaration = i + 1 < originalPagesCount;
        const newPage = newPdf.addPage([a4Width, a4Height]);

        // ==========================================
        // 1. PROCESSAR ETIQUETA (METADE INFERIOR)
        // ==========================================
        const [copiedLabelPage] = await newPdf.copyPages(originalPdf, [i]);

        // Recorta exatamente a metade superior da folha original
        const labelBox = {
          left: 0,
          right: a4Width,
          bottom: halfHeight,
          top: a4Height,
        };
        const embeddedLabel = await newPdf.embedPage(copiedLabelPage, labelBox);

        // Define a escala para ~65% para que a largura da etiqueta caiba na altura da meia página

        const rotatedWidth = embeddedLabel.height;

        // Centraliza no eixo X e coloca o eixo Y num ponto seguro (logo abaixo do meio da folha)
        const xPos = (a4Width - rotatedWidth) / 2;
        const yPos = 405;

        // Cola a etiqueta na metade inferior da nova folha, no tamanho real
        newPage.drawPage(embeddedLabel, {
          x: xPos,
          y: yPos,
          rotate: degrees(-90), // Isso deita a etiqueta na horizontal
        });

        // ==========================================
        // 2. PROCESSAR DECLARAÇÃO (METADE SUPERIOR)
        // ==========================================
        if (hasDeclaration) {
          const [copiedDeclPage] = await newPdf.copyPages(originalPdf, [i + 1]);

          // Recorta exatamente a metade superior da folha original
          const declBox = {
            left: 0,
            right: a4Width,
            bottom: halfHeight,
            top: a4Height,
          };
          const embeddedDeclaration = await newPdf.embedPage(
            copiedDeclPage,
            declBox,
          );

          // Escala a declaração para 93% para abrir espaço no meio da folha
          const scale = 0.93;
          const declWidth = embeddedDeclaration.width * scale;
          const declHeight = embeddedDeclaration.height * scale;
          const declX = (a4Width - declWidth) / 2;
          const declY = a4Height - declHeight; // Alinha ao topo da folha

          // Cola a declaração na metade superior da nova folha, ligeiramente menor
          newPage.drawPage(embeddedDeclaration, {
            x: declX,
            y: declY,
            width: declWidth,
            height: declHeight,
          });

          // Adiciona a informação do Kit Chat no meio da folha (entre declaração e etiqueta)
          if (isKitChat && kitChatColors.trim()) {
            const text = `*** CORES DO KIT: ${kitChatColors.toUpperCase()} ***`;
            let textSize = 14; // Tamanho base da fonte
            let textWidth = customFont.widthOfTextAtSize(text, textSize);

            // Diminui o tamanho da fonte se o texto for muito largo
            const maxWidth = a4Width - 40;
            while (textWidth > maxWidth && textSize > 6) {
              textSize -= 1;
              textWidth = customFont.widthOfTextAtSize(text, textSize);
            }

            const textX = (a4Width - textWidth) / 2;

            // O espaço vazio fica entre o topo da etiqueta (yPos = 405) e a base da declaração (declY)
            const gapCenterY = (yPos + declY) / 2;
            const textY = gapCenterY - (textSize / 3);

            newPage.drawText(
              text,
              {
                x: textX,
                y: textY,
                size: textSize,
                font: customFont,
                color: rgb(0, 0, 0),
              },
            );
          }
        }
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "etiquetas-otimizadas.pdf";
      link.click();
      URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro inesperado ao processar o PDF.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPageCount(0);
    setSuccess(false);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Otimizador de Etiquetas Shopee
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Junte a etiqueta e declaração na mesma folha A4.
          </p>
        </div>

        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-[#ee4d2d] bg-[#ee4d2d]/10"
                : "border-gray-300 hover:border-[#ee4d2d] hover:bg-gray-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex justify-center mb-3">
              <FileUp className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">
              Arraste seu PDF aqui ou clique para selecionar
            </p>
            <p className="text-xs text-gray-400 mt-2">Apenas arquivos .pdf</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start gap-4">
              <File className="w-8 h-8 text-[#ee4d2d] shrink-0" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-gray-800 truncate"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {pageCount} página(s) identificada(s)
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={isKitChat}
                  onChange={(e) => setIsKitChat(e.target.checked)}
                  className="w-4 h-4 rounded text-[#ee4d2d] focus:ring-[#ee4d2d] border-gray-300"
                />
                <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-[#ee4d2d]" />
                  Adicionar cores (Kit Chat)
                </span>
              </label>

              {isKitChat && (
                <div className="mt-4 pl-6">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Quais as cores do Kit?
                  </label>
                  <input
                    type="text"
                    value={kitChatColors}
                    onChange={(e) => setKitChatColors(e.target.value)}
                    placeholder="Ex: 2 Rosa, 1 Azul, 1 Branco..."
                    className="w-full text-sm rounded-md shadow-sm focus:border-[#ee4d2d] focus:ring-[#ee4d2d] p-2.5 border border-gray-300 outline-none transition-colors"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Esta informação aparecerá no rodapé da declaração.
                  </p>
                </div>
              )}
            </div>

            {success && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p>PDF gerado e baixado com sucesso!</p>
              </div>
            )}

            <button
              onClick={processPDF}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-opacity ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#ee4d2d] hover:bg-[#d74325]"
              }`}
            >
              {loading ? "Processando..." : "Processar e Baixar"}
            </button>

            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Escolher outro arquivo
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
