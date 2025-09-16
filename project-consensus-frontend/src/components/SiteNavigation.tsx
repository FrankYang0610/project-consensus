'use client';

import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { forwardRef, useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { Menu, X, ChevronDown, ArrowLeft } from 'lucide-react';
import Image from "next/image";
//Local Components
import { LoginComponent } from './LoginComponent';
import { SearchBar } from './SearchBar';
import { UserMenu } from './UserMenu';
import { useApp } from '@/contexts/AppContext';
import { Language } from '@/types/app-types';


/**
 * Language options configuration
 * Contains language codes and their display names
 */
const languageOptions = [
    {
        code: 'zh-CN' as Language,
        name: '简体中文',
        flag: '🇨🇳',
    },
    {
        code: 'zh-HK' as Language,
        name: '繁體中文',
        flag: '🇭🇰',
    },
    {
        code: 'en-US' as Language,
        name: 'English',
        flag: '🇺🇸',
    },
];

/**
 * ListItem Component - Renders individual items in dropdown menus
 * Uses forwardRef to support Radix UI's internal ref forwarding
 */
interface ListItemProps {
    className?: string;
    title: string;
    children: React.ReactNode;
    href: string;
    target?: string;
    rel?: string;
}

const ListItem = forwardRef<HTMLAnchorElement, ListItemProps>(
    ({ className, title, children, ...props }, ref) => {
        return (
            <li>
                <NavigationMenuLink asChild>
                    <a
                        ref={ref}
                        className={cn(
                            // Base styles: block element, rounded corners, padding, transition effects
                            'block select-none space-y-1 rounded-md p-4 leading-none no-underline outline-none transition-colors',
                            // Hover and focus states: change background and text color
                            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                            className
                        )}
                        {...props}
                    >
                        {/* Menu item title - larger font and bold */}
                        <div className="text-base font-medium leading-none">{title}</div>
                        {/* Menu item description - smaller font and muted color */}
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-2">
                            {children}
                        </p>
                    </a>
                </NavigationMenuLink>
            </li>
        );
    }
);
ListItem.displayName = 'ListItem';

/**
 * Custom navigation menu trigger styles
 * Extends default styles with increased height, padding, and font size
 */
const customNavigationMenuTriggerStyle = () => cn(
    navigationMenuTriggerStyle(),
    "h-12 px-6 text-base font-medium"
);

/**
 * SiteNavigation - Main navigation bar component
 * Includes both desktop and mobile navigation solutions
 */
interface SiteNavigationProps {
    showBackButton?: boolean;
    onBackClick?: () => void;
}

export function SiteNavigation({ showBackButton = false, onBackClick }: SiteNavigationProps = {}) {
    // i18n translation and language management
    const { t, language, changeLanguage } = useI18n();
    
    // Auth状态 / Auth status
    const { isLoggedIn, isLoading } = useApp();
    
    // Controls mobile menu open/close state
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Controls mobile dropdown expansion states
    // Uses object to store multiple dropdown states
    const [mobileDropdowns, setMobileDropdowns] = useState({
        more: false,
    });

    // Search input state is now handled by SearchBar component

    /**
     * Toggle specific mobile dropdown open/close state
     * @param {string} key - Dropdown identifier ('forum')
     */
    const toggleMobileDropdown = (key: 'more') => {
        setMobileDropdowns(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    // Search form submission is now handled by SearchBar component

    /**
     * Get current language display information
     */
    const getCurrentLanguage = () => {
        return languageOptions.find(lang => lang.code === language) || languageOptions[0];
    };

    /**
     * Get translated menu items
     */
    const getTranslatedMenuItems = () => {
        return {
            forumItems: [
                {
                    title: t('menu.techSupport'),
                    href: '/support',
                    description: t('menu.techSupportDesc'),
                },
                {
                    title: t('menu.featureRequests'),
                    href: '/features',
                    description: t('menu.featureRequestsDesc'),
                },
                {
                    title: t('menu.announcements'),
                    href: '/announcements',
                    description: t('menu.announcementsDesc'),
                },
            ],
            linksItems: [
                {
                    title: t('menu.documentation'),
                    href: '/docs',
                    description: t('menu.documentationDesc'),
                },
                {
                    title: t('menu.discord'),
                    href: 'https://discord.com',
                    description: t('menu.discordDesc'),
                    external: true,
                },
                {
                    title: t('menu.resources'),
                    href: '/resources',
                    description: t('menu.resourcesDesc'),
                },
            ]
        };
    };

    /**
     * Handle language change
     * @param {Language} newLanguage - New language code
     */
    const handleLanguageChange = (newLanguage: Language) => {
        changeLanguage(newLanguage);
        // Close mobile menu if open
        if (isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
        }
    };

    // Get translated menu items
    const { forumItems: translatedForumItems, linksItems: translatedLinksItems } = getTranslatedMenuItems();

    return (
        <nav className={cn(
            // Sticky positioning at top, z-index ensures it stays above other content
            "sticky top-0 z-50 w-full",
            // Border and background: semi-transparent background with blur effect
            "border-b bg-background/95 backdrop-blur",
            // For browsers supporting backdrop-filter, use more transparent background
            "supports-[backdrop-filter]:bg-background/60"
        )}>
            {/* Main navigation container - max width constraint and centered */}
            <div className="grid grid-cols-3 h-20 items-center px-6 lg:px-8 xl:px-12 2xl:px-16">

                {/* Logo area - click to return home */}
                <div className="flex items-center">
                    {showBackButton && (
                        <button
                            onClick={onBackClick}
                            className="mr-4 p-2 hover:bg-accent rounded-md transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <Link href="/" className="flex items-center space-x-2">
                        <Image
                            className="dark:invert"
                            src="/project-consensus-icon.svg"
                            alt="project-consensus-icon"
                            width={225}
                            height={60}
                            priority
                        />
                    </Link>
                </div>

                {/* Desktop navigation menu - visible on medium screens and up */}
                <div className="flex justify-center">
                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList className="gap-2">

                        {/* Home navigation item - simple link without dropdown */}
                        <NavigationMenuItem>
                            <NavigationMenuLink
                                href="/"
                                className={customNavigationMenuTriggerStyle()}
                            >
                                {t('navigation.forum')}
                            </NavigationMenuLink>
                        </NavigationMenuItem>

                        {/* Course Review navigation item - simple link without dropdown */}
                        <NavigationMenuItem>
                            <NavigationMenuLink
                                href="/courses"
                                className={customNavigationMenuTriggerStyle()}
                            >
                                {t('navigation.courseReview')}
                            </NavigationMenuLink>
                        </NavigationMenuItem>

                        {/* [More] navigation item - includes dropdown menu */}
                        <NavigationMenuItem>
                            {/* Trigger button - shows dropdown on click or hover */}
                            <NavigationMenuTrigger className="h-12 px-6 text-base font-medium">
                                {t('navigation.more')}
                            </NavigationMenuTrigger>
                            {/* Dropdown content container */}
                            <NavigationMenuContent>
                                {/* Grid layout with responsive columns */}
                                <ul className="grid w-[500px] gap-3 p-6 md:w-[600px] md:grid-cols-2 lg:w-[700px]">
                                    {translatedForumItems.map((item) => (
                                        <ListItem
                                            key={item.title}
                                            title={item.title}
                                            href={item.href}
                                        >
                                            {item.description}
                                        </ListItem>
                                    ))}

                                    {translatedLinksItems.map((item) => (
                                        <ListItem
                                            key={item.title}
                                            title={item.title}
                                            href={item.href}
                                            // External links open in new tab
                                            target={item.external ? '_blank' : undefined}
                                            // Security attributes for external links
                                            rel={item.external ? 'noopener noreferrer' : undefined}
                                        >
                                            {item.description}
                                        </ListItem>
                                    ))}
                                </ul>
                            </NavigationMenuContent>
                        </NavigationMenuItem>

                        {/* About navigation item - simple link without dropdown */}
                        <NavigationMenuItem>
                            <NavigationMenuLink
                                href="/about"
                                className={customNavigationMenuTriggerStyle()}
                            >
                                {t('navigation.about')}
                            </NavigationMenuLink>
                        </NavigationMenuItem>

                    </NavigationMenuList>
                </NavigationMenu>
                </div>

                {/* Right side - Search bar, login, and mobile menu button */}
                <div className="flex justify-end items-center gap-4">
                    {/* Search bar - visible on larger screens */}
                    <SearchBar className="hidden lg:flex" placeholder={t('search.placeholder')} />

                    {/* Language Switcher - visible on larger screens */}
                    <div className="hidden md:block">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-2 h-9 px-3">
                                    <span className="text-sm">{getCurrentLanguage().flag}</span>
                                    <span className="hidden lg:inline text-sm">{getCurrentLanguage().name}</span>
                                    <span className="lg:hidden">{getCurrentLanguage().flag}</span>
                                    <ChevronDown size={12} className="opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                {languageOptions.map((langOption) => (
                                    <DropdownMenuItem
                                        key={langOption.code}
                                        onClick={() => handleLanguageChange(langOption.code)}
                                        className={cn(
                                            "flex items-center gap-2 cursor-pointer",
                                            language === langOption.code && "bg-accent text-accent-foreground"
                                        )}
                                    >
                                        <span>{langOption.flag}</span>
                                        <span className="text-sm">{langOption.name}</span>
                                        {language === langOption.code && (
                                            <span className="ml-auto text-xs">✓</span>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* User authentication component - visible on larger screens */}
                    <div className="hidden md:block">
                        {!isLoading && (
                            isLoggedIn ? (
                                <UserMenu />
                            ) : (
                                <LoginComponent />
                            )
                        )}
                    </div>

                    {/* Mobile menu button - only visible on small screens */}
                    <button
                        className="md:hidden p-2 hover:bg-accent rounded-md transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {/* Show different icon based on menu state */}
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile navigation menu - only visible on mobile when menu is open */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t bg-background">
                    <div className="container px-4 py-2 space-y-1">

                        {/* Mobile: Search + Login inline */}
                        <div className="py-2 flex items-center gap-2">
                            <SearchBar className="flex-1" showMobileVersion={true} placeholder={t('search.placeholder')} />
                            {!isLoading && (
                                isLoggedIn ? (
                                    <UserMenu />
                                ) : (
                                    <LoginComponent />
                                )
                            )}
                        </div>

                        {/* Forum link - mobile simple link */}
                        <Link
                            href="/"
                            className="block py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)} // Close menu after click
                        >
                            {t('navigation.forum')}
                        </Link>

                        {/* Course Review link - mobile simple link */}
                        <Link
                            href="/courses"
                            className="block py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {t('navigation.courseReview')}
                        </Link>

                        {/* More collapsible section */}
                        <div>
                            {/* More collapse button */}
                            <button
                                className="flex items-center justify-between w-full py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                                onClick={() => toggleMobileDropdown('more')}
                            >
                                <span>{t('navigation.more')}</span>
                                {/* Arrow icon - rotates 180 degrees when expanded */}
                                <ChevronDown
                                    size={16}
                                    className={cn(
                                        "transition-transform duration-200",
                                        mobileDropdowns.more && "rotate-180"
                                    )}
                                />
                            </button>
                            {/* More submenu - only visible when expanded */}
                            {mobileDropdowns.more && (
                                <div className="ml-4 mt-1 space-y-1">
                                    {translatedForumItems.map((item) => (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            className="block py-2 px-3 text-sm hover:bg-accent rounded-md transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <div className="font-medium">{item.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {item.description}
                                            </div>
                                        </Link>
                                    ))}
                                    {translatedLinksItems.map((item) => (
                                        item.external ? (
                                            <a
                                                key={item.title}
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block py-2 px-3 text-sm hover:bg-accent rounded-md transition-colors"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <div className="font-medium">{item.title}</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {item.description}
                                                </div>
                                            </a>
                                        ) : (
                                            <Link
                                                key={item.title}
                                                href={item.href}
                                                className="block py-2 px-3 text-sm hover:bg-accent rounded-md transition-colors"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <div className="font-medium">{item.title}</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {item.description}
                                                </div>
                                            </Link>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* About link - mobile simple link */}
                        <Link
                            href="/about"
                            className="block py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {t('navigation.about')}
                        </Link>

                        {/* Language Switcher - mobile */}
                        <div className="border-t pt-2 mt-2">
                            <div className="px-2 pb-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                    <span>{t('navigation.language')}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {languageOptions.map((langOption) => (
                                        <button
                                            key={langOption.code}
                                            onClick={() => handleLanguageChange(langOption.code)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left",
                                                "hover:bg-accent hover:text-accent-foreground",
                                                language === langOption.code 
                                                    ? "bg-accent text-accent-foreground font-medium" 
                                                    : ""
                                            )}
                                        >
                                            <span className="text-base">{langOption.flag}</span>
                                            <span>{langOption.name}</span>
                                            {language === langOption.code && (
                                                <span className="ml-auto text-xs">✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}