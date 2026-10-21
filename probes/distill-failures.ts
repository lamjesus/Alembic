import { createOpenAI } from "@ai-sdk/openai";
import { distill } from "../src/index";
const contenido =
  " esta leccion tomo mucho mas de  lo esperado que opinas, porque paso?";

type Caso = {
  nombre: string;
  status: number;
  headers: Record<string, string>;
  declaredPath?: string;
};
const json = { "Content-Type": "application/json" };
const casos: Caso[] = [
  {
    nombre: "429  Retry-After:1 ",
    status: 429,
    headers: { ...json, "Retry-After": "1" },
  },
  { nombre: "400", status: 400, headers: json },
  { nombre: "401", status: 401, headers: json },
  { nombre: "500", status: 500, headers: json },
  { nombre: "403 ", status: 403, headers: json },
  {
    nombre: "loadDeclared roto",
    status: 200,
    headers: json,
    declaredPath: "/no/existe.json",
  },
];
// TODO: fetch falso (el de la sonda A, copiado)
let actual: Caso = casos[0];
let llamadas = 0;
const fetchFalso: typeof fetch = async () => {
  llamadas++;
  const body = JSON.stringify({
    error: { message: `fake ${actual.status}`, type: "fake_error" },
  });
  return new Response(body, { status: actual.status, headers: actual.headers });
};
for (const caso of casos) {
  actual = caso;
  // TODO: construir el modelo con createOpenAI({ fetch: fetchFalso, ... })
  const nan = createOpenAI({
    apiKey: "fake",
    baseURL: "http://fake.invalid/v1",
    fetch: fetchFalso,
  });
  try {
    // TODO: const r = await distill(contenido, modelo, rutaDelCaso);
    const r = await distill(
      contenido,
      nan("mimo-v2.6-flash"),
      caso.declaredPath,
    );
    if (r.status === "failed") {
    //   console.log(caso.nombre);
    //   console.log(r.status);
    //   console.log(r.nextStep);
      console.log(r)
    }
  } catch (e) {
    console.log(`${caso.nombre} Lanzo`, (e as Error).message);
  }
}
