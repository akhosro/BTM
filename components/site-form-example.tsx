"use client";

/**
 * Example usage of SiteFormWithGeocoding component
 *
 * This shows how to integrate the geocoding site form into your application.
 */

import { useState } from "react";
import { SiteFormWithGeocoding, type SiteFormData } from "./site-form-with-geocoding";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function SiteFormExample() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleCreateSite = async (data: SiteFormData) => {
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create site");
      }

      const newSite = await response.json();

      // Success!
      toast.success("Site created successfully!", {
        description: `${newSite.name} has been added to your portfolio.`,
      });

      setOpen(false);
      router.refresh(); // Refresh to show new site
    } catch (error) {
      // Error is handled by the form component
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Site
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Site</DialogTitle>
        </DialogHeader>
        <SiteFormWithGeocoding
          onSubmit={handleCreateSite}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Alternative: Full Page Form
 */
export function SiteFormPage() {
  const router = useRouter();

  const handleCreateSite = async (data: SiteFormData) => {
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create site");
    }

    const newSite = await response.json();

    toast.success("Site created successfully!");
    router.push("/dashboard"); // Navigate to dashboard
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-8">Add New Site</h1>
      <SiteFormWithGeocoding
        onSubmit={handleCreateSite}
        onCancel={() => router.back()}
      />
    </div>
  );
}
