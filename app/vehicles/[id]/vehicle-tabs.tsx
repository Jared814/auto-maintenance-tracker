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
    <Tabs defaultValue="maintenance">
      <TabsList className="mx-4 mt-2 mb-1">
        <TabsTrigger value="mpg">
          <span className="flex items-center gap-1.5">
            <Fuel className="size-4" />
            <span>MPG Tracker</span>
          </span>
        </TabsTrigger>
        <TabsTrigger value="maintenance">
          <span className="flex items-center gap-1.5">
            <Wrench className="size-4" />
            <span>Maintenance</span>
          </span>
        </TabsTrigger>
        <TabsTrigger value="info">
          <span className="flex items-center gap-1.5">
            <Info className="size-4" />
            <span>Vehicle Info</span>
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
  );
}
