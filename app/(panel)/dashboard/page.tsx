import type { Metadata } from "next";
import DashboardView from "./dashboard-view";

export const metadata: Metadata = { title: "Inicio | ET N°24" };

export default function DashboardPage() {
    return <DashboardView />;
}
