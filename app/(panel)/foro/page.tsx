import type { Metadata } from "next";
import ForoView from "./foro-view";

export const metadata: Metadata = { title: "Foro | ET N°24" };

export default function ForoPage() {
    return <ForoView />;
}
