import React from "react";
import { motion } from "framer-motion";

interface DashboardCardProps {
    title: string;
    icon?: React.ReactNode;
    value?: string | number;
    subtitle?: string;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    color?: "blue" | "green" | "red" | "amber" | "purple";
    size?: "sm" | "md" | "lg";
    onClick?: () => void;
    children?: React.ReactNode;
    className?: string;
}

const colorClasses = {
    blue: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
    green: "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
    red: "from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20",
    amber: "from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
    purple: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
};

/**
 * Reusable dashboard card component
 * Replaces collapsible sections with always-visible cards
 */
export default function DashboardCard({
    title,
    icon,
    value,
    subtitle,
    trend,
    color = "blue",
    size = "md",
    onClick,
    children,
    className = "",
}: DashboardCardProps) {
    const isInteractive = !!onClick;

    const sizeClasses = {
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
    };

    const Component = isInteractive ? motion.button : motion.div;

    return (
        <Component
            onClick={onClick}
            whileHover={isInteractive ? { scale: 1.01 } : undefined}
            whileTap={isInteractive ? { scale: 0.99 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`
        bg-gradient-to-br ${colorClasses[color]}
        rounded-2xl shadow-lg backdrop-blur-sm
        ${sizeClasses[size]}
        ${isInteractive ? "cursor-pointer hover:shadow-xl transition-shadow" : ""}
        ${className}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-xl">{icon}</span>}
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {title}
                    </h3>
                </div>
                {trend && (
                    <div
                        className={`text-xs font-bold ${trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            }`}
                    >
                        {trend.value}
                    </div>
                )}
            </div>

            {/* Value */}
            {value !== undefined && (
                <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                    {value}
                </div>
            )}

            {/* Subtitle */}
            {subtitle && (
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    {subtitle}
                </div>
            )}

            {/* Children (charts, buttons, etc) */}
            {children}
        </Component>
    );
}

/**
 * Small card variant for grid layouts
 */
export function DashboardCardSmall({
    icon,
    label,
    value,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onClick?: () => void;
}) {
    return (
        <DashboardCard
            title={label}
            icon={icon}
            value={value}
            size="sm"
            onClick={onClick}
            className="text-center"
        />
    );
}
