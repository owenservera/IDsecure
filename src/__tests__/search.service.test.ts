/**
 * Unit Tests for Search Service
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSearchQueries,
  calculateConfidence,
  extractPlatform,
  extractLocation,
  extractCompany,
  extractProfession,
  deduplicateResults,
  calculateStatisticalAnalysis,
} from '@/services/search/search.service';
import type { SearchResult } from '@/lib/types';

describe('Search Service', () => {
  describe('buildSearchQueries', () => {
    it('should build name-based queries', () => {
      const queries = buildSearchQueries(
        { name: 'John Doe' },
        { stages: 3 }
      );
      
      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toContain('John Doe');
      expect(queries[0]).toContain('social media profile');
    });

    it('should build email-based queries', () => {
      const queries = buildSearchQueries(
        { email: 'john@example.com' },
        { stages: 3 }
      );
      
      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toContain('john@example.com');
    });

    it('should build cross-reference queries', () => {
      const queries = buildSearchQueries(
        { name: 'John Doe', location: 'New York' },
        { stages: 3 }
      );
      
      expect(queries.some(q => q.includes('New York'))).toBe(true);
    });

    it('should limit queries for non-deep scan', () => {
      const queries = buildSearchQueries(
        { name: 'John Doe', email: 'john@example.com', phone: '123456' },
        { stages: 3, deepScan: false }
      );
      
      expect(queries.length).toBeLessThanOrEqual(5);
    });

    it('should allow more queries for deep scan', () => {
      const queries = buildSearchQueries(
        { name: 'John Doe' },
        { stages: 3, deepScan: true }
      );
      
      expect(queries.length).toBeLessThanOrEqual(8);
    });
  });

  describe('extractPlatform', () => {
    it('should identify LinkedIn', () => {
      expect(extractPlatform('https://linkedin.com/in/johndoe'))
        .toBe('LinkedIn');
    });

    it('should identify Twitter/X', () => {
      expect(extractPlatform('https://twitter.com/johndoe'))
        .toBe('Twitter/X');
      expect(extractPlatform('https://x.com/johndoe'))
        .toBe('Twitter/X');
    });

    it('should identify Facebook', () => {
      expect(extractPlatform('https://facebook.com/johndoe'))
        .toBe('Facebook');
    });

    it('should identify GitHub', () => {
      expect(extractPlatform('https://github.com/johndoe'))
        .toBe('GitHub');
    });

    it('should return Web for unknown platforms', () => {
      expect(extractPlatform('https://example.com/profile'))
        .toBe('Web');
    });
  });

  describe('extractLocation', () => {
    it('should extract location with "based in" pattern', () => {
      const text = 'Software engineer based in San Francisco, CA';
      expect(extractLocation(text)).toBe('San Francisco, CA');
    });

    it('should extract location with "living in" pattern', () => {
      const text = 'Currently living in New York, NY';
      expect(extractLocation(text)).toBe('New York, NY');
    });

    it('should return undefined for no location', () => {
      expect(extractLocation('Software engineer at Google')).toBeUndefined();
    });
  });

  describe('extractCompany', () => {
    it('should extract company with "works at" pattern', () => {
      const text = 'John works at Google as a software engineer';
      expect(extractCompany(text)).toBe('Google');
    });

    it('should extract company with "employee at" pattern', () => {
      const text = 'Senior employee at Microsoft since 2020';
      expect(extractCompany(text)).toBe('Microsoft');
    });

    it('should return undefined for no company', () => {
      expect(extractCompany('Freelance developer')).toBeUndefined();
    });
  });

  describe('extractProfession', () => {
    it('should extract common professions', () => {
      expect(extractProfession('Works as a Software Engineer')).toBe('Software Engineer');
      expect(extractProfession('Is a Data Scientist')).toBe('Data Scientist');
      expect(extractProfession('Product Manager at tech company')).toBe('Product Manager');
    });

    it('should return undefined for no profession', () => {
      expect(extractProfession('Just a regular person')).toBeUndefined();
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate high confidence for exact match', () => {
      const item = {
        name: 'John Doe Profile',
        snippet: 'John Doe is a software engineer',
        url: 'https://linkedin.com/in/johndoe',
      };
      const query = 'John Doe';
      
      const confidence = calculateConfidence(item, query);
      expect(confidence).toBeGreaterThan(50);
    });

    it('should calculate lower confidence for partial match', () => {
      const item = {
        name: 'Jane Smith',
        snippet: 'Different person entirely',
        url: 'https://example.com',
      };
      const query = 'John Doe';
      
      const confidence = calculateConfidence(item, query);
      expect(confidence).toBeLessThan(60);
    });
  });

  describe('deduplicateResults', () => {
    it('should remove duplicate URLs', () => {
      const existing: SearchResult[] = [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/john', title: 'John', snippet: '', confidence: 80, stage: 1 },
      ];
      const newResults: SearchResult[] = [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/john', title: 'John Duplicate', snippet: '', confidence: 75, stage: 1 },
        { platform: 'Twitter', url: 'https://twitter.com/john', title: 'John Twitter', snippet: '', confidence: 70, stage: 1 },
      ];

      const result = deduplicateResults(existing, newResults);
      
      expect(result.length).toBe(1);
      expect(result[0].url).toBe('https://twitter.com/john');
    });

    it('should keep all results if no duplicates', () => {
      const existing: SearchResult[] = [];
      const newResults: SearchResult[] = [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/john', title: 'John', snippet: '', confidence: 80, stage: 1 },
        { platform: 'Twitter', url: 'https://twitter.com/john', title: 'John', snippet: '', confidence: 70, stage: 1 },
      ];

      const result = deduplicateResults(existing, newResults);
      
      expect(result.length).toBe(2);
    });
  });

  describe('calculateStatisticalAnalysis', () => {
    it('should return zeros for empty results', () => {
      const analysis = calculateStatisticalAnalysis([]);
      
      expect(analysis.overallConfidence).toBe(0);
      expect(analysis.profileCorrelation).toBe(0);
    });

    it('should calculate averages for results', () => {
      const results: SearchResult[] = [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/john', title: 'John', snippet: '', confidence: 80, stage: 1 },
        { platform: 'Twitter', url: 'https://twitter.com/john', title: 'John', snippet: '', confidence: 60, stage: 1 },
      ];

      const analysis = calculateStatisticalAnalysis(results);
      
      expect(analysis.overallConfidence).toBe(70);
      expect(analysis.networkAnalysis.connections).toBe(2);
    });

    it('should identify strong network for many results', () => {
      const results: SearchResult[] = Array(6).fill(null).map((_, i) => ({
        platform: 'LinkedIn',
        url: `https://linkedin.com/in/john${i}`,
        title: `John ${i}`,
        snippet: '',
        confidence: 80,
        stage: 1,
      }));

      const analysis = calculateStatisticalAnalysis(results);
      
      expect(analysis.networkAnalysis.networkStrength).toBe('strong');
    });
  });
});
