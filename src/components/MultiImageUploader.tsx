'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  base64: string;
  status: 'pending' | 'analyzing' | 'analyzed' | 'error';
  analysis?: ImageAnalysisResult;
}

export interface ImageAnalysisResult {
  detectedData: DetectedData;
  confidence: number;
  summary: string;
}

export interface DetectedData {
  documentType?: string;
  names?: string[];
  dates?: string[];
  locations?: string[];
  organizations?: string[];
  phoneNumbers?: string[];
  emails?: string[];
  addresses?: string[];
  idNumbers?: string[];
  textContent?: string;
  qrCodes?: string[];
  barcodes?: string[];
  faces?: number;
  logos?: string[];
  distinctiveFeatures?: string[];
}

interface MultiImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  onAnalyze?: (images: UploadedImage[]) => void;
  isAnalyzing?: boolean;
}

export function MultiImageUploader({
  images,
  onImagesChange,
  onAnalyze,
  isAnalyzing = false
}: MultiImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const processFile = useCallback((file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        resolve({
          id: generateId(),
          file,
          preview: result,
          base64,
          status: 'pending' as const
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (validFiles.length === 0) return;

    const processedImages = await Promise.all(
      validFiles.map(file => processFile(file))
    );

    onImagesChange([...images, ...processedImages]);
  }, [images, onImagesChange, processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  }, [handleFiles]);

  const removeImage = useCallback((id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  }, [images, onImagesChange]);

  const clearAll = useCallback(() => {
    onImagesChange([]);
  }, [onImagesChange]);

  const handleAnalyze = useCallback(() => {
    if (onAnalyze) {
      onAnalyze(images);
    }
  }, [images, onAnalyze]);

  const analyzedCount = images.filter(img => img.status === 'analyzed').length;
  const analyzingCount = images.filter(img => img.status === 'analyzing').length;

  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-violet-600" />
            <span className="font-semibold text-sm">Evidence Images</span>
            {images.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                {images.length} image{images.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {images.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAll}
              className="h-7 text-xs text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Clear All
            </Button>
          )}
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging
              ? 'border-violet-500 bg-violet-100'
              : 'border-violet-300 hover:border-violet-400 hover:bg-violet-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <Upload className="h-8 w-8 mx-auto text-violet-400 mb-2" />
          <p className="text-sm font-medium text-violet-900">
            Drop images here or click to upload
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports: JPG, PNG, GIF, WebP (Multiple files)
          </p>
        </div>

        {/* Analyze Button */}
        {images.length > 0 && (
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzingCount > 0}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            {isAnalyzing || analyzingCount > 0 ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing with AI... ({analyzedCount}/{images.length})
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze All Images with AI
              </>
            )}
          </Button>
        )}

        {/* Progress */}
        {analyzingCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Analysis Progress</span>
              <span className="font-medium">{Math.round((analyzedCount / images.length) * 100)}%</span>
            </div>
            <Progress value={(analyzedCount / images.length) * 100} className="h-2" />
          </div>
        )}

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-violet-200 bg-white">
                  <img
                    src={img.preview}
                    alt={img.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Status Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  {img.status === 'analyzed' && img.analysis && (
                    <Badge className="bg-green-500">
                      ✓ Analyzed
                    </Badge>
                  )}
                  {img.status === 'analyzing' && (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  )}
                  {img.status === 'error' && (
                    <Badge variant="destructive">Error</Badge>
                  )}
                  {img.status === 'pending' && (
                    <span className="text-white text-xs">Ready</span>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>

                {/* Analysis Badge */}
                {img.status === 'analyzed' && img.analysis && (
                  <div className="absolute bottom-1 left-1 right-1">
                    <Badge className="w-full text-[9px] bg-violet-600/90 justify-center">
                      <FileText className="h-2 w-2 mr-1" />
                      {img.analysis.detectedData.documentType || 'Document'}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
