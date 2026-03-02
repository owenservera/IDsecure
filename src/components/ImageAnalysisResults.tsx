'use client';

import { useState } from 'react';
import { 
  UploadedImage, 
  ImageAnalysisResult,
  DetectedData 
} from './MultiImageUploader';
import { 
  FileText, 
  User, 
  MapPin, 
  Building2, 
  Phone, 
  Mail, 
  Home, 
  Hash,
  Calendar,
  QrCode,
  Barcode,
  Users,
  Tag,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Target,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ImageAnalysisResultsProps {
  images: UploadedImage[];
  crossImageInsights?: {
    commonEntities?: {
      people?: string[];
      locations?: string[];
      organizations?: string[];
    };
    timelineConnections?: string[];
    relationshipPatterns?: string[];
    contradictions?: string[];
    combinedInsights?: string[];
    investigativeLeads?: string[];
  };
}

interface CrossImageInsightsProps {
  insights: NonNullable<ImageAnalysisResultsProps['crossImageInsights']>;
}

function CrossImageInsights({ insights }: CrossImageInsightsProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Cross-Image Intelligence</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-6"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {insights.commonEntities && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Common Entities</span>
              </div>
              <div className="flex flex-wrap gap-1 ml-6">
                {insights.commonEntities.people?.map((name, i) => (
                  <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700">
                    <User className="h-3 w-3 mr-1" />{name}
                  </Badge>
                ))}
                {insights.commonEntities.locations?.map((loc, i) => (
                  <Badge key={i} variant="outline" className="bg-green-50 text-green-700">
                    <MapPin className="h-3 w-3 mr-1" />{loc}
                  </Badge>
                ))}
                {insights.commonEntities.organizations?.map((org, i) => (
                  <Badge key={i} variant="outline" className="bg-purple-50 text-purple-700">
                    <Building2 className="h-3 w-3 mr-1" />{org}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {insights.timelineConnections && insights.timelineConnections.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Timeline Connections</span>
              </div>
              <ul className="ml-6 space-y-1">
                {insights.timelineConnections.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <ChevronRight className="h-3 w-3 mt-0.5" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.combinedInsights && insights.combinedInsights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Combined Insights</span>
              </div>
              <ul className="ml-6 space-y-1">
                {insights.combinedInsights.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <CheckCircle className="h-3 w-3 mt-0.5 text-green-600" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.investigativeLeads && insights.investigativeLeads.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Investigative Leads</span>
              </div>
              <ul className="ml-6 space-y-1">
                {insights.investigativeLeads.map((item, i) => (
                  <li key={i} className="text-xs text-amber-900 font-medium flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.contradictions && insights.contradictions.length > 0 && (
            <div className="border-t pt-2">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">Contradictions Found</span>
              </div>
              <ul className="ml-6 space-y-1">
                {insights.contradictions.map((item, i) => (
                  <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                    <ChevronRight className="h-3 w-3 mt-0.5" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DataSection({ 
  title, 
  icon, 
  data, 
  color = "violet" 
}: { 
  title: string; 
  icon: React.ReactNode; 
  data?: string[] | number; 
  color?: string;
}) {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const colorClasses: Record<string, string> = {
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1 ml-4">
        {Array.isArray(data) ? (
          data.map((item, i) => (
            <Badge 
              key={i} 
              variant="outline" 
              className={`text-xs ${colorClasses[color]}`}
            >
              {item}
            </Badge>
          ))
        ) : (
          <Badge variant="outline" className={`text-xs ${colorClasses[color]}`}>
            {data}
          </Badge>
        )}
      </div>
    </div>
  );
}

function SingleImageAnalysis({ 
  image, 
  analysis 
}: { 
  image: UploadedImage; 
  analysis: ImageAnalysisResult; 
}) {
  const [expanded, setExpanded] = useState(true);
  const [showFullText, setShowFullText] = useState(false);

  const detectedData = analysis.detectedData;

  return (
    <Card className="border-violet-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-violet-200">
              <img src={image.preview} alt="thumbnail" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="font-medium text-sm">{image.file.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {detectedData.documentType || 'Unknown Type'}
                </Badge>
                <Badge className="text-xs bg-violet-600">
                  {analysis.confidence}% confidence
                </Badge>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-6"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="bg-violet-50/50 rounded-lg p-3">
            <p className="text-sm text-violet-900">{analysis.summary}</p>
          </div>

          {/* Key Findings */}
          {analysis.keyFindings && analysis.keyFindings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Key Findings</span>
              </div>
              <ul className="space-y-1 ml-6">
                {analysis.keyFindings.map((finding, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <ChevronRight className="h-3 w-3 mt-0.5" />{finding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Separator />

          {/* Extracted Data Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataSection 
              title="Names" 
              icon={<User className="h-3 w-3" />} 
              data={detectedData.names}
              color="blue"
            />
            <DataSection 
              title="Dates" 
              icon={<Calendar className="h-3 w-3" />} 
              data={detectedData.dates}
              color="violet"
            />
            <DataSection 
              title="Locations" 
              icon={<MapPin className="h-3 w-3" />} 
              data={detectedData.locations}
              color="green"
            />
            <DataSection 
              title="Organizations" 
              icon={<Building2 className="h-3 w-3" />} 
              data={detectedData.organizations}
              color="purple"
            />
            <DataSection 
              title="Phone Numbers" 
              icon={<Phone className="h-3 w-3" />} 
              data={detectedData.phoneNumbers}
              color="orange"
            />
            <DataSection 
              title="Emails" 
              icon={<Mail className="h-3 w-3" />} 
              data={detectedData.emails}
              color="blue"
            />
            <DataSection 
              title="Addresses" 
              icon={<Home className="h-3 w-3" />} 
              data={detectedData.addresses}
              color="green"
            />
            <DataSection 
              title="ID Numbers" 
              icon={<Hash className="h-3 w-3" />} 
              data={detectedData.idNumbers}
              color="red"
            />
            <DataSection 
              title="Faces Detected" 
              icon={<Users className="h-3 w-3" />} 
              data={detectedData.faces}
              color="violet"
            />
            <DataSection 
              title="Logos" 
              icon={<Tag className="h-3 w-3" />} 
              data={detectedData.logos}
              color="purple"
            />
            {detectedData.qrCodes && detectedData.qrCodes.length > 0 && (
              <DataSection 
                title="QR Codes" 
                icon={<QrCode className="h-3 w-3" />} 
                data={detectedData.qrCodes}
                color="violet"
              />
            )}
            {detectedData.barcodes && detectedData.barcodes.length > 0 && (
              <DataSection 
                title="Barcodes" 
                icon={<Barcode className="h-3 w-3" />} 
                data={detectedData.barcodes}
                color="violet"
              />
            )}
          </div>

          {/* Full Text Content */}
          {detectedData.textContent && detectedData.textContent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Extracted Text</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowFullText(!showFullText)}
                  className="h-6 text-xs"
                >
                  {showFullText ? 'Show Less' : 'Show All'}
                </Button>
              </div>
              <div className={`bg-slate-50 dark:bg-slate-900 rounded-lg p-3 font-mono text-xs overflow-auto ${showFullText ? 'max-h-96' : 'max-h-24'}`}>
                <ScrollArea className="h-full">
                  <pre className="whitespace-pre-wrap text-muted-foreground">
                    {detectedData.textContent}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Action Items */}
          {analysis.actionItems && analysis.actionItems.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Recommended Actions</span>
              </div>
              <ul className="space-y-1 ml-6">
                {analysis.actionItems.map((action, i) => (
                  <li key={i} className="text-xs text-blue-700 flex items-start gap-1">
                    <CheckCircle className="h-3 w-3 mt-0.5" />{action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function ImageAnalysisResults({ images, crossImageInsights }: ImageAnalysisResultsProps) {
  const analyzedImages = images.filter(img => img.status === 'analyzed' && img.analysis);

  if (analyzedImages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Cross-Image Intelligence */}
      {crossImageInsights && analyzedImages.length > 1 && (
        <CrossImageInsights insights={crossImageInsights} />
      )}

      {/* Individual Image Analyses */}
      <div className="space-y-4">
        {analyzedImages.map((img) => (
          <SingleImageAnalysis
            key={img.id}
            image={img}
            analysis={img.analysis!}
          />
        ))}
      </div>
    </div>
  );
}
