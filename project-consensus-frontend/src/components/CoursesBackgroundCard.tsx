"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CoursesBackgroundCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
    contentProps?: React.ComponentPropsWithoutRef<typeof CardContent>;
}

export const CoursesBackgroundCard = React.forwardRef<HTMLDivElement, CoursesBackgroundCardProps>(
    ({ className, children, contentProps, ...props }, ref) => {
        const { className: contentClassName, ...restContentProps } = contentProps ?? {};

        return (
            <Card
                ref={ref}
                className={cn("bg-card/60 backdrop-blur", className)}
                {...props}
            >
                <CardContent className={contentClassName} {...restContentProps}>
                    {children}
                </CardContent>
            </Card>
        );
    }
);

CoursesBackgroundCard.displayName = "CoursesBackgroundCard";

