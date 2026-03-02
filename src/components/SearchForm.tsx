'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, User, Mail, Phone, AtSign, Camera, Rocket, BrainCircuit, Fingerprint, Skull, Gauge, ScanLine, History, Radar } from 'lucide-react';
import { UserHints } from '@/lib/types';

interface SearchFormProps {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  imagePreview: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  hints: UserHints;
  setHints: React.Dispatch<React.SetStateAction<UserHints>>;
  powerModeEnabled: boolean;
  setPowerModeEnabled: (v: boolean) => void;
  stageCount: number[];
  setStageCount: (v: number[]) => void;
  aggressiveMode: boolean;
  setAggressiveMode: (v: boolean) => void;
  confidenceThreshold: number[];
  setConfidenceThreshold: (v: number[]) => void;
  onSearch: () => void;
  isSearching: boolean;
  currentStage: number;
  totalStages: number;
}

export const INTEREST_OPTIONS = [
  'Technology', 'AI/ML', 'Finance', 'Sports', 'Music', 'Gaming',
  'Travel', 'Photography', 'Art', 'Cooking', 'Fitness', 'Reading',
  'Politics', 'Science', 'Entrepreneurship', 'Crypto', 'Real Estate'
];

export function SearchForm({
  name, setName, email, setEmail, phone, setPhone, username, setUsername,
  imagePreview, handleImageUpload, resetImage, fileInputRef,
  hints, setHints, powerModeEnabled, setPowerModeEnabled,
  stageCount, setStageCount, aggressiveMode, setAggressiveMode,
  confidenceThreshold, setConfidenceThreshold, onSearch, isSearching,
  currentStage, totalStages
}: SearchFormProps) {
  
  const hintsCount = [
    hints.age, hints.job, hints.company, hints.location, hints.education,
    ...(hints.interests || []), ...(hints.travelHistory || []), 
    ...(hints.aliases || []), ...(hints.languages || []), ...(hints.previousLocations || [])
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Primary Search */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" />
            Primary Search
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Full Name</Label>
            <Input placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
            <Input placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
            <Input placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><AtSign className="h-3 w-3" /> Username</Label>
            <Input placeholder="johndoe" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Camera className="h-3 w-3" /> Face Image</Label>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full h-8 text-xs">
              <Camera className="h-3 w-3 mr-1" />
              {imagePreview ? 'Change Image' : 'Upload Image'}
            </Button>
            {imagePreview && (
              <div className="relative mt-2">
                <img src={imagePreview} alt="Preview" className="w-full h-20 object-cover rounded" />
                <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-5 w-5 p-0" onClick={resetImage}>×</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Hints */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            User Hints <Badge variant="secondary" className="ml-auto text-xs">{hintsCount} active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <Accordion type="multiple" className="w-full" defaultValue={['basic']}>
            <AccordionItem value="basic" className="border-b-0">
              <AccordionTrigger className="text-xs py-2">Basic Info</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Age" value={hints.age} onChange={(e) => setHints(p => ({ ...p, age: e.target.value }))} className="h-7 text-xs" />
                  <Input placeholder="City" value={hints.location} onChange={(e) => setHints(p => ({ ...p, location: e.target.value }))} className="h-7 text-xs" />
                </div>
                <Input placeholder="Job Title" value={hints.job} onChange={(e) => setHints(p => ({ ...p, job: e.target.value }))} className="h-7 text-xs" />
                <Input placeholder="Company" value={hints.company} onChange={(e) => setHints(p => ({ ...p, company: e.target.value }))} className="h-7 text-xs" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Power Mode Settings */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white rounded-t-lg py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Power Mode <Switch checked={powerModeEnabled} onCheckedChange={setPowerModeEnabled} className="ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Stages: {stageCount[0]}</Label>
            <Slider value={stageCount} onValueChange={setStageCount} max={10} min={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min Confidence: {confidenceThreshold[0]}%</Label>
            <Slider value={confidenceThreshold} onValueChange={setConfidenceThreshold} max={90} min={10} step={5} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSearch} disabled={isSearching || (!name && !email && !phone && !username && !imagePreview)} className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 h-12">
        {isSearching ? <><Radar className="h-5 w-5 mr-2 animate-spin" /> Analyzing...</> : <><Radar className="h-5 w-5 mr-2" /> Execute Search</>}
      </Button>
    </div>
  );
}
