import type { Metadata } from "next";
import LegajoView from "./legajo-view";

export const metadata: Metadata = { title: "Legajo del alumno | Preceptoría" };

export default function LegajoPage() {
    return <LegajoView />;
}
