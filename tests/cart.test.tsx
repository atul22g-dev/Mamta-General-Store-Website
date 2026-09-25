/**
 * Cart behaviour tests (3, 4).
 *
 * Renders the real CartProvider with Testing Library and drives it through
 * the same useCart() hook the UI uses. localStorage is the in-memory stub
 * from tests/setup.ts — no browser, no credentials.
 *
 * cart-provider keeps its hydrated snapshot at module level, so every test
 * resets the module registry and imports a fresh copy — each test starts
 * with an empty store exactly like a new browser session.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type * as React from "react";

type CartModule = typeof import("@/components/cart/cart-provider");
type CartItem = import("@/components/cart/cart-provider").CartItem;

let cart: CartModule;

/** Fresh module graph + fresh render; the store hydrates from localStorage. */
async function renderCart(): Promise<React.ReactElement> {
  vi.resetModules();
  cart = await import("@/components/cart/cart-provider");
  const { CartProvider } = cart;
  function Probe() {
    const { items, count, subtotal, addItem, setQuantity, removeItem, clear } = cart.useCart();
    const oneUnit = {
      productId: "p1",
      slug: "p1-slug",
      name: "Product 1",
      unitPrice: 120_000,
      imageUrl: null,
      sizeId: null,
      sizeLabel: null,
      colorId: null,
      colorName: null,
      quantity: 1,
      maxQuantity: 5,
    } as Omit<CartItem, "id">;
    return (
      <div>
        <span data-testid="count">{count}</span>
        <span data-testid="subtotal">{subtotal}</span>
        <span data-testid="quantities">{items.map((i) => i.quantity).join(",")}</span>
        <button type="button" data-testid="add" onClick={() => addItem(oneUnit)}>
          add
        </button>
        <button
          type="button"
          data-testid="add-many"
          onClick={() => {
            for (let i = 0; i < 10; i += 1) addItem(oneUnit);
          }}
        >
          add-many
        </button>
        <button
          type="button"
          data-testid="set-999"
          onClick={() => setQuantity(items[0]?.id ?? "", 999)}
        >
          set-999
        </button>
        <button
          type="button"
          data-testid="set-zero"
          onClick={() => setQuantity(items[0]?.id ?? "", 0)}
        >
          set-zero
        </button>
        <button
          type="button"
          data-testid="set-negative"
          onClick={() => setQuantity(items[0]?.id ?? "", -3)}
        >
          set-negative
        </button>
        <button type="button" data-testid="remove" onClick={() => removeItem(items[0]?.id ?? "")}>
          remove
        </button>
        <button type="button" data-testid="clear" onClick={clear}>
          clear
        </button>
      </div>
    );
  }
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  return <div />;
}

const click = (id: string) => (screen.getByTestId(id) as HTMLButtonElement).click();
const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("cart quantity validation (3)", () => {
  it("clamps huge quantities to the stock cap", async () => {
    await renderCart();
    // Separate act() calls: each click must see the re-rendered closure of
    // the previous one (the handlers read items from the hook).
    act(() => click("add"));
    act(() => click("set-999"));
    expect(text("quantities")).toBe("5"); // maxQuantity 5, not 999
    expect(text("subtotal")).toBe("600000"); // 5 × ₹1,200.00 in paise
  });

  it("setQuantity with zero/negative removes the line instead of clamping to 1", async () => {
    await renderCart();
    act(() => click("add"));
    expect(text("quantities")).toBe("1");
    act(() => click("set-negative"));
    expect(text("count")).toBe("0"); // negative removes, never clamps or goes negative
    act(() => click("add"));
    act(() => click("set-zero"));
    expect(text("count")).toBe("0"); // zero removes the line
  });
});

describe("cart totals (4)", () => {
  it("computes count and subtotal as integer paise sums (merge capped by stock)", async () => {
    await renderCart();
    act(() => click("add-many")); // 10 adds merge into one line, clamped to stock 5
    expect(text("count")).toBe("5");
    expect(text("subtotal")).toBe(String(120_000 * 5));
  });
});

describe("cart persistence + lifecycle", () => {
  it("persists to localStorage and survives a 'reload'", async () => {
    await renderCart();
    act(() => click("add"));
    expect(JSON.parse(localStorage.getItem("mgs_cart_v1") ?? "[]")).toHaveLength(1);

    cleanup(); // unmount — storage keeps the line
    await renderCart(); // "reload": fresh module hydrates from storage
    expect(text("count")).toBe("1");
    expect(text("subtotal")).toBe("120000");
  });

  it("removes lines and clears the cart", async () => {
    await renderCart();
    act(() => click("add"));
    act(() => click("add")); // merge → qty 2
    expect(text("count")).toBe("2");
    act(() => click("remove"));
    expect(text("count")).toBe("0");

    act(() => click("add"));
    act(() => click("clear"));
    expect(text("count")).toBe("0");
    expect(JSON.parse(localStorage.getItem("mgs_cart_v1") ?? "[]")).toEqual([]);
  });

  it("rejects corrupt storage entries (unitPrice ≤ 0) on read", async () => {
    localStorage.setItem(
      "mgs_cart_v1",
      JSON.stringify([
        {
          id: "x:-:-",
          productId: "x",
          slug: "x",
          name: "Corrupt",
          unitPrice: 0,
          imageUrl: null,
          sizeId: null,
          sizeLabel: null,
          colorId: null,
          colorName: null,
          quantity: 3,
          maxQuantity: null,
        },
      ]),
    );
    await renderCart();
    expect(text("count")).toBe("0"); // the corrupt line is dropped
  });
});
