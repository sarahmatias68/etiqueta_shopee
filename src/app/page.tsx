"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import { FileUp, File, CheckCircle2, AlertCircle } from "lucide-react";

export default function ShopeeOptimizer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pageCount, setPageCount] = useState<number>(0);

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
        throw new Error("O PDF precisa ter pelo menos 2 páginas para ser otimizado (1 Etiqueta, 1 Declaração).");
      }

      const newPdf = await PDFDocument.create();

      // Itera as páginas de 2 em 2
      for (let i = 0; i < originalPagesCount; i += 2) {
        // Se a quantidade de páginas for ímpar, a última página ficará sozinha.
        const hasDeclaration = i + 1 < originalPagesCount;

        // Cria uma nova página A4
        const a4Width = 595.28;
        const a4Height = 841.89;
        const newPage = newPdf.addPage([a4Width, a4Height]);

        // Incorpora a página da Etiqueta
        const [copiedLabelPage] = await newPdf.copyPages(originalPdf, [i]);
        const embeddedLabel = await newPdf.embedPage(copiedLabelPage);
        
        // Área disponível para cada metade
        const halfHeight = a4Height / 2;

        // Desenha a etiqueta na metade SUPERIOR
        const labelScale = Math.min(
          a4Width / embeddedLabel.width,
          halfHeight / embeddedLabel.height
        );
        const labelDims = embeddedLabel.scale(labelScale);
        
        newPage.drawPage(embeddedLabel, {
          ...labelDims,
          x: (a4Width - labelDims.width) / 2,
          y: halfHeight + (halfHeight - labelDims.height) / 2,
        });

        // Se houver uma contraparte (Declaração), desenha na metade INFERIOR
        if (hasDeclaration) {
          const [copiedDeclPage] = await newPdf.copyPages(originalPdf, [i + 1]);
          const embeddedDeclaration = await newPdf.embedPage(copiedDeclPage);
          
          const declScale = Math.min(
            a4Width / embeddedDeclaration.width,
            halfHeight / embeddedDeclaration.height
          );
          const declDims = embeddedDeclaration.scale(declScale);

          newPage.drawPage(embeddedDeclaration, {
            ...declDims,
            x: (a4Width - declDims.width) / 2,
            y: (halfHeight - declDims.height) / 2,
          });
        }
      }

      // Salva o novo PDF
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Dispara o download
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
          <h1 className="text-2xl font-bold text-gray-800">Otimizador de Etiquetas Shopee</h1>
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
                <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
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
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#ee4d2d] hover:bg-[#d74325]"
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
