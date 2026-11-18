import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  X, 
  Eye, 
  MoveUp, 
  MoveDown, 
  Trash2, 
  Type, 
  Copy, 
  Check, 
  Maximize2, 
  RotateCcw,
  Sliders
} from "lucide-react";

export default function TigranTool() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [active, setActive] = useState(false);
  const [selectedEl, setSelectedEl] = useState(null);
  const [hoveredEl, setHoveredEl] = useState(null);
  const [changes, setChanges] = useState([]);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Contrôles rapides de l'élément sélectionné
  const [textValue, setTextValue] = useState("");
  const [paddingVal, setPaddingVal] = useState("");
  const [widthVal, setWidthVal] = useState("");
  const [heightVal, setHeightVal] = useState("");

  const originalStates = useRef(new Map());

  // Détection stricte : PC uniquement (largeur >= 1024px et souris/clavier)
  useEffect(() => {
    const checkIsPc = () => {
      const isLarge = window.innerWidth >= 1024;
      const isMouse = window.matchMedia("(pointer: fine)").matches;
      setIsDesktop(isLarge && isMouse);
    };
    const pointer = window.matchMedia("(pointer: fine)");
    checkIsPc();
    window.addEventListener("resize", checkIsPc);
    if (pointer.addEventListener) pointer.addEventListener("change", checkIsPc);
    else pointer.addListener?.(checkIsPc);
    return () => {
      window.removeEventListener("resize", checkIsPc);
      if (pointer.removeEventListener) pointer.removeEventListener("change", checkIsPc);
      else pointer.removeListener?.(checkIsPc);
    };
  }, []);

  // Gestion du survol et de la sélection
  useEffect(() => {
    if (!active || !isDesktop) {
      if (!isDesktop && active) setActive(false);
      if (hoveredEl) hoveredEl.style.outline = "";
      if (selectedEl) selectedEl.style.outline = "";
      setHoveredEl(null);
      setSelectedEl(null);
      return;
    }

    const handleMouseOver = (e) => {
      if (e.target.closest("#tigran-overlay-root")) return;
      e.stopPropagation();
      if (hoveredEl && hoveredEl !== e.target && hoveredEl !== selectedEl) {
        hoveredEl.style.outline = "";
      }
      setHoveredEl(e.target);
      if (e.target !== selectedEl) {
        e.target.style.outline = "2px dashed #f59e0b";
        e.target.style.outlineOffset = "2px";
      }
    };

    const handleMouseOut = (e) => {
      if (e.target.closest("#tigran-overlay-root")) return;
      if (e.target !== selectedEl) {
        e.target.style.outline = "";
      }
    };

    const handleClick = (e) => {
      if (e.target.closest("#tigran-overlay-root")) return;
      e.preventDefault();
      e.stopPropagation();

      if (selectedEl) {
        selectedEl.style.outline = "";
      }

      const target = e.target;
      target.style.outline = "3px solid #eab308";
      target.style.outlineOffset = "3px";
      setSelectedEl(target);

      // Enregistrer l'état d'origine si pas encore fait
      if (!originalStates.current.has(target)) {
        originalStates.current.set(target, {
          text: target.innerText || "",
          style: target.getAttribute("style") || "",
          parent: target.parentNode,
          nextSibling: target.nextSibling
        });
      }

      // Remplir les champs d'édition
      setTextValue(target.innerText || "");
      setPaddingVal(window.getComputedStyle(target).padding || "");
      setWidthVal(window.getComputedStyle(target).width || "");
      setHeightVal(window.getComputedStyle(target).height || "");
    };

    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("mouseout", handleMouseOut, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [active, isDesktop, hoveredEl, selectedEl]);

  if (!isDesktop) return null;

  // Description / Sélecteur simplifié pour le prompt
  const describeElement = (el) => {
    if (!el) return "Élément";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classes = el.className && typeof el.className === "string" 
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    const textPreview = (el.innerText || "").slice(0, 30).trim();
    return `${tag}${id}${classes}${textPreview ? ` ("${textPreview}...")` : ""}`;
  };

  const addChange = (type, details) => {
    const item = {
      id: Date.now(),
      type,
      targetDesc: describeElement(selectedEl),
      details,
    };
    setChanges((prev) => [...prev, item]);
  };

  // Actions d'édition
  const handleUpdateText = () => {
    if (!selectedEl) return;
    const oldText = originalStates.current.get(selectedEl)?.text || "";
    selectedEl.innerText = textValue;
    addChange("Texte modifié", `Remplacer "${oldText}" par "${textValue}"`);
  };

  const handleDelete = () => {
    if (!selectedEl) return;
    selectedEl.style.display = "none";
    addChange("Section masquée/supprimée", "Supprimer cette section/élément du rendu");
    selectedEl.style.outline = "";
    setSelectedEl(null);
  };

  const handleMoveUp = () => {
    if (!selectedEl || !selectedEl.previousElementSibling) return;
    selectedEl.parentNode.insertBefore(selectedEl, selectedEl.previousElementSibling);
    addChange("Déplacement", "Déplacer l'élément avant son élément précédent");
  };

  const handleMoveDown = () => {
    if (!selectedEl || !selectedEl.nextElementSibling) return;
    selectedEl.parentNode.insertBefore(selectedEl.nextElementSibling, selectedEl);
    addChange("Déplacement", "Déplacer l'élément après son élément suivant");
  };

  const handleApplyDimensions = () => {
    if (!selectedEl) return;
    if (widthVal) selectedEl.style.width = widthVal;
    if (heightVal) selectedEl.style.height = heightVal;
    if (paddingVal) selectedEl.style.padding = paddingVal;
    addChange("Redimensionnement", `Dimensions ajustées : largeur=${widthVal}, hauteur=${heightVal}, padding=${paddingVal}`);
  };

  const handleResetAll = () => {
    originalStates.current.forEach((orig, el) => {
      if (orig.parent) {
        orig.parent.insertBefore(el, orig.nextSibling);
      }
      if (orig.style) {
        el.setAttribute("style", orig.style);
      } else {
        el.removeAttribute("style");
      }
      if (orig.text) el.innerText = orig.text;
    });
    originalStates.current.clear();
    setChanges([]);
    if (selectedEl) selectedEl.style.outline = "";
    setSelectedEl(null);
  };

  // Génération du prompt propre pour Lovable
  const generatePromptText = () => {
    const url = window.location.pathname;
    let p = `Bonjour, applique ces modifications ciblées sur la page "${url}" :\n\n`;
    changes.forEach((ch, idx) => {
      p += `${idx + 1}. [${ch.type}] sur ${ch.targetDesc} :\n   → ${ch.details}\n`;
    });
    p += `\nMerci de modifier le code proprement en conservant le reste de la page intact.`;
    return p;
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatePromptText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div id="tigran-overlay-root" className="select-none">
      {/* Bouton d'activation flottant en bas à droite */}
      <div className="fixed bottom-5 right-5 z-[99999] flex items-center gap-2">
        <button
          onClick={() => {
            setActive(!active);
            if (active && selectedEl) selectedEl.style.outline = "";
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold shadow-2xl transition-all border ${
            active 
              ? "bg-amber-500 text-black border-amber-300 ring-4 ring-amber-500/20 scale-105" 
              : "bg-zinc-950 text-amber-400 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900"
          }`}
        >
          <Sparkles size={16} />
          <span>Tigran {active ? "(Édition active)" : "Éditeur"}</span>
        </button>

        {changes.length > 0 && (
          <button
            onClick={() => setShowPromptModal(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-xl transition-all"
            title="Voir le prompt à envoyer"
          >
            <Copy size={15} />
            <span>{changes.length} modif(s)</span>
          </button>
        )}
      </div>

      {/* Barre d'outils contextuelle quand un élément est sélectionné */}
      {active && selectedEl && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-zinc-950/95 backdrop-blur-md border border-zinc-800 text-white rounded-2xl shadow-2xl p-4 w-[600px] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Tigran</span>
              <span className="text-xs text-zinc-400 truncate max-w-[380px]">
                {describeElement(selectedEl)}
              </span>
            </div>
            <button 
              onClick={() => {
                selectedEl.style.outline = "";
                setSelectedEl(null);
              }}
              className="text-zinc-400 hover:text-white p-1 rounded-md"
            >
              <X size={16} />
            </button>
          </div>

          {/* Édition texte */}
          <div className="flex items-center gap-2">
            <Type size={16} className="text-amber-400 shrink-0" />
            <input 
              type="text" 
              value={textValue} 
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Modifier le texte..." 
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
            <button 
              onClick={handleUpdateText}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition"
            >
              Appliquer
            </button>
          </div>

          {/* Redimensionnement & Espacement */}
          <div className="flex items-center gap-2 text-xs">
            <Sliders size={15} className="text-amber-400 shrink-0" />
            <input
              type="text"
              placeholder="Largeur (ex: 100%, 350px)"
              value={widthVal}
              onChange={(e) => setWidthVal(e.target.value)}
              className="w-1/3 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-white"
            />
            <input
              type="text"
              placeholder="Hauteur (ex: auto, 200px)"
              value={heightVal}
              onChange={(e) => setHeightVal(e.target.value)}
              className="w-1/3 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-white"
            />
            <input
              type="text"
              placeholder="Padding (ex: 16px)"
              value={paddingVal}
              onChange={(e) => setPaddingVal(e.target.value)}
              className="w-1/3 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-white"
            />
            <button
              onClick={handleApplyDimensions}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg shrink-0"
            >
              Taille
            </button>
          </div>

          {/* Boutons d'actions rapides (déplacer, supprimer) */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleMoveUp}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs text-zinc-300"
                title="Monter d'un cran"
              >
                <MoveUp size={13} /> Monter
              </button>
              <button
                onClick={handleMoveDown}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs text-zinc-300"
                title="Descendre d'un cran"
              >
                <MoveDown size={13} /> Descendre
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 border border-red-800/50 rounded-lg text-xs text-red-300"
                title="Supprimer la section"
              >
                <Trash2 size={13} /> Supprimer
              </button>
            </div>

            <button
              onClick={() => setShowPromptModal(true)}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium"
            >
              <Copy size={13} /> Générer le prompt
            </button>
          </div>
        </div>
      )}

      {/* Fenêtre modale avec le prompt prêt à copier */}
      {showPromptModal && (
        <div className="fixed inset-0 z-[100000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} />
                <h3 className="font-semibold text-base text-zinc-100">
                  Prompt généré par Tigran ({changes.length} modification{changes.length > 1 ? "s" : ""})
                </h3>
              </div>
              <button 
                onClick={() => setShowPromptModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Copiez ce message et collez-le dans le chat Lovable. Il appliquera directement les modifications dans le code source de manière propre.
            </p>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
              {generatePromptText()}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleResetAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition"
              >
                <RotateCcw size={14} />
                Réinitialiser la vue
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs"
                >
                  Fermer
                </button>
                <button
                  onClick={copyPrompt}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-lg transition"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "Copié dans le presse-papier !" : "Copier le prompt"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

