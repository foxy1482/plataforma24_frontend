import type { Metadata } from "next";
import BoletinView from "./boletin-view";

export const metadata: Metadata = { title: "Revisar boletín | Preceptoría" };

export default function BoletinPage() {
    return <BoletinView />;
}
