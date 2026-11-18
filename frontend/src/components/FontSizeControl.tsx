import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "../lib/app";

/**
 * HU-A-25: control de tamaño de letra para personas con baja visión.
 * Toda la interfaz usa rem, así que cambiar el tamaño raíz escala textos, botones y espacios
 * por igual. La preferencia se recuerda en el equipo.
 */
const STORAGE_KEY = "trackline-font-scale";
const LEVELS = [100, 115, 130, 150] as const;

function storedLevel(): number {
  const n = Number(readStorage(STORAGE_KEY));
  const i = LEVELS.indexOf(n as (typeof LEVELS)[number]);
  return i >= 0 ? i : 0;
}

function apply(index: number) {
  document.documentElement.style.fontSize = `${LEVELS[index]}%`;
}

// Se aplica antes del primer render para que la página no "salte" al cargar.
apply(storedLevel());

export default function FontSizeControl({ light = false }: { light?: boolean }) {
  const [level, setLevel] = useState(storedLevel);

  useEffect(() => {
    apply(level);
    writeStorage(STORAGE_KEY, level === 0 ? null : String(LEVELS[level]));
  }, [level]);

  const percent = LEVELS[level];
  return (
    <div className={`font-size-control${light ? " light" : ""}`} role="group" aria-label="Tamaño de la letra">
      <button type="button" onClick={() => setLevel((l) => Math.max(0, l - 1))} disabled={level === 0} aria-label="Reducir tamaño de letra" title="Reducir letra">
        A<span aria-hidden="true">−</span>
      </button>
      <button type="button" className="font-size-reset" onClick={() => setLevel(0)} disabled={level === 0} aria-label={`Tamaño actual ${percent}%. Restablecer`} title="Tamaño normal">
        {percent}%
      </button>
      <button type="button" className="font-size-up" onClick={() => setLevel((l) => Math.min(LEVELS.length - 1, l + 1))} disabled={level === LEVELS.length - 1} aria-label="Aumentar tamaño de letra" title="Aumentar letra">
        A<span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
