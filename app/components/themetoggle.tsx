"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );

    if (!mounted) {
        return <div className="w-10 h-10" />;
    }

    const isDark = theme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cambiar tema"
        >
            <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                    <motion.div
                        key="moon"
                        initial={{ scale: 0, rotate: -180, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, rotate: 180, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute"
                    >
                        <MoonIcon className="h-5 w-5 text-yellow-400" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ scale: 0, rotate: -180, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, rotate: 180, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute"
                    >
                        <SunIcon className="h-5 w-5 text-primary" />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );
}