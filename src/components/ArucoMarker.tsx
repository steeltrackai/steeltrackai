import React from 'react';

interface ArucoMarkerProps {
    id: number;
    size?: number;
    dictionary?: '4x4' | '5x5';
}

/**
 * ArUco Marker Generator Component
 * Generates an ArUco marker as an SVG based on the ID and dictionary.
 * Logic based on standard ArUco dictionary encoding.
 */
export const ArucoMarker: React.FC<ArucoMarkerProps> = ({ id, size = 150, dictionary = '4x4' }) => {
    // Simple 4x4 Dictionary bit patterns (Example subset for demonstration)
    // In a real production app, we would include the full dictionary or a library.
    // This is a simplified parity-based generation for 4x4.

    const generate4x4Grid = (markerId: number) => {
        const grid = Array(4).fill(0).map(() => Array(4).fill(0));
        let tempId = markerId;

        // Populate bits based on ID (simplified logic for demo purposes)
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 4; j++) {
                grid[i][j] = (tempId >> (i * 4 + j)) & 1;
            }
        }

        // Simple parity/ECC for the bottom rows (simplified)
        for (let j = 0; j < 4; j++) {
            grid[2][j] = grid[0][j] ^ grid[1][j];
            grid[3][j] = grid[0][j] & grid[1][j];
        }

        return grid;
    };

    const grid = generate4x4Grid(id);
    const cellSize = size / (dictionary === '4x4' ? 6 : 7); // including border

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
            {/* Background (White margin) */}
            <rect width={size} height={size} fill="white" />

            {/* Black Border */}
            <rect
                x={cellSize}
                y={cellSize}
                width={size - 2 * cellSize}
                height={size - 2 * cellSize}
                fill="black"
            />

            {/* Data Cells */}
            {grid.map((row, i) => (
                row.map((cell, j) => (
                    cell === 0 && (
                        <rect
                            key={`${i}-${j}`}
                            x={(j + 1) * cellSize}
                            y={(i + 1) * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill="black"
                        />
                    )
                ))
            ))}

            {/* White Cells */}
            {grid.map((row, i) => (
                row.map((cell, j) => (
                    cell === 1 && (
                        <rect
                            key={`${i}-${j}`}
                            x={(j + 1) * cellSize}
                            y={(i + 1) * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill="white"
                        />
                    )
                ))
            ))}
        </svg>
    );
};
