'use client';

import { useState, useCallback } from 'react';
import {
  ResearchSequence,
  ResearchStepConfig,
  ResearchStepTemplate,
  RESEARCH_STEP_TEMPLATES,
  SEQUENCE_TEMPLATES,
} from '@/lib/types/research-sequence';
import {
  Plus,
  Trash2,
  GripVertical,
  Settings,
  Play,
  Save,
  Copy,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  ArrowDown,
  ArrowUp,
  Eye,
  Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ResearchSequenceBuilderProps {
  initialSequence?: ResearchSequence;
  onSave?: (sequence: ResearchSequence) => void;
  onRun?: (sequence: ResearchSequence) => void;
}

function getIconComponent(iconName: string) {
  // Simple icon mapping - in production use dynamic imports
  const icons: Record<string, any> = {
    Image: '🖼️',
    ScanFace: '👤',
    AtSign: '@',
    Mail: '✉️',
    Phone: '📞',
    User: '👤',
    Microscope: '🔬',
    TriangleAlert: '⚠️',
    Database: '🗄️',
    Globe: '🌐',
    Fingerprint: '👆',
    FileText: '📄',
  };
  return icons[iconName] || '📌';
}

function StepCard({
  step,
  index,
  totalSteps,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  step: ResearchStepConfig;
  index: number;
  totalSteps: number;
  onUpdate: (step: ResearchStepConfig) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const template = RESEARCH_STEP_TEMPLATES.find((t) => t.type === step.type);

  return (
    <Card className={cn('border-violet-200', !step.enabled && 'opacity-60')}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div className="flex flex-col gap-1 pt-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={onMoveUp}
              disabled={index === 0}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={onMoveDown}
              disabled={index === totalSteps - 1}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>

          {/* Step Icon */}
          <div className="text-2xl mt-1">{getIconComponent(template?.icon || '')}</div>

          {/* Step Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Step {index + 1}
                </Badge>
                <Input
                  value={step.name}
                  onChange={(e) => onUpdate({ ...step, name: e.target.value })}
                  className="h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
                <Switch
                  checked={step.enabled}
                  onCheckedChange={(checked) => onUpdate({ ...step, enabled: checked })}
                  className="scale-75"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600"
                  onClick={onDuplicate}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                  onClick={onRemove}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {template?.description || step.type}
            </p>

            {/* Condition Badge */}
            {step.condition && (
              <Badge variant="outline" className="mt-1 text-xs">
                {step.condition.type === 'always' && 'Always run'}
                {step.condition.type === 'on_success' && 'On previous success'}
                {step.condition.type === 'on_failure' && 'On previous failure'}
                {step.condition.type === 'on_data_found' && `On data: ${step.condition.field}`}
              </Badge>
            )}

            {/* Expanded Settings */}
            {expanded && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div>
                  <Label className="text-xs">Step Type</Label>
                  <Select
                    value={step.type}
                    onValueChange={(value: any) => {
                      const newTemplate = RESEARCH_STEP_TEMPLATES.find((t) => t.type === value);
                      onUpdate({
                        ...step,
                        type: value,
                        name: newTemplate?.name || step.name,
                        parameters: {
                          ...newTemplate?.defaultParameters,
                          ...step.parameters,
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESEARCH_STEP_TEMPLATES.map((t) => (
                        <SelectItem key={t.type} value={t.type} className="text-xs">
                          {getIconComponent(t.icon)} {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Condition</Label>
                  <Select
                    value={step.condition?.type || 'always'}
                    onValueChange={(value: any) =>
                      onUpdate({
                        ...step,
                        condition: { type: value, field: step.condition?.field },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always" className="text-xs">Always run</SelectItem>
                      <SelectItem value="on_success" className="text-xs">On previous success</SelectItem>
                      <SelectItem value="on_failure" className="text-xs">On previous failure</SelectItem>
                      <SelectItem value="on_data_found" className="text-xs">On data found</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {step.condition?.type === 'on_data_found' && (
                  <div>
                    <Label className="text-xs">Check Field</Label>
                    <Input
                      value={step.condition.field || ''}
                      onChange={(e) =>
                        onUpdate({
                          ...step,
                          condition: { ...step.condition, field: e.target.value },
                        })
                      }
                      className="h-8 text-xs"
                      placeholder="e.g., imageBase64, profiles"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs">Parameters (JSON)</Label>
                  <Input
                    value={JSON.stringify(step.parameters, null, 2)}
                    onChange={(e) => {
                      try {
                        onUpdate({
                          ...step,
                          parameters: JSON.parse(e.target.value),
                        });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="h-20 font-mono text-xs"
                    placeholder='{"key": "value"}'
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={step.timeout || 30000}
                      onChange={(e) =>
                        onUpdate({ ...step, timeout: parseInt(e.target.value) || 30000 })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Retry Count</Label>
                    <Input
                      type="number"
                      value={step.retryCount || 0}
                      onChange={(e) =>
                        onUpdate({ ...step, retryCount: parseInt(e.target.value) || 0 })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResearchSequenceBuilder({
  initialSequence,
  onSave,
  onRun,
}: ResearchSequenceBuilderProps) {
  const [sequence, setSequence] = useState<ResearchSequence>(
    initialSequence || {
      id: Math.random().toString(36).substring(2, 9),
      name: 'New Research Sequence',
      description: '',
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    }
  );

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const updateStep = useCallback((updatedStep: ResearchStepConfig) => {
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === updatedStep.id ? updatedStep : s)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addStep = useCallback((type: ResearchStepConfig['type']) => {
    const template = RESEARCH_STEP_TEMPLATES.find((t) => t.type === type);
    const newStep: ResearchStepConfig = {
      id: Math.random().toString(36).substring(2, 9),
      name: template?.name || type,
      type,
      enabled: true,
      parameters: template?.defaultParameters || {},
      condition: { type: 'always' },
      timeout: 30000,
      retryCount: 0,
    };

    setSequence((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updatedAt: new Date().toISOString(),
    }));
    setShowTemplateDialog(false);
  }, []);

  const duplicateStep = useCallback((step: ResearchStepConfig) => {
    const newStep: ResearchStepConfig = {
      ...step,
      id: Math.random().toString(36).substring(2, 9),
      name: `${step.name} (Copy)`,
    };

    setSequence((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setSequence((prev) => {
      const newSteps = [...prev.steps];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newSteps.length) return prev;

      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
      return {
        ...prev,
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const loadTemplate = useCallback((template: ResearchSequence) => {
    setSequence({
      ...template,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowTemplateDialog(false);
  }, []);

  const resetSequence = useCallback(() => {
    setSequence({
      id: Math.random().toString(36).substring(2, 9),
      name: 'New Research Sequence',
      description: '',
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(sequence);
  }, [sequence, onSave]);

  const handleRun = useCallback(() => {
    onRun?.(sequence);
  }, [sequence, onRun]);

  const categories = ['all', ...new Set(RESEARCH_STEP_TEMPLATES.map((t) => t.category))];
  const filteredTemplates =
    selectedCategory === 'all'
      ? RESEARCH_STEP_TEMPLATES
      : RESEARCH_STEP_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Input
            value={sequence.name}
            onChange={(e) =>
              setSequence((prev) => ({ ...prev, name: e.target.value }))
            }
            className="text-lg font-semibold border-0 bg-transparent p-0 focus-visible:ring-0"
          />
          <Input
            value={sequence.description || ''}
            onChange={(e) =>
              setSequence((prev) => ({ ...prev, description: e.target.value }))
            }
            className="text-sm text-muted-foreground border-0 bg-transparent p-0 focus-visible:ring-0"
            placeholder="Add a description..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={resetSequence}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={sequence.steps.length === 0}
            className="bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            <Play className="h-4 w-4 mr-1" /> Run Sequence
          </Button>
        </div>
      </div>

      <Separator />

      {/* Steps List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Research Steps</Label>
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add Step
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Research Step</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat)}
                      className="text-xs capitalize"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
                <ScrollArea className="h-96">
                  <div className="grid grid-cols-2 gap-3">
                    {filteredTemplates.map((template) => (
                      <Card
                        key={template.type}
                        className="cursor-pointer hover:border-violet-400 transition-colors"
                        onClick={() => addStep(template.type as any)}
                      >
                        <CardContent className="p-4">
                          <div className="text-2xl mb-2">{getIconComponent(template.icon)}</div>
                          <h4 className="font-semibold text-sm">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs capitalize">
                            {template.category}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {sequence.steps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No steps added yet</p>
              <p className="text-xs">Click "Add Step" to build your research sequence</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sequence.steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                totalSteps={sequence.steps.length}
                onUpdate={updateStep}
                onRemove={() => removeStep(step.id)}
                onMoveUp={() => moveStep(index, 'up')}
                onMoveDown={() => moveStep(index, 'down')}
                onDuplicate={() => duplicateStep(step)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load Template */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Or Load Template</Label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {SEQUENCE_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                size="sm"
                variant="outline"
                onClick={() => loadTemplate(template)}
                className="justify-start text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                {template.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {sequence.steps.length > 0 && (
        <Card className="bg-violet-50/50 border-violet-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {sequence.steps.filter((s) => s.enabled).length} of{' '}
                  {sequence.steps.length} steps enabled
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated runtime:{' '}
                  {sequence.steps.filter((s) => s.enabled).length * 15}-
                  {sequence.steps.filter((s) => s.enabled).length * 30} seconds
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                v{sequence.version}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
