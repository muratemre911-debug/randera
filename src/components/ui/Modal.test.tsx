import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import Modal from "./Modal";

/** Test için basit bir sarmalayıcı: açma/kapama durumu. */
function Harness({
  dismissible = true,
  onClose = () => {},
}: {
  dismissible?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Aç
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Test Diyaloğu"
        dismissible={dismissible}
        footer={<button type="button">Kaydet</button>}
      >
        <input aria-label="Alan" />
        <button type="button">İkinci Buton</button>
      </Modal>
    </>
  );
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Modal", () => {
  it("kapalıyken DOM'a hiç girmez", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("açıldığında dialog rolü ve erişilebilir ad taşır", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Aç"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("heading", { name: "Test Diyaloğu" }),
    ).toBeInTheDocument();
  });

  it("ESC ile kapanır", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText("Aç"));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("kapatılamayan modalda ESC işe yaramaz", async () => {
    const onClose = vi.fn();
    render(<Harness dismissible={false} onClose={onClose} />);
    fireEvent.click(screen.getByText("Aç"));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("açılışta odağı diyaloğun içine alır", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Aç"));
    await screen.findByRole("dialog");

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("Tab ile diyaloğun dışına çıkılamaz (odak hapsi)", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Aç"));
    const dialog = await screen.findByRole("dialog");

    // Diyalogdaki tüm odaklanabilir öğeler
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled])",
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Son öğeden Tab → ilk öğeye dönmeli
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // İlk öğeden Shift+Tab → son öğeye dönmeli
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("kapanınca odağı tetikleyen düğmeye geri verir", async () => {
    render(<Harness />);
    const trigger = screen.getByText("Aç");
    // Gerçek tarayıcıda tıklanan düğme odağı alır; jsdom `fireEvent.click`
    // bunu yapmaz, bu yüzden burada açıkça odaklanıyoruz.
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("arka plan kaydırması kilitlenir ve kapanınca serbest kalır", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Aç"));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.body.style.overflow).toBe("");
  });
});
