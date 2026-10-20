import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomSelect from "./CustomSelect";

const options = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gama" },
];

describe("CustomSelect — erişilebilirlik", () => {
  it("combobox rolü ve aria özniteliklerini taşır", () => {
    render(
      <CustomSelect value={null} onChange={() => {}} options={options} />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("açıldığında listbox görünür ve seçenekler option rolünde olur", async () => {
    render(
      <CustomSelect value={null} onChange={() => {}} options={options} />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
  });

  it("seçili seçenek aria-selected taşır", async () => {
    render(
      <CustomSelect
        value="b"
        onChange={() => {}}
        options={options}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByRole("listbox"));
    const selected = screen.getAllByRole("option").find(
      (o) => o.getAttribute("aria-selected") === "true",
    );
    expect(selected).toBeTruthy();
    expect(selected).toHaveTextContent("Beta");
  });

  it("ArrowDown ile seçenekler arasında gezinir ve Enter seçer", async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect value={null} onChange={onChange} options={options} />,
    );
    const trigger = screen.getByRole("combobox");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => screen.getByRole("listbox"));

    // Menü açıldığında aktif seçenek ilk öğe.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ArrowUp ile sondan başa döner", async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect value={null} onChange={onChange} options={options} />,
    );
    const trigger = screen.getByRole("combobox");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => screen.getByRole("listbox"));

    fireEvent.keyDown(trigger, { key: "ArrowUp" }); // ilk öğeden bir geri → son
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("Home/End ilk ve son seçeneğe gider", async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect value={null} onChange={onChange} options={options} />,
    );
    const trigger = screen.getByRole("combobox");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => screen.getByRole("listbox"));

    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("c");

    onChange.mockClear();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.keyDown(trigger, { key: "Home" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("Escape menüyü kapatır ve odağı tetikleyen düğmeye döner", async () => {
    render(
      <CustomSelect value={null} onChange={() => {}} options={options} />,
    );
    const trigger = screen.getByRole("combobox");
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => screen.getByRole("listbox"));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("devre dışı seçenek seçilemez", async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect
        value={null}
        onChange={onChange}
        options={[
          { value: "a", label: "Alfa" },
          { value: "x", label: "Kapalı", disabled: true },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByRole("listbox"));

    const disabled = screen.getByRole("option", { name: /Kapalı/ });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aria-label verildiğinde tetikleyiciye uygulanır", () => {
    render(
      <CustomSelect
        value={null}
        onChange={() => {}}
        options={options}
        aria-label="Hizmet seçin"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-label",
      "Hizmet seçin",
    );
  });
});
