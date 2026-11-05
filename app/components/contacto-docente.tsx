"use client";

import { useState } from "react";
import { CheckIcon, ClipboardDocumentIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { notificar } from "@/app/components/avisos";
import { BTN, BTN_G } from "@/app/components/ui";

// "Enviar mail" al docente de una materia. Abre el cliente de correo del dispositivo con el destinatario
// y el asunto ya cargados; como no todos los equipos tienen uno configurado, también se puede copiar
// la dirección.
export default function ContactoDocente({
    email,
    docente,
    materia,
    alumno,
    compacto = false,
}: {
    email?: string;
    docente: string;
    materia: string;
    alumno?: string;
    compacto?: boolean;
}) {
    const [copiado, setCopiado] = useState(false);

    if (!email) return null;

    const asunto = `Consulta de ${materia}`;
    const saludo = docente.replace(/^Prof\.\s*/, "");
    const cuerpo = `Hola ${saludo}:\n\n\n\nSaludos${alumno ? `,\n${alumno}` : ""}`;
    const href = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(email);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2500);
        } catch {
            notificar(`No se pudo copiar. El correo es ${email}.`);
        }
    };

    const altura = compacto ? "!h-9 !px-3 !text-xs" : "";

    return (
        <div className="flex flex-wrap items-center gap-2">
            <a
                href={href}
                className={`${BTN} ${altura} border border-primary bg-primary text-white hover:bg-primary/90`}
                aria-label={`Enviar un mail a ${docente} (${email})`}
            >
                <EnvelopeIcon className="h-5 w-5" />
                Enviar mail
            </a>
            <button type="button" onClick={copiar} className={`${BTN_G} ${altura}`} aria-live="polite">
                {copiado ? (
                    <>
                        <CheckIcon className="h-5 w-5 text-green-600" />
                        Copiado
                    </>
                ) : (
                    <>
                        <ClipboardDocumentIcon className="h-5 w-5" />
                        Copiar correo
                    </>
                )}
            </button>
        </div>
    );
}
