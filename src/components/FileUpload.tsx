import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileSelected, isProcessing }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === 'application/pdf') {
      setSelectedFile(file);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleProcess = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer',
          dragActive
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50',
          isProcessing && 'pointer-events-none opacity-60'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-input')?.click()}
      >
        <input
          id="pdf-input"
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          {selectedFile ? (
            <>
              <FileText className="h-12 w-12 text-primary" />
              <p className="text-lg font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">
                Arraste o PDF do DOU Seção 3 aqui
              </p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar o arquivo
              </p>
            </>
          )}
        </div>
      </div>

      {selectedFile && (
        <Button
          onClick={handleProcess}
          disabled={isProcessing}
          className="w-full h-12 text-base"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processando com IA...
            </>
          ) : (
            <>
              <FileText className="h-5 w-5" />
              Processar Documento
            </>
          )}
        </Button>
      )}
    </div>
  );
}
