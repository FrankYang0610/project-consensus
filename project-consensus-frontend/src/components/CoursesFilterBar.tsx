"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

type MultiSelectOption = {
    value: string;
    label: string;
};

interface CoursesFilterBarProps {
    className?: string;
    onApply?: (filters: Record<string, unknown>) => void;
}

export function CoursesFilterBar({ className, onApply }: CoursesFilterBarProps) {
    const { t } = useI18n();

    const [category, setCategory] = React.useState<string>("all");
    const [sort, setSort] = React.useState<string>("rating");
    const [showAdvanced, setShowAdvanced] = React.useState<boolean>(false);

    const [subjectCode, setSubjectCode] = React.useState("");
    const [subjectTitle, setSubjectTitle] = React.useState("");
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [filterCategories, setFilterCategories] = React.useState<string[]>([]);
    const [levels, setLevels] = React.useState<string[]>([]);
    const [teacherName, setTeacherName] = React.useState("");

    const categorySelectOptions: MultiSelectOption[] = [
        { value: "all", label: t("courses.topbar.category.all") },
        { value: "major", label: t("courses.topbar.category.major") },
        { value: "car", label: "CAR" },
        { value: "gur", label: "GUR" },
        { value: "pg", label: t("courses.topbar.category.postgraduate") },
    ];

    const sortSelectOptions: MultiSelectOption[] = [
        { value: "rating", label: t("courses.topbar.sort.rating") },
        { value: "reviews", label: t("courses.topbar.sort.reviews") },
        { value: "composite", label: t("courses.topbar.sort.composite") },
    ];

    const departmentOptions: MultiSelectOption[] = [
        { value: "apss", label: "APSS" },
        { value: "eee", label: "EEE" },
        { value: "ise", label: "ISE" },
        { value: "mm", label: "MM" },
    ];

    // Detailed Category options are independent from the main category select
    const detailedCategoryOptions: MultiSelectOption[] = [
        { value: "projectHeavy", label: t("courses.topbar.detailedCategory.options.projectHeavy") },
        { value: "examHeavy", label: t("courses.topbar.detailedCategory.options.examHeavy") },
        { value: "writingIntensive", label: t("courses.topbar.detailedCategory.options.writingIntensive") },
        { value: "presentationHeavy", label: t("courses.topbar.detailedCategory.options.presentationHeavy") },
    ];

    const levelOptions: MultiSelectOption[] = [
        { value: "0", label: "0" },
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
        { value: "6", label: "6" },
    ];

    const toggleSelection = (list: string[], value: string, setter: (v: string[]) => void) => {
        setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
    };

    const handleApply = () => {
        onApply?.({ category, sort, subjectCode, subjectTitle, departments, categories: filterCategories, levels, teacherName });
    };

    return (
        <div className={cn("w-full", className)}>
            <div className="flex flex-wrap items-center justify-evenly gap-y-2 md:gap-y-3 w-full">
                {/* Category Select */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs justify-between">
                            <span className="text-muted-foreground">{t("courses.topbar.category.label")}:</span>
                            <span className="ml-1">{categorySelectOptions.find(o => o.value === category)?.label}</span>
                            <ChevronDown className="ml-2 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                        <DropdownMenuRadioGroup value={category} onValueChange={(v) => setCategory(v)}>
                            {categorySelectOptions.map(opt => (
                                <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort Select */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs justify-between">
                            <span className="text-muted-foreground">{t("courses.topbar.sortBy")}:</span>
                            <span className="ml-1">{sortSelectOptions.find(o => o.value === sort)?.label}</span>
                            <ChevronDown className="ml-2 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                        <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v)}>
                            {sortSelectOptions.map(opt => (
                                <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Subject Code (inline on md and up) */}
                <div className="hidden md:flex items-center gap-2">
                    <Label htmlFor="subjectCodeTop" className="text-xs whitespace-nowrap">
                        {t("courses.topbar.subjectCode")}:
                    </Label>
                    <Input
                        id="subjectCodeTop"
                        value={subjectCode}
                        onChange={(e) => setSubjectCode(e.target.value)}
                        placeholder={t("courses.topbar.subjectCodePlaceholder")}
                        className="h-8 text-xs w-32 md:w-40 lg:w-48"
                    />
                </div>

                {/* Subject Title (inline on md and up) */}
                <div className="hidden md:flex items-center gap-2">
                    <Label htmlFor="subjectTitleTop" className="text-xs whitespace-nowrap">
                        {t("courses.topbar.subjectTitle")}:
                    </Label>
                    <Input
                        id="subjectTitleTop"
                        value={subjectTitle}
                        onChange={(e) => setSubjectTitle(e.target.value)}
                        placeholder={t("courses.topbar.subjectTitlePlaceholder")}
                        className="h-8 text-xs w-32 md:w-40 lg:w-48"
                    />
                </div>

                {/* Advanced Toggle */}
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowAdvanced(v => !v)}>
                    {t("courses.topbar.advancedFilters")}
                    <ChevronDown className={cn("ml-2 transition-transform", showAdvanced && "rotate-180")} />
                </Button>

                {/* Apply (Quick) */}
                <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
                    {t("courses.topbar.apply")}
                </Button>
            </div>

            {showAdvanced && (
                <div className="mt-3 space-y-3 border rounded-md p-3 max-h-80 overflow-auto">
                    {/* On small screens, show subject code/title here */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        <div className="space-y-1.5">
                            <Label htmlFor="subjectCode" className="text-xs">{t("courses.topbar.subjectCode")}</Label>
                            <Input
                                id="subjectCode"
                                value={subjectCode}
                                onChange={(e) => setSubjectCode(e.target.value)}
                                placeholder={t("courses.topbar.subjectCodePlaceholder")}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="subjectTitle" className="text-xs">{t("courses.topbar.subjectTitle")}</Label>
                            <Input
                                id="subjectTitle"
                                value={subjectTitle}
                                onChange={(e) => setSubjectTitle(e.target.value)}
                                placeholder={t("courses.topbar.subjectTitlePlaceholder")}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Course Department */}
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("courses.topbar.offeringDepartment")}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-between">
                                        <span>
                                            {departments.length > 0
                                                ? `${t("courses.topbar.selectedCount", { count: departments.length })}`
                                                : t("courses.topbar.selectPlaceholder")}
                                        </span>
                                        <ChevronDown className="opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                                    {departmentOptions.map(opt => (
                                        <DropdownMenuCheckboxItem
                                            key={opt.value}
                                            checked={departments.includes(opt.value)}
                                            onCheckedChange={() => toggleSelection(departments, opt.value, setDepartments)}
                                            className="text-xs"
                                        >
                                            {opt.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Detailed Category */}
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("courses.topbar.detailedCategory.label")}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-between">
                                        <span>
                                            {filterCategories.length > 0
                                                ? `${t("courses.topbar.selectedCount", { count: filterCategories.length })}`
                                                : t("courses.topbar.selectPlaceholder")}
                                        </span>
                                        <ChevronDown className="opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                                {detailedCategoryOptions.map(opt => (
                                        <DropdownMenuCheckboxItem
                                            key={opt.value}
                                            checked={filterCategories.includes(opt.value)}
                                            onCheckedChange={() => toggleSelection(filterCategories, opt.value, setFilterCategories)}
                                            className="text-xs"
                                        >
                                            {opt.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Subject Level */}
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("courses.topbar.subjectLevel")}</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-between">
                                        <span>
                                            {levels.length > 0
                                                ? `${t("courses.topbar.selectedCount", { count: levels.length })}`
                                                : t("courses.topbar.selectPlaceholder")}
                                        </span>
                                        <ChevronDown className="opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-64 overflow-auto">
                                    {levelOptions.map(opt => (
                                        <DropdownMenuCheckboxItem
                                            key={opt.value}
                                            checked={levels.includes(opt.value)}
                                            onCheckedChange={() => toggleSelection(levels, opt.value, setLevels)}
                                            className="text-xs"
                                        >
                                            {opt.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Teacher Name */}
                        <div className="space-y-1.5 md:col-span-3">
                            <Label htmlFor="teacherName" className="text-xs">{t("courses.topbar.teacherName")}</Label>
                            <Input
                                id="teacherName"
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                placeholder={t("courses.topbar.teacherNamePlaceholder")}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


