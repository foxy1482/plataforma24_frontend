import type { Metadata } from "next";
import ModeracionView from "./moderacion-view";

export const metadata: Metadata = { title: "Moderación del foro | Preceptoría" };

export default function ModeracionPage() {
    return <ModeracionView />;
}
