"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CoursesBackgroundCardProps = React.ComponentProps<typeof Card>;

export function CoursesBackgroundCard({ className, children, ...props }: CoursesBackgroundCardProps) {
    return (
        <Card
            className={cn(
                "bg-card/60 backdrop-blur",
                className
            )}
            {...props}
        >
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
}


