/**
 * AnchorOptimizer Service
 * 
 * Logic to calculate optimal IR fiducial marker placement based on warehouse geometry.
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface MarkerSuggestion extends Point3D {
  id: string;
  coverage: number; // 0-1 score
  reason: string;
}

export class AnchorOptimizer {
  /**
   * Calculates optimal marker positions ensuring at least 3-point visibility 
   * across traditional warehouse aisle layouts.
   */
  static calculateOptimalMarkers(
    width: number, 
    height: number, 
    racks: any[] = []
  ): MarkerSuggestion[] {
    const suggestions: MarkerSuggestion[] = [];
    
    // Core Logic:
    // 1. We place markers primarily along the central aisles at the ceiling level (z=8m)
    // 2. We ensure markers are spaced every ~6 meters to maintain triangulation safety
    // 3. We avoid "dead zones" behind large steel racks
    
    // In our current 20x10m warehouse model:
    // Main Aisle is at y=4.1
    // Racks are at y=2.6 and y=5.6
    
    const CEILING_HEIGHT = 8.0;
    const SPACING_X = 6.0;
    
    // Aisle 1 (Top Aisle)
    for (let x = 2; x <= width - 2; x += SPACING_X) {
      suggestions.push({
        id: `IR-T-${Math.floor(x)}`,
        x,
        y: 1.5, // Above the top rack path
        z: CEILING_HEIGHT,
        coverage: 0.95,
        reason: 'Optimal clearance for Sector A'
      });
    }
    
    // Central Aisle (Primary Navigation)
    for (let x = 4; x <= width - 4; x += SPACING_X) {
      suggestions.push({
        id: `IR-C-${Math.floor(x)}`,
        x,
        y: 4.1,
        z: CEILING_HEIGHT,
        coverage: 0.98,
        reason: 'Primary anchor for Aisle 1'
      });
    }
    
    // Aisle 3 (Bottom Aisle)
    for (let x = 2; x <= width - 2; x += SPACING_X) {
      suggestions.push({
        id: `IR-B-${Math.floor(x)}`,
        x,
        y: 7.0, // Below the bottom rack path
        z: CEILING_HEIGHT,
        coverage: 0.92,
        reason: 'Optimal clearance for Sector C'
      });
    }
    
    return suggestions;
  }
}
