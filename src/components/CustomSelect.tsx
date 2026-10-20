"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface CustomSelectOption<
  T extends string | number = string | number,
> {
  value: T;
  label: string;
  badge?: string;
  sublabel?: string;
  disabled?: boolean;
}

export type SelectOption<T extends string | number = string | number> =
  | T
  | CustomSelectOption<T>;

export interface CustomSelectProps<
  T extends string | number = string | number,
> {
  value?: T | null;
  /** Seçilen değer. Tip, seçeneklerin `value` tipinden çıkarılır. */
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  name?: string;
  /** Form etiketleriyle ilişkilendirmek için `aria-labelledby`. */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  /** Form ile ilişkilendirmek için `aria-describedby`. */
  "aria-describedby"?: string;
}

/**
 * Özel açılır liste (combobox).
 *
 * Erişilebilirlik notu: bu bileşen uygulamadaki TÜM formlarda kullanılıyor
 * (panel hızlı-ekleme, takvim, hizmetler, ayarlar, müşteriler). Önceden
 * hiç ARIA semantiği ve hiç klavye desteği yoktu: kullanıcı yalnızca Tab
 * ile düğmeye gelip Enter/Space ile açabiliyor, listede gezinemiyordu.
 *
 * Artık:
 *  - `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-haspopup="listbox"`
 *  - `role="listbox"` / `role="option"` / `aria-selected` / `aria-disabled`
 *  - Ok tuşları, Home/End, Enter, Escape, ilk/son harf ile atlama
 *  - `aria-activedescendant` ile aktif seçeneği işaretleme (odak düğmede kalır)
 *  - Kapanınca odağın tetikleyen düğmeye dönmesi
 */
export default function CustomSelect<
  T extends string | number = string | number,
