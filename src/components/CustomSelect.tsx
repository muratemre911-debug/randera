"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface CustomSelectOption {
  value: string | number;
  label: string;
  badge?: string;
  sublabel?: string;
  disabled?: boolean;
}

export type SelectOption = string | number | CustomSelectOption;

export interface CustomSelectProps {
  value?: string | number | null;
  onChange: (value: any) => void;
  options: SelectOption[];
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
}

export default function CustomSelect({
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
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placeAbove: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalize options to object format
  const normalizedOptions: CustomSelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string" || typeof opt === "number") {
        return { value: opt, label: String(opt) };
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

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
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
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && isSearchEnabled) {
      setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen, isSearchEnabled]);

  const handleSelect = (option: CustomSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery("");
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
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={
          buttonClassName ||
          `w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[15px] font-medium text-slate-900 transition-all hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:hover:border-slate-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none`
        }
      >
        <div className="flex items-center gap-2 truncate mr-2 min-w-0">
          <span
            className={`truncate ${
              !selectedOption
                ? "text-slate-400 dark:text-slate-500 font-normal"
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
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 font-normal">
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800/90 outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
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
                filteredOptions.map((opt) => {
                  const isSelected =
                    selectedOption &&
                    String(selectedOption.value) === String(opt.value);

                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                            ? "bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-950/60 dark:text-indigo-300"
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
