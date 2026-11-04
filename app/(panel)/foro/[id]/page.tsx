import type { Metadata } from "next";
import TemaView from "./tema-view";

export const metadata: Metadata = { title: "Debate | ET N°24" };

export default function DebatePage() {
    return <TemaView />;
}
