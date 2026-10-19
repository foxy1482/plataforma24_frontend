import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/app/components/navbar";
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
                    <main className="flex-grow flex flex-col">
                        {children}
                    </main>
                </ThemeProvider>
            </body>
        </html>
    );
}