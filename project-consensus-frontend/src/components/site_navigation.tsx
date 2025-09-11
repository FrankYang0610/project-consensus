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
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { forwardRef, useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';

/**
 * Forum section submenu items configuration
 * Each item contains title, path, and description
 */
const forumItems = [
    {
        title: 'General Discussion',
        href: '/forum/general',
        description: 'Join the community conversation',
    },
    {
        title: 'Technical Support',
        href: '/forum/support',
        description: 'Get help with technical issues',
    },
    {
        title: 'Feature Requests',
        href: '/forum/features',
        description: 'Suggest new features and improvements',
    },
    {
        title: 'Announcements',
        href: '/forum/announcements',
        description: 'Stay updated with latest news',
    },
];

/**
 * Links section submenu items configuration
 * external: true indicates external links that open in new tab
 */
const linksItems = [
    {
        title: 'Documentation',
        href: '/docs',
        description: 'Comprehensive guides and API references',
    },
    {
        title: 'GitHub',
        href: 'https://github.com',
        description: 'View source code and contribute',
        external: true,
    },
    {
        title: 'Discord',
        href: 'https://discord.com',
        description: 'Join our community chat',
        external: true,
    },
    {
        title: 'Resources',
        href: '/resources',
        description: 'Useful tools and materials',
    },
];

/**
 * ListItem Component - Renders individual items in dropdown menus
 * Uses forwardRef to support Radix UI's internal ref forwarding
 *
 * @param {string} className - Custom style classes
 * @param {string} title - Menu item title
 * @param {ReactNode} children - Menu item description content
 * @param {object} props - Other props passed to the link (e.g., href, target)
 */
const ListItem = forwardRef(({ className, title, children, ...props }, ref) => {
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
});
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
export function SiteNavigation() {
    // Controls mobile menu open/close state
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Controls mobile dropdown expansion states
    // Uses object to store multiple dropdown states
    const [mobileDropdowns, setMobileDropdowns] = useState({
        forum: false,
        links: false,
    });

    /**
     * Toggle specific mobile dropdown open/close state
     * @param {string} key - Dropdown identifier ('forum' or 'links')
     */
    const toggleMobileDropdown = (key) => {
        setMobileDropdowns(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

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
                <Link href="/" className="flex items-center space-x-2">
                    <span className="font-bold text-2xl lg:text-3xl">Project Consensus</span>
                </Link>
                </div>

                {/* Desktop navigation menu - visible on medium screens and up */}
                <div className="flex justify-center">
                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList className="gap-2">

                        {/* Home navigation item - simple link without dropdown */}
                        <NavigationMenuItem>
                            <Link href="/" passHref>
                                <NavigationMenuLink className={customNavigationMenuTriggerStyle()}>
                                    Home
                                </NavigationMenuLink>
                            </Link>
                        </NavigationMenuItem>

                        {/* Forum navigation item - includes dropdown menu */}
                        <NavigationMenuItem>
                            {/* Trigger button - shows dropdown on click or hover */}
                            <NavigationMenuTrigger className="h-12 px-6 text-base font-medium">
                                Forum
                            </NavigationMenuTrigger>
                            {/* Dropdown content container */}
                            <NavigationMenuContent>
                                {/* Grid layout with responsive columns */}
                                <ul className="grid w-[500px] gap-3 p-6 md:w-[600px] md:grid-cols-2 lg:w-[700px]">
                                    {forumItems.map((item) => (
                                        <ListItem
                                            key={item.title}
                                            title={item.title}
                                            href={item.href}
                                        >
                                            {item.description}
                                        </ListItem>
                                    ))}
                                </ul>
                            </NavigationMenuContent>
                        </NavigationMenuItem>


                        {/* Links navigation item - includes dropdown menu */}
                        <NavigationMenuItem>
                            <NavigationMenuTrigger className="h-12 px-6 text-base font-medium">
                                Links
                            </NavigationMenuTrigger>
                            <NavigationMenuContent>
                                <ul className="grid w-[500px] gap-3 p-6 md:w-[600px] md:grid-cols-2 lg:w-[700px]">
                                    {linksItems.map((item) => (
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
                            <Link href="/about" passHref>
                                <NavigationMenuLink className={customNavigationMenuTriggerStyle()}>
                                    About
                                </NavigationMenuLink>
                            </Link>
                        </NavigationMenuItem>
                    </NavigationMenuList>
                </NavigationMenu>
                </div>
                <div className="flex justify-end">
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

                        {/* Home link - mobile simple link */}
                        <Link
                            href="/"
                            className="block py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)} // Close menu after click
                        >
                            Home
                        </Link>

                        {/* Forum collapsible section */}
                        <div>
                            {/* Forum collapse button */}
                            <button
                                className="flex items-center justify-between w-full py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                                onClick={() => toggleMobileDropdown('forum')}
                            >
                                <span>Forum</span>
                                {/* Arrow icon - rotates 180 degrees when expanded */}
                                <ChevronDown
                                    size={16}
                                    className={cn(
                                        "transition-transform duration-200",
                                        mobileDropdowns.forum && "rotate-180"
                                    )}
                                />
                            </button>
                            {/* Forum submenu - only visible when expanded */}
                            {mobileDropdowns.forum && (
                                <div className="ml-4 mt-1 space-y-1">
                                    {forumItems.map((item) => (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            className="block py-2 px-3 text-sm hover:bg-accent rounded-md transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {/* Submenu item title */}
                                            <div className="font-medium">{item.title}</div>
                                            {/* Submenu item description */}
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {item.description}
                                            </div>
                                        </Link>
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
                            About
                        </Link>

                        {/* Links collapsible section */}
                        <div>
                            {/* Links collapse button */}
                            <button
                                className="flex items-center justify-between w-full py-3 px-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                                onClick={() => toggleMobileDropdown('links')}
                            >
                                <span>Links</span>
                                <ChevronDown
                                    size={16}
                                    className={cn(
                                        "transition-transform duration-200",
                                        mobileDropdowns.links && "rotate-180"
                                    )}
                                />
                            </button>
                            {/* Links submenu - only visible when expanded */}
                            {mobileDropdowns.links && (
                                <div className="ml-4 mt-1 space-y-1">
                                    {linksItems.map((item) => (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            className="block py-2 px-3 text-sm hover:bg-accent rounded-md transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            // External link attributes
                                            target={item.external ? '_blank' : undefined}
                                            rel={item.external ? 'noopener noreferrer' : undefined}
                                        >
                                            <div className="font-medium">
                                                {item.title}
                                                {/* External link indicator */}
                                                {item.external && (
                                                    <span className="ml-1 text-xs">↗</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {item.description}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}