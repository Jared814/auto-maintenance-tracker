'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Fuel, Wrench, Info } from 'lucide-react';

export function VehicleTabs({
  mpgContent,
  maintenanceContent,
  infoContent,
}: {
  mpgContent: React.ReactNode;
  maintenanceContent: React.ReactNode;
  infoContent: React.ReactNode;
}) {
  return (
    <>
      {/* Mobile: tabbed layout */}
      <div className="md:hidden">
        <Tabs defaultValue="maintenance">
          <TabsList>
            <TabsTrigger value="mpg">
              <span className="flex flex-col items-center gap-0.5">
                <Fuel className="size-4" />
                <span className="text-xs">MPG</span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <span className="flex flex-col items-center gap-0.5">
                <Wrench className="size-4" />
                <span className="text-xs">Maintenance</span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="info">
              <span className="flex flex-col items-center gap-0.5">
                <Info className="size-4" />
                <span className="text-xs">Vehicle Info</span>
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mpg" className="p-4 space-y-4">
            {mpgContent}
          </TabsContent>
          <TabsContent value="maintenance" className="p-4 space-y-4">
            {maintenanceContent}
          </TabsContent>
          <TabsContent value="info" className="p-4 space-y-4">
            {infoContent}
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: all sections visible */}
      <div className="hidden md:block space-y-6">
        {mpgContent}
        {maintenanceContent}
        {infoContent}
      </div>
    </>
  );
}
