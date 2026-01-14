import { useEffect, useRef } from "react";

interface Region {
  name: string;
  code: string;
  value: number;
  color: string;
}

interface WorldMapProps {
  regions: Region[];
  title?: string;
}

export default function WorldMap({
  regions,
  title = "Geographic Distribution",
}: WorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // In a real implementation, we would use a mapping library like react-simple-maps
    // For now, we'll just display a placeholder
    if (mapRef.current) {
      const mapElement = mapRef.current;
      mapElement.innerHTML = `
        <div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700 rounded-lg">
          <div class="text-center p-4">
            <p class="text-gray-500 dark:text-gray-400 mb-2">World Map Visualization</p>
            <p class="text-sm text-gray-400 dark:text-gray-500">
              In the actual implementation, this would be an interactive world map 
              showing your stablecoin holdings by region.
            </p>
            <div class="mt-4 grid grid-cols-2 gap-2">
              ${regions
                .map(
                  (region) => `
                <div class="flex items-center p-2 rounded" style="background-color: ${
                  region.color
                }20; border: 1px solid ${region.color}">
                  <div class="size-3 rounded-full mr-2" style="background-color: ${
                    region.color
                  }"></div>
                  <span class="text-sm">${region.name}: ${region.value.toFixed(
                    1
                  )}%</span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
    }
  }, [regions]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div ref={mapRef} className="map-container" />
    </div>
  );
}
