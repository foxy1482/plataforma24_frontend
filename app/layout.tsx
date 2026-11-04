import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/app/components/navbar";
import { Avisos } from "@/app/components/avisos";
import { ThemeProvider } from "@/app/components/themeprovider";

export const metadata: Metadata = {
    title: "Plataforma 24 | Educación Premium",
    description: "Tu plataforma escolar de confianza.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={`font-libertinus bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased min-h-screen flex flex-col transition-colors duration-300`}>
                <ThemeProvider 
                    attribute="class" 
                    defaultTheme="system" 
                    enableSystem
                >
                    <Navbar />
                    {/* Un <div>, no <main>: los paneles ya definen su propio <main> y no puede haber dos. */}
                    <div className="flex-grow flex flex-col">
                        {children}
                    </div>
                    <Avisos />
                </ThemeProvider>
            </body>
        </html>
    );
}