>({
  value,
  onChange,
  options,
  placeholder = "Seçiniz...",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  searchable,
  searchPlaceholder = "Ara...",
  emptyText = "Sonuç bulunamadı",
  id,
  name,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placeAbove: boolean;
  } | null>(null);
  /** Klavyeyle gezilen aktif seçeneğin indeksi. */
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const listboxId = useId();
  const generatedId = useId();
  const triggerId = id ?? generatedId;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalize options to object format
  const normalizedOptions: CustomSelectOption<T>[] = useMemo(() => {
    return options.map((opt): CustomSelectOption<T> => {
      if (typeof opt === "string" || typeof opt === "number") {
        return { value: opt as T, label: String(opt) };
      }
      return opt;
    });
  }, [options]);

  // Determine if search should be enabled (auto-enable if > 7 options)
  const isSearchEnabled = searchable ?? normalizedOptions.length > 7;

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)),
    );
  }, [normalizedOptions, searchQuery]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === "") return null;
    return (
      normalizedOptions.find((opt) => String(opt.value) === String(value)) ||
      null
    );
  }, [normalizedOptions, value]);

  // Calculate coordinates for portal floating placement
  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // If completely off-screen, close
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 280;
    const placeAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const padding = 8;
    let width = rect.width;
    let left = rect.left;

    if (left + width > window.innerWidth - padding) {
      width = Math.min(width, window.innerWidth - padding * 2);
      left = Math.max(padding, window.innerWidth - width - padding);
    }
    if (left < padding) {
      left = padding;
      width = Math.min(width, window.innerWidth - padding * 2);
    }

    setCoords({
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      placeAbove,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    updateCoords();
    setIsOpen(true);
    // Klavyeyle gezinmeye başlarken seçili olan öğeden devam et.
    const selectedIdx = filteredOptions.findIndex(
      (o) => selectedOption && String(o.value) === String(selectedOption.value),
    );
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [disabled, updateCoords, filteredOptions, selectedOption]);

  const closeMenu = useCallback(
    (restoreFocus = true) => {
      setIsOpen(false);
      setSearchQuery("");
      setActiveIndex(-1);
      if (restoreFocus) buttonRef.current?.focus();
    },
    [],
  );

  const toggleOpen = () => {
    if (disabled) return;
    if (isOpen) closeMenu();
    else openMenu();
  };

  // Keep dropdown repositioned on window scroll or resize
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScroll = () => updateCoords();
      const handleResize = () => updateCoords();

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isOpen, updateCoords]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        // Dışarı tıklandı: odağı tetikleyen düğmeye geri ver.
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeMenu]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && isSearchEnabled) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [isOpen, isSearchEnabled]);

  const handleSelect = (option: CustomSelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    closeMenu();
  };

  /** Etkin seçeneğe kaydır (klavye gezinirken görünür kalmalı). */
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    // `scrollIntoView` bazı ortamlarda yok (jsdom) — sessizce geç.
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen]);

  /**
   * Klavye gezinmesi.
   *
   * - ArrowDown/ArrowUp: aktif seçenek değiştir
   * - Home/End: ilk/son seçeneğe git
   * - Enter/Space: aktif seçeneği seç
   * - Escape: kapat
   * - Yazgı: arama kutusu açıksa metin aramaya gider; kapalıysa ilk harfe
   *   göre atlanır (native select davranışı)
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev + 1;
          if (next >= filteredOptions.length) return 0; // başa dön
          return next;
        });
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev - 1;
          if (next < 0) return Math.max(0, filteredOptions.length - 1);
          return next;
        });
        break;
      }
      case "Home": {
        e.preventDefault();
        setActiveIndex(0);
        break;
      }
      case "End": {
        e.preventDefault();
        setActiveIndex(Math.max(0, filteredOptions.length - 1));
        break;
      }
      case "Enter": {
        e.preventDefault();
        const opt = filteredOptions[activeIndex];
        if (opt) handleSelect(opt);
        break;
      }
      case " ": {
        // Arama kutusu açıksa boşluk yazmaya devam etsin.
        if (isSearchEnabled && document.activeElement === searchInputRef.current) {
          return;
        }
        e.preventDefault();
        const opt = filteredOptions[activeIndex];
        if (opt) handleSelect(opt);
        break;
      }
      case "Tab": {
        // Tab ile listeden çıkarken menüyü kapat.
        closeMenu(false);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for form integration */}
      {name && (
        <input
          type="hidden"
          name={name}
          id={id}
          value={value !== undefined && value !== null ? String(value) : ""}
        />
      )}

      {/* Select Button */}
      <button
        ref={buttonRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        className={
          buttonClassName ||
          `w-full flex items-center justify-between rounded-2xl border bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 transition-all hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-slate-800/60 dark:text-white dark:hover:border-slate-600 dark:focus:bg-slate-800 dark:focus:border-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none ${
            isOpen
              ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 dark:border-indigo-500"
              : "border-slate-200 dark:border-slate-700"
          }`
        }
      >
        <div className="flex items-center gap-2 truncate mr-2 min-w-0">
          <span
            className={`truncate ${
              !selectedOption
                ? "text-slate-400 dark:text-slate-400 font-normal"
                : "text-slate-900 dark:text-white font-medium"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shrink-0 border border-indigo-100/80 dark:border-indigo-900/40">
              {selectedOption.badge}
            </span>
          )}
          {selectedOption?.sublabel && (
            <span className="text-xs text-slate-400 dark:text-slate-400 shrink-0 font-normal">
              ({selectedOption.sublabel})
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu via Portal into document.body to escape any parent stacking contexts */}
      {mounted &&
        isOpen &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            tabIndex={-1}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              transform: coords.placeAbove ? "translateY(-100%)" : "none",
              zIndex: 999999,
            }}
            className={
              menuClassName ||
              `max-h-64 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-3xl dark:border-slate-700/80 dark:bg-slate-900/95 font-sans custom-scrollbar animate-in fade-in zoom-in-95 duration-150 select-none`
            }
          >
            {/* Search Header */}
            {isSearchEnabled && (
              <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-800/80 px-1 pt-0.5">
                <div className="relative flex items-center">
                  <Search
                    size={14}
                    className="absolute left-2.5 text-slate-400 pointer-events-none"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={(e) => {
                      // Arama kutusunda Enter: ilk eşleşmeyi seç.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const opt = filteredOptions[activeIndex];
                        if (opt) handleSelect(opt);
                      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((prev) => {
                          const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
                          if (next >= filteredOptions.length) return 0;
                          if (next < 0) return Math.max(0, filteredOptions.length - 1);
                          return next;
                        });
                      }
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800/90 outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label={emptyText}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  {emptyText}
                </div>
              ) : (
                filteredOptions.map((opt, index) => {
                  const isSelected =
                    selectedOption &&
                    String(selectedOption.value) === String(opt.value);

                  return (
                    <button
                      key={String(opt.value)}
                      ref={(el) => {
                        optionRefs.current[index] = el;
                      }}
                      id={`${listboxId}-opt-${index}`}
                      type="button"
                      role="option"
                      aria-selected={Boolean(isSelected)}
                      aria-disabled={opt.disabled || undefined}
                      disabled={opt.disabled}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSelect(opt)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                            ? "bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-950/60 dark:text-indigo-300"
                            : index === activeIndex
                              ? "bg-slate-100/80 text-slate-900 dark:bg-slate-800/80 dark:text-white"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="flex flex-col truncate">
                        <span className="truncate">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {opt.badge && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check
                            size={15}
                            className="text-indigo-600 dark:text-indigo-400 shrink-0"
                          />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
